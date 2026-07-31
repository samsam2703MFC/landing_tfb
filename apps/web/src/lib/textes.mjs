/**
 * Les textes éditoriaux des pages — CÔTÉ SERVEUR UNIQUEMENT.
 *
 * Aucune phrase n'est écrite dans les gabarits : ils appellent `t('cle')`, et
 * la valeur vient de `landing_textes`, modifiable dans la console.
 *
 * Deux niveaux de repli, parce qu'un site ne doit jamais afficher un blanc :
 *   1. la base ;
 *   2. la valeur d'origine du dépôt (`pipeline/contenu-textes.mjs`), embarquée
 *      ici au build ;
 *   3. la clé elle-même, visible, pour qu'un oubli se repère tout de suite.
 */

import { chargerTextes } from './db.mjs';
import { TEXTES } from '../../../../pipeline/contenu-textes.mjs';

/** Les valeurs d'origine, indexées par clé. */
const ORIGINE = Object.fromEntries(TEXTES.map((t) => [t.cle, t.valeur]));

/**
 * Prépare le lecteur de textes d'une page.
 * On charge la table une fois, puis `t()` est synchrone : les gabarits Astro
 * restent lisibles, sans `await` à chaque phrase.
 */
export async function textes() {
  const lignes = await chargerTextes();
  const base = Object.fromEntries((lignes || []).map((l) => [l.cle, l.valeur]));

  return function t(cle) {
    const valeur = base[cle];
    if (valeur !== undefined && valeur !== null && String(valeur).trim() !== '') return valeur;
    return ORIGINE[cle] ?? cle;
  };
}
