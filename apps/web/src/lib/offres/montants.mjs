/**
 * La traduction entre ce qu'un humain tape et ce que la base stocke.
 *
 * En base, tout est entier : les montants en centimes, les taux en centièmes
 * de point. À l'écran, personne ne saisit « 100000 » pour mille euros ni
 * « 2100 » pour 21 %. Ces deux conversions sont donc le seul endroit où
 * l'erreur peut entrer, et c'est pourquoi elles vivent ici, seules et testées,
 * plutôt qu'éparpillées dans chaque formulaire.
 *
 * Ce qui est accepté à la saisie : l'espace des milliers (y compris
 * l'insécable que produit un copier-coller depuis un tableur), la virgule
 * comme le point décimal, le symbole de la devise. Ce qui est refusé : le
 * vide, le négatif, et tout ce qui n'est pas un nombre — un champ prix laissé
 * à « environ 1000 » doit arrêter l'enregistrement, pas valoir zéro.
 */

/** Une erreur de saisie, avec le nom du champ pour que l'écran sache le dire. */
export class SaisieInvalide extends Error {
  constructor(champ, raison) {
    super(`« ${champ} » : ${raison}`);
    this.champ = champ;
  }
}

/**
 * Nettoie une saisie numérique et la rend en nombre décimal.
 * @throws {SaisieInvalide}
 */
function nombre(saisie, champ) {
  const brut = String(saisie ?? '').trim();
  if (brut === '') throw new SaisieInvalide(champ, 'valeur manquante');

  // Le symbole, puis les espaces — `\s` couvre déjà l'insécable U+00A0 et le
  // fin U+202F que collent Excel et LibreOffice — puis la virgule décimale.
  const propre = brut.replace(/[€$£\s]/g, '').replace(',', '.');

  if (!/^\d+(\.\d+)?$/.test(propre)) {
    throw new SaisieInvalide(champ, `« ${brut} » n'est pas un nombre positif`);
  }
  const n = Number(propre);
  if (!Number.isFinite(n)) throw new SaisieInvalide(champ, `« ${brut} » n'est pas un nombre`);
  return n;
}

/**
 * « 1 000,50 € » → 100050 centimes.
 *
 * L'arrondi est fait au centime : une saisie à trois décimales est tranchée
 * ici plutôt que de traîner un demi-centime jusqu'au total.
 */
export function enCents(saisie, champ = 'montant') {
  return Math.round(nombre(saisie, champ) * 100);
}

/** 100050 → « 1000.50 », de quoi remplir un champ de formulaire. */
export function depuisCents(cents) {
  return ((Number(cents) || 0) / 100).toFixed(2);
}

/**
 * « 21 » ou « 7,5 » → 2100 / 750 centièmes de point.
 *
 * Un taux au-delà de 100 % est refusé : c'est toujours une saisie en points
 * là où on attendait des pourcents, et le laisser passer facturerait 2 100 %
 * de TVA sans que rien ne le signale.
 */
export function enPoints(saisie, champ = 'taux') {
  const n = nombre(saisie, champ);
  if (n > 100) throw new SaisieInvalide(champ, `${n} % — un taux ne dépasse pas 100`);
  return Math.round(n * 100);
}

/** 2100 → « 21 », 750 → « 7.5 ». */
export function depuisPoints(points) {
  return String((Number(points) || 0) / 100);
}

/** Un compte : jours de formation, nombre de vues, multiplicateur. */
export function enEntier(saisie, champ = 'nombre') {
  const n = nombre(saisie, champ);
  if (!Number.isInteger(n)) throw new SaisieInvalide(champ, `${n} — un nombre entier est attendu`);
  return n;
}

/**
 * Lit une valeur de `landing_tarifs` selon son type déclaré.
 * Le type est stocké à côté de la valeur : rien n'est deviné.
 */
export function lireTarif(ligne) {
  if (!ligne) return null;
  if (ligne.type === 'texte') return String(ligne.valeur ?? '');
  const n = Number(ligne.valeur);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/** La saisie affichée pour un tarif, selon son type. */
export function afficherTarif(ligne) {
  if (!ligne) return '';
  if (ligne.type === 'cents') return depuisCents(ligne.valeur);
  if (ligne.type === 'points') return depuisPoints(ligne.valeur);
  return String(ligne.valeur ?? '');
}

/** La conversion inverse, à l'enregistrement. */
export function saisirTarif(ligne, saisie) {
  if (ligne.type === 'cents') return String(enCents(saisie, ligne.libelle || ligne.cle));
  if (ligne.type === 'points') return String(enPoints(saisie, ligne.libelle || ligne.cle));
  if (ligne.type === 'entier') return String(enEntier(saisie, ligne.libelle || ligne.cle));
  return String(saisie ?? '');
}
