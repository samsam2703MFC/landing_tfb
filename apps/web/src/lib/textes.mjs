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
export async function textes(langue = null) {
  const lignes = await chargerTextes(langue);
  const base = Object.fromEntries((lignes || []).map((l) => [l.cle, l.valeur]));

  /**
   * `t('accueil.modules.titre', { n: 13 })` remplace `{n}` dans la valeur.
   * C'est ce qui permet de garder une phrase entière en base — pluriel
   * compris — au lieu de la recomposer dans le gabarit.
   */
  return function t(cle, valeurs = null) {
    const brut = base[cle];
    const valeur =
      brut !== undefined && brut !== null && String(brut).trim() !== '' ? brut : ORIGINE[cle] ?? cle;
    if (!valeurs) return valeur;
    return String(valeur).replace(/\{(\w+)\}/g, (tout, nom) =>
      valeurs[nom] === undefined ? tout : String(valeurs[nom]),
    );
  };
}
