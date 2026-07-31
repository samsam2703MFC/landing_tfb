#!/usr/bin/env node
/**
 * Création des tables du site dans la base existante.
 *
 * Idempotent : `CREATE TABLE IF NOT EXISTS`, donc rejouable sans risque.
 * Les tables portent le préfixe DB_PREFIX (`landing_` par défaut) pour
 * cohabiter avec le reste de la base sans collision de noms.
 *
 * Usage : node bootstrap-db.mjs
 */

import { estPostgres, ouvrir, table } from './lib/db.mjs';

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
      nom: table('modules'),
      sql: `CREATE TABLE IF NOT EXISTS ${table('modules')} (
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
      nom: table('fonctions'),
      sql: `CREATE TABLE IF NOT EXISTS ${table('fonctions')} (
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
      nom: table('site'),
      sql: `CREATE TABLE IF NOT EXISTS ${table('site')} (
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
  { suffixe: 'fonctions_module', table: 'fonctions', colonnes: 'module_id' },
  { suffixe: 'fonctions_cle', table: 'fonctions', colonnes: 'module_id, cle' },
  { suffixe: 'modules_actif', table: 'modules', colonnes: 'actif, ordre' },
];

/** MySQL ne connaît pas `CREATE INDEX IF NOT EXISTS` : on tolère le doublon. */
async function creerIndex(db, pg, index) {
  const nom = `idx_${table(index.suffixe)}`;
  const cible = table(index.table);
  const sql = pg
    ? `CREATE INDEX IF NOT EXISTS ${nom} ON ${cible} (${index.colonnes})`
    : `CREATE INDEX ${nom} ON ${cible} (${index.colonnes})`;
  try {
    await db.executer(sql);
    console.log(`  + index ${nom}`);
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

    // La table site ne contient qu'une ligne : on l'amorce si besoin.
    const lignes = await db.requete(`SELECT id FROM ${table('site')} LIMIT 1`);
    if (lignes.length === 0) {
      await db.executer(
        `INSERT INTO ${table('site')} (cta_texte, cta_url) VALUES (?, ?)`,
        ['Demander une démonstration', '#contact'],
      );
      console.log(`✓ ligne unique de ${table('site')} créée`);
    }

    console.log('\nTables prêtes. Lancer ensuite : npm run ingest:all');
  } finally {
    await db.fermer();
  }
}

/** Un refus d'accès est de loin l'erreur la plus fréquente : on donne la main. */
function conseil(message) {
  if (!/access denied|authentication failed|password/i.test(message)) return null;

  const base = process.env.DB_NAME || 'tfb_landing';
  const login = process.env.DB_LOGIN || 'tfb_landing';
  const collation = estPostgres() ? '' : ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';

  if (estPostgres()) {
    return [
      "Le compte n'existe pas ou le mot de passe ne correspond pas. Depuis psql en superutilisateur :",
      `  CREATE DATABASE ${base};`,
      `  CREATE USER ${login} WITH PASSWORD '<le DB_PASS du .env>';`,
      `  GRANT ALL PRIVILEGES ON DATABASE ${base} TO ${login};`,
    ].join('\n');
  }

  return [
    "Le compte n'existe pas ou le mot de passe ne correspond pas. Depuis mysql en root :",
    `  CREATE DATABASE IF NOT EXISTS \`${base}\`${collation};`,
    `  CREATE USER IF NOT EXISTS '${login}'@'localhost' IDENTIFIED BY '<le DB_PASS du .env>';`,
    `  ALTER USER '${login}'@'localhost' IDENTIFIED BY '<le DB_PASS du .env>';`,
    `  GRANT ALL PRIVILEGES ON \`${base}\`.* TO '${login}'@'localhost';`,
    '  FLUSH PRIVILEGES;',
    "Sinon, corriger DB_LOGIN, DB_NAME ou DB_PASS dans infra/.env pour qu'ils désignent un compte existant.",
  ].join('\n');
}

principal().catch((err) => {
  console.error(`\n✗ Bootstrap interrompu : ${err.message}`);
  const aide = conseil(err.message);
  if (aide) console.error(`\n${aide}`);
  process.exit(1);
});
