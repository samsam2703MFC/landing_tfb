/**
 * Les propositions de catalogue — ce que produit l'assistant d'import.
 *
 * Une proposition est **inerte** : elle est stockée, listée et relue, et aucune
 * route ne la sert. Elle ne devient réelle que lorsque quelqu'un colle l'entrée
 * générée dans `catalogue.mjs` et qu'elle passe en revue. Cet écart est
 * délibéré : c'est lui qui empêche « généré » de vouloir dire « en production ».
 *
 * On pourrait servir directement les propositions, et ce serait le mauvais
 * échange : la déclaration d'une ressource est exactement le genre de chose
 * qu'on veut voir dans une diff, avec un auteur et une date, plutôt que dans
 * une ligne de base que personne ne relit.
 */

import { connexion, lireJson, table, viderCache } from '../db.mjs';
import { controlerRessource, estIdentifiant } from './catalogue.mjs';

/** Contrôle d'une proposition : le même que celui d'une entrée du catalogue. */
export function controlerProposition(p) {
  if (!p || !estIdentifiant(p.source)) return 'Source invalide.';
  return controlerRessource(p.cle, {
    source: p.vue || p.source,
    colonnes: p.colonnes,
    filtres: p.filtres,
    triables: p.triables,
    maxLignes: p.maxLignes,
    colonneClient: p.colonneClient,
  });
}

export async function listerPropositions() {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT id, cle, source, source_genre, vue, colonnes, filtres, triables, max_lignes,
            colonne_client, cree_le, cree_par
       FROM ${table('catalogue_propositions')} ORDER BY id DESC`,
    [],
  );
  return lignes.map((l) => ({
    id: Number(l.id),
    cle: l.cle,
    source: l.source,
    sourceGenre: l.source_genre,
    vue: l.vue,
    colonnes: lireJson(l.colonnes, []) || [],
    filtres: lireJson(l.filtres, {}) || {},
    triables: lireJson(l.triables, []) || [],
    maxLignes: Number(l.max_lignes || 0),
    colonneClient: l.colonne_client,
    creeLe: l.cree_le,
    creePar: l.cree_par,
  }));
}

/**
 * Enregistre une proposition. La même clé deux fois remplace la précédente :
 * un relecteur doit voir l'intention la plus récente, pas deux versions dont il
 * lui faudrait deviner laquelle compte.
 */
export async function ajouterProposition(p, creePar = null) {
  const souci = controlerProposition(p);
  if (souci) return { ok: false, erreur: souci };

  const db = await connexion();
  await db.executer(`DELETE FROM ${table('catalogue_propositions')} WHERE cle = ?`, [p.cle]);
  await db.executer(
    `INSERT INTO ${table('catalogue_propositions')}
       (cle, source, source_genre, vue, colonnes, filtres, triables, max_lignes, colonne_client, cree_le, cree_par)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.cle, p.source, p.sourceGenre || 'table', p.vue,
      JSON.stringify(p.colonnes), JSON.stringify(p.filtres || {}), JSON.stringify(p.triables || []),
      Number(p.maxLignes), p.colonneClient, new Date().toISOString(), creePar || null,
    ],
  );
  viderCache();
  return { ok: true };
}

export async function retirerProposition(cle) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('catalogue_propositions')} WHERE cle = ?`, [String(cle)]);
  viderCache();
}

/**
 * L'entrée telle qu'elle se lira dans `catalogue.mjs` — ce qu'un relecteur voit
 * dans la diff. C'est le livrable de l'assistant : pas une route, du code à
 * relire.
 */
export function codeProposition(p) {
  const filtres = Object.entries(p.filtres || {})
    .filter(([, ops]) => ops && ops.length > 0)
    .map(([colonne, ops]) => `      ${colonne}: [${ops.map((o) => `'${o}'`).join(', ')}],`)
    .join('\n');

  return [
    `  '${p.cle}': {`,
    `    version: 1,`,
    `    libelle: '…',`,
    `    source: '${p.vue}',`,
    `    colonnes: [${p.colonnes.map((c) => `'${c}'`).join(', ')}],`,
    filtres ? `    filtres: {\n${filtres}\n    },` : `    filtres: {},`,
    `    triables: [${(p.triables || []).map((c) => `'${c}'`).join(', ')}],`,
    `    maxLignes: ${p.maxLignes},`,
    `    colonneClient: '${p.colonneClient}',`,
    `  },`,
  ].join('\n');
}
