#!/usr/bin/env node
/**
 * Les offres qui dorment, et le commercial qu'on prévient.
 *
 * À passer en tâche planifiée, une fois par jour :
 *
 *   0 7 * * 1-5  cd /var/www/landing_tfb && node pipeline/relances.mjs
 *
 * Le calcul de « faut-il relancer » n'est pas ici : il vit dans
 * `apps/web/src/lib/offres/relances.mjs`, séparé de la base et de l'envoi,
 * parce que c'est la seule partie qui peut se tromper sans qu'on s'en
 * aperçoive — une relance qui ne part pas ne fait pas de bruit.
 *
 * Ce script ne relance jamais deux fois pour le même silence : la date du
 * dernier réveil est écrite sur l'offre, et remise à zéro quand l'offre
 * change d'étape. Sans cette règle, une offre oubliée écrirait tous les jours
 * au commercial, qui cesserait de lire au bout de trois.
 *
 * Usage :
 *   node relances.mjs              envoie ce qui est dû
 *   node relances.mjs --a-blanc    dit ce qui partirait, n'écrit rien
 */

import { aRelancer } from '../apps/web/src/lib/offres/relances.mjs';
import { serviceCourriel } from '../apps/web/src/lib/offres/courriel.mjs';
import { ouvrir, table } from './lib/db.mjs';

const A_BLANC = process.argv.includes('--a-blanc');

/** Le message envoyé au commercial. Court : il doit se lire sur un téléphone. */
function message({ offre, etape, dort, destinataire }) {
  const client = offre.raison_sociale || 'client inconnu';
  return {
    destinataire,
    sujet: `${offre.reference} — ${client} n'a pas bougé depuis ${dort} jours`,
    corps: [
      `L'offre ${offre.reference} (${client}) est à l'étape « ${etape.nom} » depuis ${dort} jours.`,
      '',
      etape.description ? `${etape.description}` : '',
      '',
      offre.contact_nom
        ? `Contact : ${offre.contact_nom}${offre.contact_email ? ` — ${offre.contact_email}` : ''}`
        : '',
      '',
      'Cette relance ne se répétera pas tant que l’offre n’aura pas changé d’étape.',
    ].filter((l) => l !== null).join('\n'),
  };
}

async function principal() {
  const db = await ouvrir();
  try {
    const etapes = await db.requete(`SELECT * FROM ${table('etapes')}`);
    const parCle = new Map(etapes.map((e) => [e.cle, {
      ...e,
      relance_active: Boolean(e.relance_active),
      relance_jours: Number(e.relance_jours) || 0,
    }]));

    const offres = await db.requete(
      `SELECT o.*, p.raison_sociale, p.contact_nom, p.contact_email,
              u.nom AS auteur_nom, u.identifiant AS auteur_identifiant
       FROM ${table('offres')} o
       LEFT JOIN ${table('prospects')} p ON p.id = o.prospect_id
       LEFT JOIN ${table('utilisateurs')} u ON u.id = o.cree_par
       WHERE o.statut NOT IN ('acceptee', 'refusee')
         -- Une seule ligne par référence, à sa dernière version : sans cela,
         -- une offre renégociée deux fois écrit trois fois au commercial pour
         -- la même négociation.
         AND o.version = (
           SELECT MAX(v.version) FROM ${table('offres')} v WHERE v.reference = o.reference
         )
       ORDER BY o.etape_le, o.id`,
    );

    const service = serviceCourriel();
    const maintenant = new Date();
    let dues = 0;
    let parties = 0;
    let sansDestinataire = 0;

    for (const offre of offres) {
      const etape = parCle.get(offre.etape);
      const { relancer, dort } = aRelancer(offre, etape, maintenant);
      if (!relancer) continue;
      dues += 1;

      // L'identifiant d'un compte est une adresse de courriel dans les faits,
      // mais rien ne l'impose : sans arobase, on ne devine pas.
      const destinataire = String(offre.auteur_identifiant || '');
      if (!destinataire.includes('@')) {
        sansDestinataire += 1;
        console.log(`  ~ ${offre.reference} : ${dort} j, mais son commercial n'a pas d'adresse`);
        continue;
      }

      const lettre = message({ offre, etape, dort, destinataire });
      if (A_BLANC) {
        console.log(`  → ${offre.reference} : ${dort} j, à ${destinataire}`);
        continue;
      }

      await service.envoyer(lettre);
      await db.executer(
        `UPDATE ${table('offres')} SET relance_le = ? WHERE id = ?`,
        [maintenant, offre.id],
      );
      await db.executer(
        `INSERT INTO ${table('suivi')} (offre_id, quand, utilisateur_id, type, texte)
         VALUES (?, ?, ?, ?, ?)`,
        [offre.id, maintenant, null, 'relance', `Relance envoyée à ${destinataire} — ${dort} j sans mouvement`],
      );
      parties += 1;
      console.log(`  ✓ ${offre.reference} : ${dort} j, à ${destinataire}`);
    }

    console.log(
      `\n${offres.length} offre(s) en cours, ${dues} relance(s) due(s)` +
        (A_BLANC ? ' — rien envoyé, essai à blanc.' : `, ${parties} envoyée(s).`),
    );
    if (sansDestinataire > 0) {
      console.log(
        `${sansDestinataire} offre(s) sans adresse de commercial : renseignez un courriel ` +
          "comme identifiant sur l'écran Comptes.",
      );
    }
    if (!A_BLANC && parties > 0 && !service.expedie) {
      console.log(
        `\nATTENTION — aucun service de courriel n'est configuré : les ${parties} message(s) ` +
          'sont dans le journal du serveur et ne sont partis nulle part.',
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
