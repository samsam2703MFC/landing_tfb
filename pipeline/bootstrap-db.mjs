#!/usr/bin/env node
/**
 * Création et mise à niveau des tables du site.
 *
 * Idempotent à deux niveaux : la table est créée si elle manque, et les
 * colonnes absentes d'une table déjà en place sont ajoutées. Sans ce second
 * niveau, `CREATE TABLE IF NOT EXISTS` ne fait rien sur une table existante et
 * une évolution du schéma passe silencieusement à la trappe.
 *
 * Les tables portent le préfixe DB_PREFIX (`landing_` par défaut) pour
 * cohabiter avec le reste de la base sans collision de noms.
 *
 * Usage : node bootstrap-db.mjs
 */

import { estPostgres, ouvrir, table } from './lib/db.mjs';

/** Types par dialecte : c'est tout ce qui change entre MySQL et PostgreSQL. */
function types(pg) {
  return {
    id: pg ? 'SERIAL PRIMARY KEY' : 'INT AUTO_INCREMENT PRIMARY KEY',
    texte: 'TEXT',
    chaine: (n = 255) => `VARCHAR(${n})`,
    objet: pg ? 'JSONB' : 'JSON',
    booleen: pg ? 'BOOLEAN' : 'TINYINT(1)',
    horodatage: pg ? 'TIMESTAMPTZ' : 'DATETIME',
    vrai: pg ? 'TRUE' : '1',
  };
}

/**
 * Le modèle, colonne par colonne — la forme structurée permet d'engendrer
 * aussi bien le CREATE TABLE que les ALTER TABLE de rattrapage.
 */
