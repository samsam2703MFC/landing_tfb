#!/usr/bin/env node
/**
 * Charge le contenu de départ des modules, sans appeler l'API Anthropic.
 *
 * Trois usages :
 *   node seed-contenu.mjs            réécrit tout le contenu de départ
 *   node seed-contenu.mjs --si-vide  n'écrit que les modules absents de la base
 *   node seed-contenu.mjs --sql      écrit le fichier pipeline/contenu.sql
 *
 * `--si-vide` est le mode du déploiement : il complète — un module ajouté au
 * catalogue arrive en base au prochain déploiement — mais ne réécrit jamais
 * par-dessus une fiche déjà générée, ni par l'IA, ni à la main dans la console.
 *
 * Idempotent comme l'ingestion : upsert par `slug` pour les modules, par
 * (module_id, cle) pour les fonctions, et suppression de ce qui a disparu.
 * Une ingestion IA ultérieure remplace ce contenu module par module.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODULES, QUESTIONS, SITE } from './contenu-initial.mjs';
import { json, ouvrir, table, upsert } from './lib/db.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Écriture en base
// ---------------------------------------------------------------------------

async function ecrireEnBase({ siVide = false } = {}) {
  const db = await ouvrir();
  try {
    // Mode du déploiement : on complète ce qui manque sans toucher au reste.
    // Un module ajouté au catalogue arrive donc tout seul, et une fiche déjà
    // retouchée — par l'ingestion IA ou dans la console — est laissée en place.
    let dejaLa = new Set();
    if (siVide) {
      const lignes = await db.requete(`SELECT slug FROM ${table('modules')}`);
      dejaLa = new Set(lignes.map((l) => l.slug));
    }

    let ignores = 0;
    for (const module of MODULES) {
      if (dejaLa.has(module.slug)) {
        ignores += 1;
        continue;
      }
      const { id, cree } = await upsert(db, table('modules'), 'slug', module.slug, {
        repo: module.repo,
        ref: 'main',
        groupe: module.groupe,
        icone: module.icone,
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
        leviers: json(module.leviers),
        liens: json(module.liens),
        onboarding: module.onboarding,
        commit_sha: null,
        modele_ia: 'contenu-initial',
        genere_le: new Date(),
      });

      const anciennes = await db.requete(
        `SELECT id, cle FROM ${table('fonctions')} WHERE module_id = ?`,
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
          json(fonction.leviers),
          position,
        ];
        const existant = parCle.get(fonction.cle);
        if (existant) {
          await db.executer(
            `UPDATE ${table('fonctions')} SET nom = ?, description = ?, benefice = ?, icone = ?, leviers = ?, ordre = ? WHERE id = ?`,
            [...valeurs, existant],
          );
        } else {
          await db.executer(
            `INSERT INTO ${table('fonctions')} (module_id, cle, nom, description, benefice, icone, leviers, ordre) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, fonction.cle, ...valeurs],
          );
        }
        vues.add(fonction.cle);
        position += 1;
      }

      const obsoletes = anciennes.filter((f) => !vues.has(f.cle)).map((f) => f.id);
      if (obsoletes.length) {
        await db.executer(
          `DELETE FROM ${table('fonctions')} WHERE id IN (${obsoletes.map(() => '?').join(', ')})`,
          obsoletes,
        );
      }

      console.log(
        `${cree ? '✓ créé  ' : '· maj   '} ${module.slug.padEnd(20)} ${module.fonctions.length} fonctions`,
      );
    }

    // Les questions de l'onboarding, repérées par leur clé.
    for (const [rang, question] of QUESTIONS.entries()) {
      await upsert(db, table('questions'), 'cle', question.cle, {
        tag: question.tag,
        texte: question.texte,
        cible: question.cible,
        slugs: json(question.slugs),
        ordre: rang + 1,
      });
    }
    console.log(`✓ ${QUESTIONS.length} questions d'onboarding`);

    // Page d'accueil : une seule ligne. En mode « complète », on ne l'écrit
    // que si elle est encore vide — sinon on écraserait un texte retouché.
    const valeurs = [
      SITE.titre, SITE.sous_titre, SITE.accroche,
      json(SITE.problemes), json(SITE.reponses),
      SITE.mermaid, SITE.cta_texte, SITE.cta_url, SITE.meta_description, new Date(),
    ];
    const lignes = await db.requete(`SELECT id, titre FROM ${table('site')} LIMIT 1`);
    if (siVide && lignes.length > 0 && lignes[0].titre) {
      console.log("· page d'accueil déjà renseignée — laissée en place");
    } else if (lignes.length > 0) {
      await db.executer(
        `UPDATE ${table('site')} SET titre = ?, sous_titre = ?, accroche = ?, problemes = ?, reponses = ?,
         mermaid = ?, cta_texte = ?, cta_url = ?, meta_description = ?, genere_le = ? WHERE id = ?`,
        [...valeurs, lignes[0].id],
      );
      console.log("✓ page d'accueil");
    } else {
      await db.executer(
        `INSERT INTO ${table('site')} (titre, sous_titre, accroche, problemes, reponses, mermaid,
         cta_texte, cta_url, meta_description, genere_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        valeurs,
      );
      console.log("✓ page d'accueil");
    }

    if (ignores > 0) {
      console.log(`\n${ignores} module(s) déjà en base, laissé(s) en place.`);
    }
    const [{ nm }] = await db.requete(`SELECT COUNT(*) AS nm FROM ${table('modules')}`);
    const [{ nf }] = await db.requete(`SELECT COUNT(*) AS nf FROM ${table('fonctions')}`);
    console.log(`${Number(nm)} modules, ${Number(nf)} fonctions en base.`);
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
  l.push(`DELETE FROM ${table('fonctions')};`);
  l.push(`DELETE FROM ${table('modules')};`);
  l.push('');

  for (const m of MODULES) {
    l.push(`-- ── ${m.nom} (${m.slug})`);
    l.push(`INSERT INTO ${table('modules')} (slug, repo, ref, groupe, icone, ordre, actif, nom, accroche, resume,`);
    l.push('  description, public_cible, problemes, benefices, stack, mots_cles, mermaid,');
    l.push('  leviers, liens, onboarding, modele_ia)');
    l.push('VALUES (');
    l.push(`  ${litteral(m.slug)}, ${litteral(m.repo)}, 'main', ${litteral(m.groupe)}, ${litteral(m.icone)}, ${m.ordre}, '1',`);
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
    l.push(`  ${litteral(m.leviers)},`);
    l.push(`  ${litteral(m.liens)},`);
    l.push(`  ${litteral(m.onboarding)},`);
    l.push("  'contenu-initial'");
    l.push(');');

    m.fonctions.forEach((f, i) => {
      l.push(`INSERT INTO ${table('fonctions')} (module_id, cle, nom, description, benefice, icone, leviers, ordre)`);
      l.push(`SELECT id, ${litteral(f.cle)}, ${litteral(f.nom)},`);
      l.push(`  ${litteral(f.description)},`);
      l.push(`  ${litteral(f.benefice)}, ${litteral(f.icone)}, ${litteral(f.leviers)}, ${i + 1}`);
      l.push(`FROM ${table('modules')} WHERE slug = ${litteral(m.slug)};`);
    });
    l.push('');
  }

  l.push("-- ── Page d'accueil");
  l.push(`DELETE FROM ${table('site')};`);
  l.push(`INSERT INTO ${table('site')} (titre, sous_titre, accroche, problemes, reponses, mermaid,`);
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
    // Toujours à côté du script, quel que soit le répertoire d'appel.
    const cible = resolve(ICI, 'contenu.sql');
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
