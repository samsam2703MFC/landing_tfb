/**
 * Construction des liens internes.
 *
 * La landing peut être servie à la racine d'un domaine ou sous un chemin
 * (ex. https://serveur/landing/). Astro expose ce préfixe dans
 * `import.meta.env.BASE_URL`, figé au build depuis `BASE_PATH`.
 *
 * Tous les liens et ancres du site passent par `lien()` : écrire « /modules/x »
 * en dur casserait le site dès qu'il n'est plus à la racine.
 */

/** Préfixe normalisé, sans barre oblique finale. '' quand on est à la racine. */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/**
 * @param {string} chemin  chemin absolu du site, ex. '/modules/consultant' ou '/#contact'
 * @returns {string}       le même chemin préfixé du point de montage
 */
export function lien(chemin = '/') {
  if (!chemin.startsWith('/')) return chemin; // liens externes, mailto:, #ancre
  // La racine doit rester une barre oblique, pas une chaîne vide.
  return `${BASE}${chemin}` || '/';
}