function modele(pg) {
  const t = types(pg);
  return [
    {
      nom: table('modules'),
      colonnes: [
        ['id', t.id],
        ['slug', `${t.chaine(120)} NOT NULL UNIQUE`],
        ['repo', t.chaine(255)],
        ['ref', t.chaine(120)],
        ['groupe', t.chaine(120)],
        // L'icône du module dans le catalogue et le graphe de flux.
        ['icone', t.chaine(60)],
        ['ordre', 'INT DEFAULT 100'],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        ['nom', t.chaine(255)],
        ['accroche', t.texte],
        ['resume', t.texte],
        ['description', t.texte],
        ['public_cible', t.chaine(255)],
        ['problemes', t.objet],
        ['benefices', t.objet],
        ['stack', t.objet],
        ['mots_cles', t.objet],
        ['mermaid', t.texte],
        // Les 6 leviers HEXm que le module actionne, et les modules avec
        // lesquels il échange — la matière de la page d'onboarding.
        ['leviers', t.objet],
        ['liens', t.objet],
        ['onboarding', t.texte],
        // Flux de validation : tout contenu produit par le pipeline arrive
        // en « nouveau » et attend une relecture dans la console.
        ['statut', `${t.chaine(20)} DEFAULT 'valide'`],
        ['commit_sha', t.chaine(64)],
        ['modele_ia', t.chaine(120)],
        ['genere_le', t.horodatage],
      ],
    },
    {
      nom: table('fonctions'),
      colonnes: [
        ['id', t.id],
        ['module_id', 'INT NOT NULL'],
        ['cle', `${t.chaine(120)} NOT NULL`],
        ['nom', t.chaine(255)],
        ['description', t.texte],
        ['benefice', t.texte],
        ['icone', t.chaine(60)],
        ['leviers', t.objet],
        ['ordre', 'INT DEFAULT 100'],
        // Un composant « nouveau » reste hors ligne : le commutateur est
        // verrouillé tant que la relecture n'a pas eu lieu.
        ['statut', `${t.chaine(20)} DEFAULT 'valide'`],
        ['en_ligne', `${t.booleen} DEFAULT ${t.vrai}`],
      ],
    },
    {
      nom: table('captures'),
      colonnes: [
        ['id', t.id],
        ['module_id', 'INT NOT NULL'],
        ['fonction_cle', t.chaine(120)],
        ['fichier', `${t.chaine(255)} NOT NULL`],
        ['titre', t.chaine(255)],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Les questions de l'onboarding : ce que le franchiseur coche pour
      // voir son système s'assembler. `slugs` porte les modules déclenchés.
      nom: table('questions'),
      colonnes: [
        ['id', t.id],
        ['cle', `${t.chaine(60)} NOT NULL UNIQUE`],
        ['tag', t.chaine(20)],
        ['texte', t.texte],
        ['cible', t.chaine(120)],
        ['slugs', t.objet],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Le discours éditorial des pages : chapeaux de section, libellés de
      // bouton, phrases d'accompagnement. Tout ce qui était écrit en dur dans
      // les gabarits vit ici, et se modifie dans la console.
      nom: table('textes'),
      colonnes: [
        ['id', t.id],
        ['cle', `${t.chaine(120)} NOT NULL UNIQUE`],
        ['valeur', t.texte],
        ['section', t.chaine(60)],
        ['aide', t.chaine(255)],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Les demandes de démonstration reçues par le formulaire de contact.
      nom: table('leads'),
      colonnes: [
        ['id', t.id],
        ['nom', t.chaine(160)],
        ['reseau', t.chaine(200)],
        ['email', t.chaine(200)],
        ['situation', t.texte],
        ['source', t.chaine(80)],
        ['traite', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['recu_le', t.horodatage],
      ],
    },
    {
      // Les réseaux affichés sur la landing. Vide, le bandeau ne s'affiche
      // pas — mieux vaut rien que des noms inventés.
      nom: table('clients'),
      colonnes: [
        ['id', t.id],
        ['nom', `${t.chaine(160)} NOT NULL`],
        ['note', t.chaine(255)],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Les langues prévues. `part` dit où en est la traduction ; tant
      // qu'elle n'est pas faite, la langue reste non publiée.
      nom: table('langues'),
      colonnes: [
        ['id', t.id],
        ['code', `${t.chaine(8)} NOT NULL UNIQUE`],
        ['nom', t.chaine(80)],
        ['rtl', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['defaut', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['publiee', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      nom: table('site'),
      colonnes: [
        ['id', t.id],
        ['titre', t.chaine(255)],
        ['sous_titre', t.chaine(255)],
        ['accroche', t.texte],
        ['problemes', t.objet],
        ['reponses', t.objet],
        ['mermaid', t.texte],
        ['cta_texte', t.chaine(120)],
        ['cta_url', t.chaine(255)],
        ['meta_description', t.texte],
        ['genere_le', t.horodatage],
      ],
    },
  ];
}

/** Index secondaires, créés séparément pour rester portables. */
const INDEX = [
  { suffixe: 'fonctions_module', table: 'fonctions', colonnes: 'module_id' },
  { suffixe: 'fonctions_cle', table: 'fonctions', colonnes: 'module_id, cle' },
  { suffixe: 'modules_actif', table: 'modules', colonnes: 'actif, ordre' },
  { suffixe: 'captures_module', table: 'captures', colonnes: 'module_id, ordre' },
];

/** Colonnes réellement présentes, en minuscules. */
async function colonnesExistantes(db, pg, nomTable) {
  const lignes = await db.requete(
    pg
      ? 'SELECT column_name AS c FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?'
      : 'SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
    [nomTable],
  );
  return new Set(lignes.map((l) => String(l.c ?? l.C).toLowerCase()));
}

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
    if (!/duplicate key name|already exists/i.test(err.message)) throw err;
  }
}

async function principal() {
  const pg = estPostgres();
  console.log(`→ base ${process.env.DB_NAME} sur ${process.env.DB_HOST} (${pg ? 'PostgreSQL' : 'MySQL'})`);

  const db = await ouvrir();
  try {
    for (const def of modele(pg)) {
      const presentes = await colonnesExistantes(db, pg, def.nom);

      if (presentes.size === 0) {
        const corps = def.colonnes.map(([nom, type]) => `${nom} ${type}`).join(', ');
        await db.executer(`CREATE TABLE IF NOT EXISTS ${def.nom} (${corps})`);
        console.log(`✓ ${def.nom} créée (${def.colonnes.length} colonnes)`);
        continue;
      }

      // Table déjà là : on ne rattrape que ce qui manque. La clé primaire et
      // les contraintes d'unicité ne se rejouent pas en ALTER.
      const manquantes = def.colonnes.filter(([nom]) => !presentes.has(nom.toLowerCase()));
      if (manquantes.length === 0) {
        console.log(`• ${def.nom} à jour`);
        continue;
      }
      for (const [nom, type] of manquantes) {
        const propre = type.replace(/\s*(PRIMARY KEY|UNIQUE|AUTO_INCREMENT|NOT NULL)/gi, '').trim();
        await db.executer(`ALTER TABLE ${def.nom} ADD COLUMN ${nom} ${propre || 'TEXT'}`);
        console.log(`  + colonne ${def.nom}.${nom}`);
      }
    }

    for (const index of INDEX) await creerIndex(db, pg, index);

    // La table site ne contient qu'une ligne : on l'amorce si besoin.
    const lignes = await db.requete(`SELECT id FROM ${table('site')} LIMIT 1`);
    if (lignes.length === 0) {
      await db.executer(
        `INSERT INTO ${table('site')} (cta_texte, cta_url) VALUES (?, ?)`,
        ['Demander une démonstration', '#contact'],
      );
      console.log(`✓ ligne unique de ${table('site')} créée`);
    }

    console.log('\nSchéma à jour.');
  } finally {
    await db.fermer();
  }
}

/** Un refus d'accès est de loin l'erreur la plus fréquente : on donne la main. */
function conseil(message) {
  if (!/access denied|authentication failed|password/i.test(message)) return null;

  const base = process.env.DB_NAME || 'tfb_landing';
  const login = process.env.DB_LOGIN || 'tfb_landing';

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
    `  CREATE DATABASE IF NOT EXISTS \`${base}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `  CREATE USER IF NOT EXISTS '${login}'@'localhost' IDENTIFIED BY '<le DB_PASS du .env>';`,
    `  GRANT ALL PRIVILEGES ON \`${base}\`.* TO '${login}'@'localhost';`,
    '  FLUSH PRIVILEGES;',
    "Sinon, corriger DB_LOGIN, DB_NAME ou DB_PASS dans infra/.env.",
  ].join('\n');
}

principal().catch((err) => {
  console.error(`\n✗ Bootstrap interrompu : ${err.message}`);
  const aide = conseil(err.message);
  if (aide) console.error(`\n${aide}`);
  process.exit(1);
});
