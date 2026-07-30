/**
 * Sous-chemin sous lequel l'app est servie, par ex. `/landing_tfb`.
 * Vide = servie à la racine du domaine.
 *
 * Il faut le lire ici, et pas seulement le déclarer dans next.config, parce que
 * `basePath` ne réécrit que ce que Next contrôle : `<Link>`, `next/image`, le
 * routeur. Tout le reste — `fetch()`, les `<img src>` en dur, les masques CSS
 * des icônes — pointerait sur la racine du domaine et renverrait 404.
 *
 * NEXT_PUBLIC_ est nécessaire : la valeur est inlinée au build pour que les
 * composants clients l'aient aussi.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Préfixe un chemin absolu du site. `asset('/brand/logo.png')` → `/landing_tfb/brand/logo.png`. */
export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}
