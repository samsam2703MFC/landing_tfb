#!/usr/bin/env node
/**
 * Inventaire de la base : ce qui existe déjà, et ce qu'on peut réutiliser.
 *
 * La base porte les tables de deux générations du site — les `tfb_*` de la
 * version précédente (langues, traductions, captures) et les `landing_*` de
 * celle-ci. Ce script les liste sans rien modifier : uniquement des SELECT.
 *
 * Usage : node inspect-db.mjs
 */

import { estPostgres, ouvrir } from './lib/db.mjs';

/** Tables dont le contenu nous intéresse, avec ce qu'on veut en voir. */
const SONDAGES = [
  { table: 'tfb_languages', colonnes: '*', limite: 20 },
  { table: 'tfb_modules', colonnes: 'id, `key`, slug, module_group, icon, is_active, sort_order', limite: 20 },
  { table: 'tfb_module_features', colonnes: 'id, module_id, `key`, icon, sort_order', limite: 8 },
  { table: 'tfb_module_screenshots', colonnes: 'id, module_id, feature_id, file_path, sort_order', limite: 12 },
  { table: 'tfb_sections', colonnes: 'id, `key`, type, is_active, sort_order', limite: 20 },
  { table: 'tfb_brands', colonnes: 'id, name, slug, logo_path, is_active', limite: 10 },
  { table: 'tfb_settings', colonnes: '*', limite: 20 },
];

async function principal() {
  const db = await ouvrir();
  const pg = estPostgres();

  try {
    // 1. Toutes les tables de la base
    const tables = await db.requete(
      pg
        ? "SELECT tablename AS nom FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
        : 'SELECT table_name AS nom FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name',
    );
    const noms = tables.map((t) => t.nom || t.NOM);
    console.log(`\n════ ${noms.length} tables dans ${process.env.DB_NAME} ════`);

    for (const nom of noms) {
      let n = '?';
      try {
        const [ligne] = await db.requete(`SELECT COUNT(*) AS n FROM \`${nom}\``.replace(/`/g, pg ? '"' : '`'));
        n = ligne.n ?? ligne.N ?? '?';
      } catch {
        n = 'illisible';
      }
      console.log(`  ${String(n).padStart(6)}  ${nom}`);
    }

    // 2. Contenu des tables réutilisables
    for (const sondage of SONDAGES) {
      if (!noms.includes(sondage.table)) continue;
      const colonnes = pg ? sondage.colonnes.replace(/`/g, '"') : sondage.colonnes;
      console.log(`\n──── ${sondage.table} ────`);
      try {
        const lignes = await db.requete(
          `SELECT ${colonnes} FROM ${sondage.table} LIMIT ${sondage.limite}`,
        );
        for (const ligne of lignes) console.log('  ' + JSON.stringify(ligne));
      } catch (err) {
        console.log(`  (illisible : ${err.message})`);
      }
    }

    // 3. Les traductions : quels champs, quelles langues, combien
    if (noms.includes('tfb_translations')) {
      console.log('\n──── tfb_translations : langues ────');
      const parLangue = await db.requete(
        'SELECT language_code, COUNT(*) AS n FROM tfb_translations GROUP BY language_code ORDER BY n DESC',
      );
      for (const l of parLangue) console.log('  ' + JSON.stringify(l));

      console.log('\n──── tfb_translations : champs par type ────');
      const parChamp = await db.requete(
        `SELECT entity_type, field, COUNT(*) AS n FROM tfb_translations
         GROUP BY entity_type, field ORDER BY entity_type, field LIMIT 60`,
      );
      for (const c of parChamp) console.log('  ' + JSON.stringify(c));

      console.log('\n──── tfb_translations : trois exemples ────');
      const exemples = await db.requete(
        "SELECT entity_type, entity_id, field, language_code, LEFT(value, 90) AS extrait FROM tfb_translations LIMIT 3",
      );
      for (const e of exemples) console.log('  ' + JSON.stringify(e));
    }
  } finally {
    await db.fermer();
  }
}

principal().catch((err) => {
  console.error(`\n✗ Inspection interrompue : ${err.message}`);
  process.exit(1);
});
