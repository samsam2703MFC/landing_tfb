#!/usr/bin/env node
/**
 * Création des tables du site dans la base existante.
 *
 * Idempotent : `CREATE TABLE IF NOT EXISTS`, donc rejouable sans risque.
 * Les trois tables sont préfixées `tfb_` pour cohabiter avec le reste de la
 * base sans collision.
 *
 * Usage : node bootstrap-db.mjs
 */

import { estPostgres, ouvrir } from './lib/db.mjs';

/** Définitions par dialecte : seuls les types changent. */
function tables(pg) {
  const id = pg ? 'SERIAL PRIMARY KEY' : 'INT AUTO_INCREMENT PRIMARY KEY';
  const texte = 'TEXT';
  const chaine = (n = 255) => `VARCHAR(${n})`;
  const objet = pg ? 'JSONB' : 'JSON';
  const booleen = pg ? 'BOOLEAN' : 'TINYINT(1)';
  const horodatage = pg ? 'TIMESTAMPTZ' : 'DATETIME';

  return [
    {
      nom: 'tfb_modules',
      sql: `CREATE TABLE IF NOT EXISTS tfb_modules (
        id ${id},
        slug ${chaine(120)} NOT NULL UNIQUE,
        repo ${chaine(255)},
        ref ${chaine(120)},
        groupe ${chaine(120)},
        ordre INT DEFAULT 100,
        actif ${booleen} DEFAULT ${pg ? 'TRUE' : '1'},
        nom ${chaine(255)},
        accroche ${texte},
        resume ${texte},
        description ${texte},
        public_cible ${chaine(255)},
        problemes ${objet},
        benefices ${objet},
        stack ${objet},
        mots_cles ${objet},
        mermaid ${texte},
        commit_sha ${chaine(64)},
        modele_ia ${chaine(120)},
        genere_le ${horodatage}
      )`,
    },
    {
      nom: 'tfb_fonctions',
      sql: `CREATE TABLE IF NOT EXISTS tfb_fonctions (
        id ${id},
        module_id INT NOT NULL,
        cle ${chaine(120)} NOT NULL,
        nom ${chaine(255)},
        description ${texte},
        benefice ${texte},
        icone ${chaine(60)},
        ordre INT DEFAULT 100
      )`,
    },
    {
      nom: 'tfb_site',
      sql: `CREATE TABLE IF NOT EXISTS tfb_site (
        id ${id},
        titre ${chaine(255)},
        sous_titre ${chaine(255)},
        accroche ${texte},
        problemes ${objet},
        reponses ${objet},
        mermaid ${texte},
        cta_texte ${chaine(120)},
        cta_url ${chaine(255)},
        meta_description ${texte},
        genere_le ${horodatage}
      )`,
    },
  ];
}

/** Index secondaires, créés séparément pour rester portables. */
const INDEX = [
  { nom: 'idx_tfb_fonctions_module', table: 'tfb_fonctions', colonnes: 'module_id' },
  { nom: 'idx_tfb_fonctions_cle', table: 'tfb_fonctions', colonnes: 'module_id, cle' },
  { nom: 'idx_tfb_modules_actif', table: 'tfb_modules', colonnes: 'actif, ordre' },
];

/** MySQL ne connaît pas `CREATE INDEX IF NOT EXISTS` : on tolère le doublon. */
async function creerIndex(db, pg, index) {
  const sql = pg
    ? `CREATE INDEX IF NOT EXISTS ${index.nom} ON ${index.table} (${index.colonnes})`
    : `CREATE INDEX ${index.nom} ON ${index.table} (${index.colonnes})`;
  try {
    await db.executer(sql);
    console.log(`  + index ${index.nom}`);
  } catch (err) {
    const dejaLa = /duplicate key name|already exists/i.test(err.message);
    if (!dejaLa) throw err;
  }
}

async function principal() {
  const pg = estPostgres();
  console.log(`→ base ${process.env.DB_NAME} sur ${process.env.DB_HOST} (${pg ? 'PostgreSQL' : 'MySQL'})`);

  const db = await ouvrir();
  try {
    for (const table of tables(pg)) {
      await db.executer(table.sql);
      console.log(`✓ ${table.nom}`);
    }

    for (const index of INDEX) {
      await creerIndex(db, pg, index);
    }

    // La table `tfb_site` ne contient qu'une ligne : on l'amorce si besoin.
    const lignes = await db.requete('SELECT id FROM tfb_site LIMIT 1');
    if (lignes.length === 0) {
      await db.executer(
        'INSERT INTO tfb_site (cta_texte, cta_url) VALUES (?, ?)',
        ['Demander une démonstration', '#contact'],
      );
      console.log('✓ ligne unique de tfb_site créée');
    }

    console.log('\nTables prêtes. Lancer ensuite : npm run ingest:all');
  } finally {
    await db.fermer();
  }
}

principal().catch((err) => {
  console.error(`\n✗ Bootstrap interrompu : ${err.message}`);
  process.exit(1);
});
