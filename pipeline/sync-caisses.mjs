#!/usr/bin/env node
/**
 * La synchronisation des caisses, à passer en tâche planifiée.
 *
 *   */5 * * * *  cd /var/www/landing_tfb && node pipeline/sync-caisses.mjs
 *
 * Toutes les cinq minutes : le script regarde ce qui est dû, prend le verrou,
 * travaille, rend le verrou. Une tâche dont l'heure n'est pas venue coûte une
 * requête et rien d'autre.
 *
 * Pas de file d'attente et pas de service à surveiller : une table, un verrou
 * à expiration, et le curseur en base. Un processus tué au milieu d'un import
 * ne laisse rien de bloqué — la tâche se libère seule au bout de trente
 * minutes, et reprend là où le curseur s'était arrêté.
 *
 * Usage :
 *   node sync-caisses.mjs              travaille
 *   node sync-caisses.mjs --a-blanc    dit ce qu'il ferait, n'écrit rien
 *   node sync-caisses.mjs --forcer 12  synchronise la connexion 12, tout de suite
 */

import {
  listerTaches,
  prendreVerrou,
  rendreVerrou,
  synchroniser,
} from '../apps/web/src/lib/admin/sync.mjs';
import { listerConnexions } from '../apps/web/src/lib/admin/onboarding.mjs';
import { ouvrir } from './lib/db.mjs';

const A_BLANC = process.argv.includes('--a-blanc');
const FORCER = (() => {
  const i = process.argv.indexOf('--forcer');
  return i >= 0 ? process.argv[i + 1] : null;
})();

/** Qui tient le verrou : de quoi savoir quelle machine travaille. */
const MOI = `${process.env.HOSTNAME || 'serveur'}:${process.pid}`;

/** La prochaine heure de passage : ce soir ou demain, à l'heure dite. */
function prochainPassage(tache) {
  const maintenant = new Date();
  const prochain = new Date(maintenant);
  prochain.setHours(Number(tache.heure_locale) || 5, 0, 0, 0);
  const frequence = Number(tache.frequence_heures) || 24;
  if (frequence < 24) {
    return new Date(maintenant.getTime() + frequence * 3600000);
  }
  if (prochain <= maintenant) prochain.setDate(prochain.getDate() + 1);
  return prochain;
}

async function principal() {
  const db = await ouvrir();
  try {
    const connexions = await listerConnexions({});
    const parId = new Map(connexions.map((c) => [c.id, c]));
    const taches = (await listerTaches()).filter((t) => t.active);
    const maintenant = new Date();

    const dues = FORCER
      ? taches.filter((t) => String(t.connexion_id) === String(FORCER))
      : taches.filter((t) => !t.prochain_le || new Date(t.prochain_le) <= maintenant);

    if (dues.length === 0) {
      console.log(`${taches.length} tâche(s) active(s), aucune due.`);
      return;
    }

    let faites = 0;
    let echecs = 0;
    for (const tache of dues) {
      const cx = parId.get(tache.connexion_id);
      const nom = cx ? `${cx.raison_sociale} · ${cx.libelle}` : `connexion ${tache.connexion_id}`;

      // Une connexion en pause ou en brouillon n'a rien à synchroniser : sa
      // tâche existe peut-être, mais elle attend qu'on la remette en marche.
      if (!cx || (cx.statut !== 'active' && !FORCER)) {
        console.log(`  ~ ${nom} : ${cx ? cx.statut : 'introuvable'}, on passe`);
        continue;
      }

      if (A_BLANC) {
        console.log(`  → ${nom} : synchroniserait depuis ${cx.derniere_sync_le || 'le début'}`);
        continue;
      }

      // Le verrou d'abord. S'il est pris, une autre exécution travaille déjà :
      // deux imports simultanés sur la même connexion ne casseraient rien —
      // l'unicité les rattraperait — mais doubleraient les appels à la caisse.
      if (!(await prendreVerrou(tache.id, MOI))) {
        console.log(`  ~ ${nom} : déjà en cours ailleurs`);
        continue;
      }

      try {
        const r = await synchroniser(tache.connexion_id, {
          rattrapageJours: Number(tache.rattrapage_jours) || 7,
          tacheId: tache.id,
        });
        if (r.ok) {
          faites += 1;
          console.log(
            `  ✓ ${nom} : ${r.compteurs.lues} lue(s), ${r.compteurs.inserees} écrite(s), `
            + `${r.compteurs.doublons} déjà connue(s), ${r.compteurs.rejetees} rejetée(s)`,
          );
        } else {
          echecs += 1;
          console.log(`  ✗ ${nom} : ${r.code} — ${r.message}`);
        }
      } catch (err) {
        echecs += 1;
        console.log(`  ✗ ${nom} : ${err.message}`);
      } finally {
        // Toujours rendre le verrou, même après une erreur : sans le `finally`,
        // un import qui plante bloque la connexion pendant trente minutes.
        await rendreVerrou(tache.id, prochainPassage(tache));
      }
    }

    console.log(
      `\n${dues.length} tâche(s) due(s)`
      + (A_BLANC ? ' — rien fait, essai à blanc.' : `, ${faites} réussie(s), ${echecs} en échec.`),
    );

    if (echecs > 0) {
      console.log(
        'Les connexions en échec gardent leur curseur : la prochaine exécution reprend où '
        + "celle-ci s'est arrêtée, sans redemander ce qui est déjà écrit.",
      );
    }
  } finally {
    await db.fermer();
  }
}

principal().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exitCode = 1;
});
