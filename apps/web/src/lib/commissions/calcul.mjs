/**
 * Ce qu'un commercial touche sur un contrat signé.
 *
 * Pur et sans base de données : c'est le seul endroit de l'application qui
 * transforme le travail de quelqu'un en argent, il doit se lire et se tester
 * sans rien autour.
 *
 * Cinq règles, et chacune existe parce que son contraire coûte quelque chose.
 *
 *  1. **Seul un contrat signé commissionne.** Une offre peut être refusée,
 *     expirer, ou repartir en négociation. Commissionner sur une offre revient
 *     à payer sur une intention.
 *
 *  2. **Le récurrent se commissionne mois par mois**, au taux de l'ancienneté
 *     du contrat. C'est ce qui permet d'écrire « 90 % la première année, puis
 *     20 % » sans que la phrase ait deux lectures.
 *
 *  3. **Le ponctuel se commissionne une fois**, au mois 0. L'installation ne se
 *     revend pas tous les mois.
 *
 *  4. **Sans plan, rien n'est calculé — et on le dit.** Pas zéro : zéro se lit
 *     comme une décision, et il s'agit d'une omission. Un commercial qui a des
 *     contrats et pas de plan doit sauter aux yeux, pas se fondre dans un total.
 *
 *  5. **Les taux sont en points de base**, jamais en flottants. 9000 = 90,00 %.
 *     De l'argent calculé sur un flottant est de l'argent qui se contredit à la
 *     quatrième décimale.
 *
 * Une limite à connaître, et elle est dans le nom des choses : cette
 * application ne connaît pas les encaissements. Un contrat signé dit ce que le
 * client s'est engagé à payer, pas ce qu'il a payé. Tout ce que ce module
 * produit est donc une **projection** — le mot est repris tel quel dans les
 * écrans. Le jour où les paiements entrent ici, la règle « seul l'encaissé
 * commissionne » s'ajoutera ; d'ici là, prétendre le contraire serait payer sur
 * des factures que personne n'a vu rentrer.
 */

/** 9000 → « 90 % », 1550 → « 15,5 % ». */
export function afficherTaux(pointsDeBase) {
  const pourcent = Number(pointsDeBase || 0) / 100;
  return `${pourcent.toLocaleString('fr-BE', { maximumFractionDigits: 2 })} %`;
}

/**
 * Les paliers d'un plan, triés et nettoyés.
 *
 * Deux paliers au même mois sont refusés plutôt que départagés : l'échelle
 * dépendrait alors de l'ordre des lignes en base, qui n'est pas une décision
 * commerciale.
 */
export function paliersOrdonnes(paliers) {
  const propres = [];
  for (const p of paliers || []) {
    const depuis = Number(p.depuis_mois);
    const taux = Number(p.taux_bp);
    if (!Number.isInteger(depuis) || depuis < 0) {
      throw new Error('Un palier commence à un nombre entier de mois, zéro compris.');
    }
    if (!Number.isInteger(taux) || taux < 0 || taux > 10_000) {
      throw new Error('Un taux s’écrit en points de base, entre 0 et 10000 (9000 = 90 %).');
    }
    if (propres.some((q) => q.depuis_mois === depuis)) {
      throw new Error(`Deux paliers commencent au mois ${depuis} — l’échelle dépendrait de l’ordre des lignes.`);
    }
    propres.push({ depuis_mois: depuis, taux_bp: taux });
  }
  return propres.sort((a, b) => a.depuis_mois - b.depuis_mois);
}

/**
 * Le taux en vigueur au mois donné : le palier le plus haut qui ne le dépasse
 * pas. `null` quand aucun ne le couvre.
 *
 * Un plan dont l'échelle démarre après le mois 0 laisse un trou, et le trou est
 * rendu tel quel plutôt que comblé par le taux voisin : deviner ici, c'est
 * payer un pourcentage que personne n'a négocié.
 */
export function tauxAuMois(paliers, mois) {
  let retenu = null;
  for (const p of paliers) {
    if (p.depuis_mois <= mois) retenu = p;
    else break;
  }
  return retenu ? retenu.taux_bp : null;
}

