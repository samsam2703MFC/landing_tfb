#!/usr/bin/env node
/**
 * Ingestion d'un module : dépôt GitHub → contenu généré → base SQL.
 *
 * Usage :
 *   node ingest.mjs consultant
 *   node ingest.mjs samsam2703MFC/pwa_consultant --force
 *   node ingest.mjs consultant --ref=develop --dry-run
 *
 * Options :
 *   --force      régénère même si le dépôt n'a pas bougé depuis la dernière fois
 *   --ref=<x>    branche à lire (défaut : celle de modules.json)
 *   --dry-run    n'écrit rien en base, affiche le contenu produit
 *
 * Idempotence : le module est identifié par son `slug`, chaque fonction par le
 * couple (module_id, cle). Rejouer l'ingestion mène au même état, sans doublon.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { genererContenuModule, modele } from './lib/ai.mjs';
import { chargerDepot, jetonGithub } from './lib/repo.mjs';
import { json, ouvrir, table, upsert } from './lib/db.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const REGISTRE = resolve(ICI, '..', 'modules.json');

/** Lit modules.json et normalise chaque entrée. */
export async function chargerRegistre() {
  const brut = JSON.parse(await readFile(REGISTRE, 'utf8'));
  const defaut = brut.defaultRef || 'main';
  return (brut.modules || []).map((entree, index) => ({
    slug: entree.slug,
    repo: entree.repo,
    ref: entree.ref || defaut,
    groupe: entree.groupe || null,
    ordre: entree.ordre ?? index + 1,
  }));
}

/** Découpe les arguments de ligne de commande. */
function lireOptions(argv) {
  const options = { cible: null, force: false, ref: null, dryRun: false };
  for (const arg of argv) {
    if (arg === '--force') options.force = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg.startsWith('--ref=')) options.ref = arg.slice(6);
    else if (!arg.startsWith('-')) options.cible = arg;
  }
  return options;
}

/**
 * Ingère un module et renvoie un compte rendu.
 * `db` est fourni par l'appelant quand plusieurs modules se suivent, pour
 * n'ouvrir qu'une seule connexion.
 *
 * @returns {Promise<{slug, statut: 'ok'|'inchange', fonctions?: number, sha?: string}>}
 */
