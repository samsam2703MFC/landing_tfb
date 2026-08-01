#!/usr/bin/env node
/**
 * Récupère les copies d'écran des dépôts modules et les met à disposition
 * de la landing.
 *
 * Chaque dépôt publie ses captures dans `docs/landing/*.png`. Elles sont
 * téléchargées dans `apps/web/public/captures/<slug>/`, donc servies comme
 * ressources statiques après le build — pas de route de fichiers à écrire, pas
 * de binaire en base.
 *
 * Le nom du fichier sert de rattachement : `consultant-checklists.png` est
 * rapproché de la fonction dont la clé est « checklists ». À défaut, la
 * capture reste attachée au module.
 *
 * Usage : node sync-captures.mjs [--force]
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ouvrir, table } from './lib/db.mjs';
import { jetonGithub } from './lib/repo.mjs';
import { chargerRegistre } from './ingest.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE_PUBLIQUE = resolve(ICI, '..', 'apps', 'web', 'public', 'captures');
const API = 'https://api.github.com';

/** Appel GitHub, jeton optionnel. */
async function github(chemin, token, brut = false, sansJeton = false) {
  const reponse = await fetch(`${API}${chemin}`, {
    headers: {
      Accept: brut ? 'application/vnd.github.raw' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'landing-tfb-pipeline',
      ...(token && !sansJeton ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  // Un jeton refusé ne doit pas masquer un dépôt public : on réessaie nu.
  if (reponse.status === 401 && token && !sansJeton) return github(chemin, token, brut, true);
  if (reponse.status === 404) return null;
  if (!reponse.ok) throw new Error(`GitHub ${chemin} → ${reponse.status}`);
  return brut ? Buffer.from(await reponse.arrayBuffer()) : reponse.json();
}

/**
 * Devine à quelle fonction se rattache une capture, à partir de son nom.
 * `franchisor-catalogue.png` avec une fonction « catalogue » → rattachée.
 */
function rattacher(fichier, clesFonctions) {
  const base = fichier.replace(/\.[a-z]+$/i, '').toLowerCase();
  // On teste la clé la plus longue d'abord : « checklists » avant « check ».
  const triees = [...clesFonctions].sort((a, b) => b.length - a.length);
  return triees.find((cle) => base.endsWith(`-${cle}`) || base === cle) || null;
}

/** Un titre lisible à partir du nom de fichier, faute de mieux. */
function titre(fichier) {
  return fichier
    .replace(/\.[a-z]+$/i, '')
    .split('-')
    .slice(1)
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase()) || null;
}

async function principal() {
  const force = process.argv.includes('--force');
  const token = jetonGithub();
  const registre = await chargerRegistre();
  const db = await ouvrir();

  let total = 0;
  let modulesTouches = 0;

  try {
    for (const entree of registre) {
      const modules = await db.requete(
        `SELECT id FROM ${table('modules')} WHERE slug = ? LIMIT 1`,
        [entree.slug],
      );
      if (modules.length === 0) {
        console.log(`· ${entree.slug} : absent de la base, ignoré`);
        continue;
      }
      const moduleId = modules[0].id;

      // Le dossier de captures du dépôt.
      const contenu = await github(
        `/repos/${entree.repo}/contents/docs/landing?ref=${encodeURIComponent(entree.ref)}`,
        token,
      );
      const images = (contenu || []).filter(
        (f) => f.type === 'file' && /\.(png|jpe?g|webp)$/i.test(f.name),
      );

      if (images.length === 0) {
        console.log(`· ${entree.slug} : aucune capture publiée`);
        continue;
      }

      const fonctions = await db.requete(
        `SELECT cle FROM ${table('fonctions')} WHERE module_id = ?`,
        [moduleId],
      );
      const cles = fonctions.map((f) => f.cle);

      const dossier = resolve(RACINE_PUBLIQUE, entree.slug);
      if (force) await rm(dossier, { recursive: true, force: true });
      await mkdir(dossier, { recursive: true });

      /**
       * L'empreinte git d'un fichier local, au format que renvoie l'API
       * GitHub. C'est ce qui permet de savoir si l'image du dépôt a changé.
       *
       * Comparer les seules présences ne suffisait pas : une capture reprise
       * avec une anonymisation plus stricte gardait le même nom, donc
       * l'ancienne version restait sur le serveur indéfiniment.
       */
      const empreinteLocale = async (chemin) => {
        const octets = await readFile(chemin).catch(() => null);
        if (!octets) return null;
        return createHash('sha1')
          .update(Buffer.concat([Buffer.from(`blob ${octets.length}\0`), octets]))
          .digest('hex');
      };

      // On repart d'une table propre pour ce module : les captures retirées
      // du dépôt doivent disparaître du site.
      await db.executer(`DELETE FROM ${table('captures')} WHERE module_id = ?`, [moduleId]);

      let ordre = 1;
      for (const image of images.sort((a, b) => a.name.localeCompare(b.name))) {
        const surDisque = await empreinteLocale(resolve(dossier, image.name));
        if (surDisque !== image.sha || force) {
          const octets = await github(
            `/repos/${entree.repo}/contents/docs/landing/${encodeURIComponent(image.name)}?ref=${encodeURIComponent(entree.ref)}`,
            token,
            true,
          );
          if (!octets) continue;
          await writeFile(resolve(dossier, image.name), octets);
        }

        await db.executer(
          `INSERT INTO ${table('captures')} (module_id, fonction_cle, fichier, titre, ordre)
           VALUES (?, ?, ?, ?, ?)`,
          [moduleId, rattacher(image.name, cles), `${entree.slug}/${image.name}`, titre(image.name), ordre],
        );
        ordre += 1;
        total += 1;
      }

      modulesTouches += 1;
      console.log(`✓ ${entree.slug.padEnd(20)} ${images.length} capture(s)`);
    }

    console.log(`\n${total} captures pour ${modulesTouches} modules.`);
  } finally {
    await db.fermer();
  }
}

principal().catch((err) => {
  console.error(`\n✗ Synchronisation des captures interrompue : ${err.message}`);
  process.exit(1);
});
