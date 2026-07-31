#!/usr/bin/env node
/**
 * Charge le contenu de départ des huit modules, sans appeler l'API Anthropic.
 *
 * Trois usages :
 *   node seed-contenu.mjs            écrit directement dans la base
 *   node seed-contenu.mjs --si-vide  n'écrit que si aucun module n'existe
 *   node seed-contenu.mjs --sql      écrit le fichier contenu.sql
 *
 * Idempotent comme l'ingestion : upsert par `slug` pour les modules, par
 * (module_id, cle) pour les fonctions, et suppression de ce qui a disparu.
 * Une ingestion IA ultérieure remplace ce contenu module par module.
 */

import { writeFile } from 'node:fs/promises';

import { MODULES, SITE } from './contenu-initial.mjs';
import { json, ouvrir, upsert } from './lib/db.mjs';

// ---------------------------------------------------------------------------
// Écriture en base
// ---------------------------------------------------------------------------

async function ecrireEnBase({ siVide = false } = {}) {
  const db = await ouvrir();
  try {
    // Utilisé au déploiement : on amorce une base neuve, mais on ne réécrit
    // jamais par-dessus un contenu déjà généré par l'ingestion.
    if (siVide) {
      const [{ n }] = await db.requete('SELECT COUNT(*) AS n FROM tfb_modules');
      if (Number(n) > 0) {
        console.log(`${n} module(s) déjà en base — contenu de départ non rechargé.`);
        return;
      }
    }
    for (const module of MODULES) {
      const { id, cree } = await upsert(db, 'tfb_modules', 'slug', module.slug, {
        repo: module.repo,
        ref: 'main',
        groupe: module.groupe,
        ordre: module.ordre,
        actif: true,
        nom: module.nom,
        accroche: module.accroche,
        resume: module.resume,
        description: module.description,
        public_cible: module.public_cible,
        problemes: json(module.problemes),
        benefices: json(module.benefices),
        stack: json(module.stack),
        mots_cles: json(module.mots_cles),
        mermaid: module.mermaid,
        commit_sha: null,
        modele_ia: 'contenu-initial',
        genere_le: new Date(),
      });

      const anciennes = await db.requete(
        'SELECT id, cle FROM tfb_fonctions WHERE module_id = ?',
        [id],
      );
      const parCle = new Map(anciennes.map((f) => [f.cle, f.id]));

      let position = 1;
      const vues = new Set();
      for (const fonction of module.fonctions) {
        const valeurs = [
          fonction.nom,
          fonction.description,
          fonction.benefice,
          fonction.icone,
          position,
        ];
        const existant = parCle.get(fonction.cle);
        if (existant) {
          await db.executer(
            'UPDATE tfb_fonctions SET nom = ?, description = ?, benefice = ?, icone = ?, ordre = ? WHERE id = ?',
            [...valeurs, existant],
          );
        } else {
          await db.executer(
            'INSERT INTO tfb_fonctions (module_id, cle, nom, description, benefice, icone, ordre) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, fonction.cle, ...valeurs],
          );
        }
        vues.add(fonction.cle);
        position += 1;
      }

      const obsoletes = anciennes.filter((f) => !vues.has(f.cle)).map((f) => f.id);
      if (obsoletes.length) {
        await db.executer(
          `DELETE FROM tfb_fonctions WHERE id IN (${obsoletes.map(() => '?').join(', ')})`,
          obsoletes,
        );
      }

      console.log(
        `${cree ? '✓ créé  ' : '· maj   '} ${module.slug.padEnd(20)} ${module.fonctions.length} fonctions`,
      );
    }

    // Page d'accueil : une seule ligne.
    const valeurs = [
      SITE.titre, SITE.sous_titre, SITE.accroche,
      json(SITE.problemes), json(SITE.reponses),
      SITE.mermaid, SITE.cta_texte, SITE.cta_url, SITE.meta_description, new Date(),
    ];
    const lignes = await db.requete('SELECT id FROM tfb_site LIMIT 1');
    if (lignes.length > 0) {
      await db.executer(
        `UPDATE tfb_site SET titre = ?, sous_titre = ?, accroche = ?, problemes = ?, reponses = ?,
         mermaid = ?, cta_texte = ?, cta_url = ?, meta_description = ?, genere_le = ? WHERE id = ?`,
        [...valeurs, lignes[0].id],
      );
    } else {
      await db.executer(
        `INSERT INTO tfb_site (titre, sous_titre, accroche, problemes, reponses, mermaid,
         cta_texte, cta_url, meta_description, genere_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        valeurs,
      );
    }
    console.log("✓ page d'accueil");

    const total = MODULES.reduce((n, m) => n + m.fonctions.length, 0);
    console.log(`\n${MODULES.length} modules, ${total} fonctions en base.`);
  } finally {
    await db.fermer();
  }
}

// ---------------------------------------------------------------------------
// Génération d'un fichier SQL portable
// ---------------------------------------------------------------------------

/** Échappe une valeur pour un littéral SQL, MySQL comme PostgreSQL. */
function litteral(valeur) {
  if (valeur === null || valeur === undefined) return 'NULL';
  const texte = typeof valeur === 'string' ? valeur : JSON.stringify(valeur);
  // Le doublement de l'apostrophe est le seul échappement commun aux deux
  // moteurs. Un antislash serait interprété par MySQL et pas par PostgreSQL :
  // plutôt que de produire du SQL qui diffère selon le moteur, on refuse.
  if (texte.includes('\\')) {
    throw new Error(`Antislash interdit dans le contenu : ${texte.slice(0, 60)}…`);
  }
  return `'${texte.replace(/'/g, "''")}'`;
}

function genererSql() {
  const l = [];
  l.push('-- Contenu de départ de la landing — 8 modules et la page d\'accueil.');
  l.push('-- Généré par pipeline/seed-contenu.mjs. Compatible MySQL et PostgreSQL.');
  l.push('-- Rejouable : le contenu est remplacé, jamais dupliqué.');
  l.push('-- Prérequis : les tables existent (node bootstrap-db.mjs).');
  l.push('');
  l.push('BEGIN;');
  l.push('');
  l.push('DELETE FROM tfb_fonctions;');
  l.push('DELETE FROM tfb_modules;');
  l.push('');

  for (const m of MODULES) {
    l.push(`-- ── ${m.nom} (${m.slug})`);
    l.push('INSERT INTO tfb_modules (slug, repo, ref, groupe, ordre, actif, nom, accroche, resume,');
    l.push('  description, public_cible, problemes, benefices, stack, mots_cles, mermaid, modele_ia)');
    l.push('VALUES (');
    l.push(`  ${litteral(m.slug)}, ${litteral(m.repo)}, 'main', ${litteral(m.groupe)}, ${m.ordre}, '1',`);
    l.push(`  ${litteral(m.nom)},`);
    l.push(`  ${litteral(m.accroche)},`);
    l.push(`  ${litteral(m.resume)},`);
    l.push(`  ${litteral(m.description)},`);
    l.push(`  ${litteral(m.public_cible)},`);
    l.push(`  ${litteral(m.problemes)},`);
    l.push(`  ${litteral(m.benefices)},`);
    l.push(`  ${litteral(m.stack)},`);
    l.push(`  ${litteral(m.mots_cles)},`);
    l.push(`  ${litteral(m.mermaid)},`);
    l.push("  'contenu-initial'");
    l.push(');');

    m.fonctions.forEach((f, i) => {
      l.push('INSERT INTO tfb_fonctions (module_id, cle, nom, description, benefice, icone, ordre)');
      l.push(`SELECT id, ${litteral(f.cle)}, ${litteral(f.nom)},`);
      l.push(`  ${litteral(f.description)},`);
      l.push(`  ${litteral(f.benefice)}, ${litteral(f.icone)}, ${i + 1}`);
      l.push(`FROM tfb_modules WHERE slug = ${litteral(m.slug)};`);
    });
    l.push('');
  }

  l.push("-- ── Page d'accueil");
  l.push('DELETE FROM tfb_site;');
  l.push('INSERT INTO tfb_site (titre, sous_titre, accroche, problemes, reponses, mermaid,');
  l.push('  cta_texte, cta_url, meta_description)');
  l.push('VALUES (');
  l.push(`  ${litteral(SITE.titre)},`);
  l.push(`  ${litteral(SITE.sous_titre)},`);
  l.push(`  ${litteral(SITE.accroche)},`);
  l.push(`  ${litteral(SITE.problemes)},`);
  l.push(`  ${litteral(SITE.reponses)},`);
  l.push(`  ${litteral(SITE.mermaid)},`);
  l.push(`  ${litteral(SITE.cta_texte)}, ${litteral(SITE.cta_url)},`);
  l.push(`  ${litteral(SITE.meta_description)}`);
  l.push(');');
  l.push('');
  l.push('COMMIT;');
  l.push('');

  return l.join('\n');
}

async function principal() {
  if (process.argv.includes('--sql')) {
    const cible = 'contenu.sql';
    await writeFile(cible, genererSql(), 'utf8');
    const total = MODULES.reduce((n, m) => n + m.fonctions.length, 0);
    console.log(`✓ ${cible} écrit — ${MODULES.length} modules, ${total} fonctions.`);
    return;
  }
  await ecrireEnBase({ siVide: process.argv.includes('--si-vide') });
}

principal().catch((err) => {
  console.error(`\n✗ Chargement interrompu : ${err.message}`);
  process.exit(1);
});