export async function ingererModule(entree, { force = false, ref = null, dryRun = false, db = null } = {}) {
  const branche = ref || entree.ref;
  console.log(`\n── ${entree.slug} (${entree.repo}@${branche})`);

  // 1. Lecture du dépôt
  const depot = await chargerDepot({
    repo: entree.repo,
    ref: branche,
    token: jetonGithub(),
  });
  console.log(`   dépôt lu : ${depot.arbre.length} fichiers, ${depot.extraits.length} extraits, sha ${depot.sha.slice(0, 8)}`);

  // 2. Le dépôt a-t-il bougé depuis la dernière ingestion ?
  if (!dryRun && db) {
    const trouves = await db.requete(
      `SELECT id, commit_sha FROM ${table('modules')} WHERE slug = ? LIMIT 1`,
      [entree.slug],
    );
    if (!force && trouves.length > 0 && trouves[0].commit_sha === depot.sha) {
      console.log('   inchangé depuis la dernière ingestion — ignoré (--force pour régénérer)');
      return { slug: entree.slug, statut: 'inchange' };
    }
  }

  // 3. Génération du contenu
  const contenu = await genererContenuModule({
    digest: depot.digest,
    repo: entree.repo,
    slug: entree.slug,
    groupe: entree.groupe,
  });
  console.log(`   contenu généré : ${contenu.fonctions.length} fonctions`);

  if (dryRun) {
    console.log(JSON.stringify(contenu, null, 2));
    return { slug: entree.slug, statut: 'ok', fonctions: contenu.fonctions.length, sha: depot.sha };
  }

  // 4. Écriture du module
  const { id: moduleId, cree } = await upsert(db, table('modules'), 'slug', entree.slug, {
    repo: entree.repo,
    ref: branche,
    groupe: entree.groupe,
    ordre: entree.ordre,
    // Même procédure que le seed : ce que le pipeline régénère repasse par
    // une relecture avant d'être publié.
    actif: false,
    statut: 'nouveau',
    nom: contenu.nom,
    accroche: contenu.accroche,
    resume: contenu.resume,
    description: contenu.description,
    public_cible: contenu.public_cible,
    problemes: json(contenu.problemes),
    benefices: json(contenu.benefices),
    stack: json(contenu.stack),
    mots_cles: json(contenu.mots_cles),
    mermaid: contenu.mermaid,
    commit_sha: depot.sha,
    modele_ia: modele(),
    genere_le: new Date(),
  });

  // 5. Écriture des fonctions, clé par clé
  const anciennes = await db.requete(
    `SELECT id, cle FROM ${table('fonctions')} WHERE module_id = ?`,
    [moduleId],
  );
  const parCle = new Map(anciennes.map((f) => [f.cle, f.id]));

  let position = 1;
  const clesVues = new Set();
  for (const fonction of contenu.fonctions) {
    const valeurs = [
      fonction.nom,
      fonction.description,
      fonction.benefice,
      fonction.icone,
      position,
      'nouveau',
      false,
    ];
    const idExistant = parCle.get(fonction.cle);
    if (idExistant) {
      await db.executer(
        `UPDATE ${table('fonctions')} SET nom = ?, description = ?, benefice = ?, icone = ?, ordre = ?, statut = ?, en_ligne = ? WHERE id = ?`,
        [...valeurs, idExistant],
      );
    } else {
      await db.executer(
        `INSERT INTO ${table('fonctions')} (module_id, cle, nom, description, benefice, icone, ordre, statut, en_ligne) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [moduleId, fonction.cle, ...valeurs],
      );
    }
    clesVues.add(fonction.cle);
    position += 1;
  }

  // 6. Les fonctions disparues du code disparaissent du site
  const obsoletes = anciennes.filter((f) => !clesVues.has(f.cle)).map((f) => f.id);
  if (obsoletes.length) {
    const marqueurs = obsoletes.map(() => '?').join(', ');
    await db.executer(`DELETE FROM ${table('fonctions')} WHERE id IN (${marqueurs})`, obsoletes);
    console.log(`   ${obsoletes.length} fonction(s) obsolète(s) supprimée(s)`);
  }

  console.log(
    `   ✓ module ${cree ? 'créé' : 'mis à jour'} (#${moduleId}), ${contenu.fonctions.length} fonctions — à valider dans la console`,
  );
  return { slug: entree.slug, statut: 'ok', fonctions: contenu.fonctions.length, sha: depot.sha };
}

async function principal() {
  const options = lireOptions(process.argv.slice(2));
  if (!options.cible) {
    console.error('Usage : node ingest.mjs <slug|org/depot> [--force] [--ref=branche] [--dry-run]');
    process.exit(2);
  }

  const registre = await chargerRegistre();
  const cible = options.cible.toLowerCase();
  const entree = registre.find(
    (m) => m.slug.toLowerCase() === cible || m.repo.toLowerCase() === cible,
  );

  if (!entree) {
    console.error(`✗ « ${options.cible} » est absent de modules.json.`);
    console.error(`  Modules connus : ${registre.map((m) => m.slug).join(', ')}`);
    process.exit(2);
  }

  const db = options.dryRun ? null : await ouvrir();
  try {
    await ingererModule(entree, { ...options, db });
  } finally {
    if (db) await db.fermer();
  }
}

// Ne s'exécute que lancé directement (ingest-all importe les fonctions).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  principal().catch((err) => {
    console.error(`\n✗ Ingestion interrompue : ${err.message}`);
    process.exit(1);
  });
}
