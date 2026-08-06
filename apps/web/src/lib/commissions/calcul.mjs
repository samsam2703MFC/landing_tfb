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

/* ------------------------------------------------------------- tranches -- */

/*
 * Un plan se **dit** en durées, et se **range** en mois cumulés.
 *
 * « 70 % pendant un an, puis 30 % » est la phrase que quelqu'un prononce en
 * négociant. « À partir du mois 12, 30 % » est la même chose vue par le
 * calcul, et c'est ce qui est stocké parce que c'est ce dont il a besoin.
 *
 * Une seule vérité en base, deux lectures. Stocker les deux garantirait
 * qu'elles se contredisent le jour où l'une est modifiée sans l'autre — et
 * personne ne saurait laquelle paie.
 *
 * Ce que les durées permettent et que les mois cumulés ne permettaient pas :
 * **que la commission s'arrête**. « 12 mois à 70 %, 24 mois à 30 %, puis plus
 * rien » n'était pas exprimable, le dernier palier courant indéfiniment. En
 * base, la fin est un dernier palier à 0 % — pas un trou, une décision.
 */

/**
 * Des tranches vers des paliers.
 *
 * @param {Array<{duree_mois: number|null, taux_bp: number|null}>} tranches
 *   Dans l'ordre. `duree_mois` vide sur la dernière = « pour le reste du
 *   contrat » ; renseignée = le plan s'arrête après elle. `taux_bp` vide =
 *   une période sans commission convenue, qui n'est pas la même chose que
 *   zéro pour cent — voir `tauxAuMois`.
 */
export function paliersDepuisTranches(tranches) {
  const paliers = [];
  let curseur = 0;
  const liste = (tranches || []).filter(
    (t) => t && (t.duree_mois !== '' || t.taux_bp !== '') && !(t.duree_mois == null && t.taux_bp == null),
  );

  liste.forEach((t, i) => {
    const dernier = i === liste.length - 1;
    const duree = t.duree_mois === null || t.duree_mois === '' || t.duree_mois === undefined
      ? null
      : Number(t.duree_mois);
    const taux = t.taux_bp === null || t.taux_bp === '' || t.taux_bp === undefined ? null : Number(t.taux_bp);

    if (duree !== null && (!Number.isInteger(duree) || duree <= 0)) {
      throw new Error('Une tranche dure un nombre entier de mois, au moins un.');
    }
    if (duree === null && !dernier) {
      throw new Error('Seule la dernière tranche peut courir sans fin : les autres ont une durée.');
    }
    // Un taux absent ne pose pas de palier : c'est une période que le plan ne
    // couvre pas, et le calcul la laisse à découvert au lieu de l'inventer.
    if (taux !== null) paliers.push({ depuis_mois: curseur, taux_bp: taux });
    if (duree === null) {
      curseur = null;
      return;
    }
    curseur += duree;
  });

  // Le plan s'arrête : on l'écrit, au lieu de laisser le dernier taux courir.
  if (curseur !== null && paliers.length > 0) {
    paliers.push({ depuis_mois: curseur, taux_bp: 0 });
  }
  return paliersOrdonnes(paliers);
}

/**
 * Des paliers vers des tranches — la lecture inverse, pour réafficher.
 *
 * Un dernier palier à 0 % ne devient pas une tranche : c'est la fin du plan,
 * et l'écran la montre comme telle.
 */
export function tranchesDepuisPaliers(paliers) {
  const propres = paliersOrdonnes(paliers || []);
  if (propres.length === 0) return { tranches: [], finit: false };

  // Le dernier palier à zéro est une fin, pas une tranche à zéro pour cent.
  const finit = propres.length > 1 && propres[propres.length - 1].taux_bp === 0;
  const utiles = finit ? propres.slice(0, -1) : propres;

  const tranches = [];
  // Un plan qui démarre après le mois 0 laisse un début sans taux. On le rend
  // tel quel : le combler ferait payer un pourcentage que personne n'a
  // négocié, et le taire ferait disparaître le trou de l'écran.
  if (utiles[0].depuis_mois > 0) {
    tranches.push({ duree_mois: utiles[0].depuis_mois, taux_bp: null });
  }
  utiles.forEach((p, i) => {
    const suivant = utiles[i + 1];
    const fin = suivant ? suivant.depuis_mois : (finit ? propres[propres.length - 1].depuis_mois : null);
    tranches.push({ duree_mois: fin === null ? null : fin - p.depuis_mois, taux_bp: p.taux_bp });
  });
  return { tranches, finit };
}

/**
 * Le résumé d'un plan pour un écran : « 70 % pendant 12 mois, puis 30 % ».
 *
 * Écrit à partir des paliers et non saisi à côté d'eux : une phrase recopiée à
 * la main finit toujours par décrire un plan qui a changé depuis.
 */
export function resumerPlan(paliers) {
  const { tranches, finit } = tranchesDepuisPaliers(paliers);
  if (tranches.length === 0) return 'aucune tranche';

  const dit = tranches.map((t) => {
    const taux = t.taux_bp === null ? 'rien' : afficherTaux(t.taux_bp);
    if (t.duree_mois === null) return taux;
    return `${taux} pendant ${moisDits(t.duree_mois)}`;
  });
  if (finit) dit.push('plus rien');
  return dit.join(', puis ');
}

/** « 12 mois » devient « 1 an » : c'est ainsi qu'on le dit à l'oral. */
function moisDits(mois) {
  const n = Number(mois) || 0;
  if (n === 12) return '1 an';
  if (n % 12 === 0) return `${n / 12} ans`;
  return `${n} mois`;
}