/** Centimes × points de base, arrondi une seule fois, à la fin. */
export function appliquer(cents, pointsDeBase) {
  return Math.round((Number(cents) || 0) * Number(pointsDeBase || 0) / 10_000);
}

/** Les raisons pour lesquelles une ligne ne vaut rien, dites en français. */
export const RAISONS = {
  ok: 'projetée',
  non_signe: 'contrat non signé — rien n’est dû tant que rien n’est engagé',
  sans_plan: 'aucun plan de commission sur ce commercial — rien n’est calculé',
  plan_vide: 'plan sans palier — rien n’est calculé',
  sans_duree: 'durée du contrat inconnue — le récurrent ne peut pas être projeté',
  sans_montant: 'ce contrat ne porte aucun montant',
};

/**
 * La commission projetée d'un contrat, mois par mois.
 *
 * @param {object} contrat        `{ statut, duree_mois }`
 * @param {object} montants       `{ unique_cents, mensuel_cents }`
 * @param {Array}  paliers        déjà passés par `paliersOrdonnes`
 * @returns `{ total_cents, lignes, raison }` — `total_cents` vaut `null`, jamais
 *          zéro, dès que la raison n'est pas `ok`.
 */
export function commissionContrat(contrat, montants, paliers) {
  const rien = (raison) => ({ total_cents: null, lignes: [], raison });

  if (contrat?.statut !== 'signe') return rien('non_signe');
  if (!paliers) return rien('sans_plan');
  if (paliers.length === 0) return rien('plan_vide');

  const unique = Number(montants?.unique_cents) || 0;
  const mensuel = Number(montants?.mensuel_cents) || 0;
  if (unique === 0 && mensuel === 0) return rien('sans_montant');

  const duree = Number(contrat?.duree_mois) || 0;
  if (mensuel > 0 && duree <= 0) return rien('sans_duree');

  const lignes = [];
  let total = 0;

  // Le ponctuel : une fois, au mois 0. Il suit le taux de départ, comme le
  // reste — un plan qui démarre après le mois 0 ne le commissionne donc pas.
  if (unique > 0) {
    const taux = tauxAuMois(paliers, 0);
    const montant = taux === null ? null : appliquer(unique, taux);
    lignes.push({ mois: 0, nature: 'unique', base_cents: unique, taux_bp: taux, montant_cents: montant });
    if (montant !== null) total += montant;
  }

  // Le récurrent : une ligne par mois du contrat. Le taux change avec
  // l'ancienneté, et un mois sans palier ne vaut rien plutôt que le taux d'à
  // côté.
  for (let mois = 0; mois < duree && mensuel > 0; mois += 1) {
    const taux = tauxAuMois(paliers, mois);
    const montant = taux === null ? null : appliquer(mensuel, taux);
    lignes.push({ mois, nature: 'mensuel', base_cents: mensuel, taux_bp: taux, montant_cents: montant });
    if (montant !== null) total += montant;
  }

  // Toutes les lignes sans taux : le plan ne couvre pas la durée du contrat.
  // Le total reste calculé sur ce qui l'est, et l'écran montre les trous.
  if (lignes.every((l) => l.montant_cents === null)) return rien('plan_vide');

  return { total_cents: total, lignes, raison: 'ok' };
}

/**
 * Le résumé d'un plan pour un écran : « 90 % puis 20 % à partir du mois 12 ».
 *
 * Écrit à partir des paliers et non saisi à côté d'eux : une phrase recopiée à
 * la main finit toujours par décrire un plan qui a changé depuis.
 */
export function resumerPlan(paliers) {
  if (!paliers || paliers.length === 0) return 'aucun palier';
  return paliers
    .map((p, i) => (i === 0 && p.depuis_mois === 0
      ? afficherTaux(p.taux_bp)
      : `${afficherTaux(p.taux_bp)} à partir du mois ${p.depuis_mois}`))
    .join(', puis ');
}
