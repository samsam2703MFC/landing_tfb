#!/usr/bin/env node
/**
 * Ingestion de tous les modules listés dans modules.json, puis régénération
 * du contenu de la page d'accueil.
 *
 * Usage :
 *   node ingest-all.mjs
 *   node ingest-all.mjs --force
 *   node ingest-all.mjs --only=consultant,cuisine
 *   node ingest-all.mjs --skip-site --strict
 *
 * Un dépôt en échec (vide, inaccessible, réponse IA invalide) est signalé puis
 * ignoré : le lot continue. Le script ne sort en erreur que si aucun module
 * n'a pu être traité — ou avec --strict, dès qu'un module échoue.
 */

import { genererContenuSite } from './lib/ai.mjs';
import { json, ouvrir } from './lib/db.mjs';
import { chargerRegistre, ingererModule } from './ingest.mjs';

function lireOptions(argv) {
  const options = { force: false, strict: false, skipSite: false, only: null };
  for (const arg of argv) {
    if (arg === '--force') options.force = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--skip-site') options.skipSite = true;
    else if (arg.startsWith('--only=')) {
      options.only = arg
        .slice(7)
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    }
  }
  return options;
}

/** Régénère le contenu de la page d'accueil à partir de ce qui est en base. */
async function regenererSite(db) {
  const modules = await db.requete(
    'SELECT id, slug, nom, accroche, resume, groupe FROM tfb_modules WHERE actif = ? ORDER BY ordre, nom',
    [db.dialecte === 'pg' ? true : 1],
  );

  if (modules.length === 0) {
    console.log("\n⚠ Aucun module actif en base : page d'accueil non régénérée.");
    return;
  }

  // Les noms de fonctions donnent au modèle la matière pour la synthèse.
  for (const module of modules) {
    module.fonctions = await db.requete(
      'SELECT nom FROM tfb_fonctions WHERE module_id = ? ORDER BY ordre',
      [module.id],
    );
  }

  const contenu = await genererContenuSite(modules);

  const lignes = await db.requete('SELECT id FROM tfb_site LIMIT 1');
  const valeurs = [
    contenu.titre,
    contenu.sous_titre,
    contenu.accroche,
    json(contenu.problemes),
    json(contenu.reponses),
    contenu.mermaid,
    contenu.cta_texte,
    contenu.meta_description,
    new Date(),
  ];

  if (lignes.length > 0) {
    await db.executer(
      `UPDATE tfb_site SET titre = ?, sous_titre = ?, accroche = ?, problemes = ?,
       reponses = ?, mermaid = ?, cta_texte = ?, meta_description = ?, genere_le = ?
       WHERE id = ?`,
      [...valeurs, lignes[0].id],
    );
  } else {
    await db.executer(
      `INSERT INTO tfb_site (titre, sous_titre, accroche, problemes, reponses,
       mermaid, cta_texte, meta_description, genere_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      valeurs,
    );
  }

  console.log(`\n✓ page d'accueil régénérée à partir de ${modules.length} modules`);
}

async function principal() {
  const options = lireOptions(process.argv.slice(2));
  const registre = await chargerRegistre();

  const aTraiter = options.only
    ? registre.filter((m) => options.only.includes(m.slug.toLowerCase()))
    : registre;

  if (aTraiter.length === 0) {
    console.error('✗ Aucun module à traiter (vérifier --only et modules.json).');
    process.exit(2);
  }

  console.log(`→ ${aTraiter.length} module(s) à ingérer`);

  const db = await ouvrir();
  const reussis = [];
  const inchanges = [];
  const echecs = [];

  try {
    for (const entree of aTraiter) {
      try {
        const bilan = await ingererModule(entree, { force: options.force, db });
        if (bilan.statut === 'inchange') inchanges.push(bilan.slug);
        else reussis.push(bilan.slug);
      } catch (err) {
        // Un dépôt en échec ne doit pas interrompre les suivants.
        console.error(`   ✗ ${entree.slug} : ${err.message}`);
        echecs.push({ slug: entree.slug, raison: err.message });
      }
    }

    // La page d'accueil n'est régénérée que si le contenu a bougé.
    if (!options.skipSite && reussis.length > 0) {
      try {
        await regenererSite(db);
      } catch (err) {
        console.error(`\n✗ Page d'accueil : ${err.message}`);
        echecs.push({ slug: "(page d'accueil)", raison: err.message });
      }
    }
  } finally {
    await db.fermer();
  }

  console.log('\n──────── Bilan ────────');
  console.log(`régénérés : ${reussis.length ? reussis.join(', ') : '—'}`);
  console.log(`inchangés : ${inchanges.length ? inchanges.join(', ') : '—'}`);
  console.log(`échecs    : ${echecs.length ? echecs.map((e) => e.slug).join(', ') : '—'}`);

  if (echecs.length > 0) {
    for (const echec of echecs) console.log(`  · ${echec.slug} — ${echec.raison}`);
  }

  const totalOk = reussis.length + inchanges.length;
  if (options.strict && echecs.length > 0) process.exit(1);
  if (totalOk === 0) process.exit(1);
}

principal().catch((err) => {
  console.error(`\n✗ Lot interrompu : ${err.message}`);
  process.exit(1);
});
