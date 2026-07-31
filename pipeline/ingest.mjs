#!/usr/bin/env node
/**
 * Ingestion d'un module : dépôt GitHub → contenu généré → Directus.
 *
 * Usage :
 *   node ingest.mjs consultant
 *   node ingest.mjs samsam2703MFC/pwa_consultant --force
 *   node ingest.mjs consultant --ref=develop --dry-run
 *
 * Options :
 *   --force      régénère même si le dépôt n'a pas bougé depuis la dernière fois
 *   --ref=<x>    branche à lire (défaut : celle de modules.json)
 *   --dry-run    n'écrit rien dans Directus, affiche le contenu produit
 *
 * Idempotence : le module est identifié par son `slug`, chaque fonction par le
 * couple (module, cle). Rejouer l'ingestion mène au même état, sans doublon.
 */

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { genererContenuModule, modele } from './lib/ai.mjs';
import { chargerDepot } from './lib/repo.mjs';
import { creerItem, lireItems, majItem, supprimerItems, upsertParCle } from './lib/directus.mjs';

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
 * Ne lève une erreur que si l'ingestion est réellement impossible — l'appelant
 * (ingest-all) peut ainsi continuer sur les autres modules.
 *
 * @returns {Promise<{slug, statut: 'ok'|'inchange', fonctions?: number, sha?: string}>}
 */
export async function ingererModule(entree, { force = false, ref = null, dryRun = false } = {}) {
  const branche = ref || entree.ref;
  console.log(`\n── ${entree.slug} (${entree.repo}@${branche})`);

  // 1. Lecture du dépôt
  const depot = await chargerDepot({
    repo: entree.repo,
    ref: branche,
    token: process.env.GH_INGEST_TOKEN,
  });
  console.log(`   dépôt lu : ${depot.arbre.length} fichiers, ${depot.extraits.length} extraits, sha ${depot.sha.slice(0, 8)}`);

  // 2. Le dépôt a-t-il bougé depuis la dernière ingestion ?
  let existant = null;
  if (!dryRun) {
    const trouves = await lireItems('modules', {
      'filter[slug][_eq]': entree.slug,
      fields: 'id,commit_sha',
      limit: 1,
    });
    existant = trouves && trouves.length ? trouves[0] : null;

    if (!force && existant && existant.commit_sha === depot.sha) {
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
  const { id: moduleId, cree } = await upsertParCle('modules', 'slug', entree.slug, {
    repo: entree.repo,
    ref: branche,
    groupe: entree.groupe,
    ordre: entree.ordre,
    actif: true,
    nom: contenu.nom,
    accroche: contenu.accroche,
    resume: contenu.resume,
    description: contenu.description,
    public_cible: contenu.public_cible,
    problemes: contenu.problemes,
    benefices: contenu.benefices,
    stack: contenu.stack,
    mots_cles: contenu.mots_cles,
    mermaid: contenu.mermaid,
    commit_sha: depot.sha,
    modele_ia: modele(),
    genere_le: new Date().toISOString(),
  });

  // 5. Écriture des fonctions, clé par clé
  const anciennes = await lireItems('fonctions', {
    'filter[module][_eq]': moduleId,
    fields: 'id,cle',
    limit: -1,
  });
  const parCle = new Map((anciennes || []).map((f) => [f.cle, f.id]));

  let position = 1;
  const clesVues = new Set();
  for (const fonction of contenu.fonctions) {
    const donnees = {
      module: moduleId,
      nom: fonction.nom,
      description: fonction.description,
      benefice: fonction.benefice,
      icone: fonction.icone,
      ordre: position,
    };
    // La clé n'est unique qu'à l'intérieur d'un module : on résout donc
    // l'identifiant à la main plutôt que par un upsert global.
    const idExistant = parCle.get(fonction.cle);
    if (idExistant) {
      await majItem('fonctions', idExistant, donnees);
    } else {
      await creerItem('fonctions', { ...donnees, cle: fonction.cle });
    }
    clesVues.add(fonction.cle);
    position += 1;
  }

  // 6. Les fonctions disparues du code disparaissent du site
  const obsoletes = (anciennes || []).filter((f) => !clesVues.has(f.cle)).map((f) => f.id);
  if (obsoletes.length) {
    await supprimerItems('fonctions', obsoletes);
    console.log(`   ${obsoletes.length} fonction(s) obsolète(s) supprimée(s)`);
  }

  console.log(`   ✓ module ${cree ? 'créé' : 'mis à jour'} (#${moduleId}), ${contenu.fonctions.length} fonctions`);
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

  await ingererModule(entree, options);
}

// Ne s'exécute que lancé directement (ingest-all importe les fonctions).
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  principal().catch((err) => {
    console.error(`\n✗ Ingestion interrompue : ${err.message}`);
    process.exit(1);
  });
}
