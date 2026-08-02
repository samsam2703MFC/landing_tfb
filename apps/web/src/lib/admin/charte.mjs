/**
 * La charte d'un client : ce qui est édité, ce qui est servi, et l'historique.
 *
 * Deux lignes par prospect, `brouillon` et `publie`. Éditer ne change rien pour
 * le client ; publier recopie le brouillon, incrémente la version et écrit une
 * ligne de journal. C'est ce numéro de version que consomme tout cache en aval
 * pour savoir que sa copie a vieilli.
 *
 * Une clé absente des données vaut héritage. « Réinitialiser » la retire, il ne
 * stocke pas une valeur vide — sans quoi le défaut maison ne pourrait plus
 * jamais reprendre la main.
 */

import { connexion, lireJson, table, viderCache } from '../db.mjs';
import { controler, controlerCharte, valeursResolues } from '../charte/registre.mjs';

const BROUILLON = 'brouillon';
const PUBLIE = 'publie';

/** Le prospect « 0 » porte les défauts maison, au-dessus de ceux du registre. */
export const MAISON = 0;

function vide() {
  return { donnees: {}, version: 0, majLe: null, majPar: null };
}

function ligneVersCharte(ligne) {
  if (!ligne) return vide();
  const donnees = lireJson(ligne.donnees, {}) || {};
  return {
    donnees: donnees && typeof donnees === 'object' && !Array.isArray(donnees) ? donnees : {},
    version: Number(ligne.version || 0),
    majLe: ligne.maj_le || null,
    majPar: ligne.maj_par || null,
  };
}

async function lireEtat(prospectId, etat) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT donnees, version, maj_le, maj_par FROM ${table('charte')} WHERE prospect_id = ? AND etat = ? LIMIT 1`,
    [Number(prospectId), etat],
  );
  return ligneVersCharte(lignes[0]);
}

/**
 * `majLe` est passé explicitement, et vaut `null` sur le brouillon qu'on vient
 * de publier : c'est cette date qui dit « il reste quelque chose à publier ».
 * L'horodater systématiquement laisserait la console annoncer un brouillon en
 * attente juste après une publication, et le bouton « Publier » actif pour
 * republier à l'identique.
 */
async function ecrireEtat(prospectId, etat, { donnees, version, majPar, majLe = new Date().toISOString() }) {
  const db = await connexion();
  const json = JSON.stringify(donnees || {});
  const existant = await db.requete(
    `SELECT id FROM ${table('charte')} WHERE prospect_id = ? AND etat = ? LIMIT 1`,
    [Number(prospectId), etat],
  );
  if (existant[0]) {
    await db.executer(
      `UPDATE ${table('charte')} SET donnees = ?, version = ?, maj_le = ?, maj_par = ? WHERE id = ?`,
      [json, Number(version || 0), majLe, majPar || null, existant[0].id],
    );
  } else {
    await db.executer(
      `INSERT INTO ${table('charte')} (prospect_id, etat, donnees, version, maj_le, maj_par) VALUES (?, ?, ?, ?, ?, ?)`,
      [Number(prospectId), etat, json, Number(version || 0), majLe, majPar || null],
    );
  }
  viderCache();
}

export function chartePubliee(prospectId) {
  return lireEtat(prospectId, PUBLIE);
}

/** Le brouillon part du publié la première fois qu'on ouvre la fiche. */
export async function charteBrouillon(prospectId) {
  const brouillon = await lireEtat(prospectId, BROUILLON);
  if (brouillon.majLe || Object.keys(brouillon.donnees).length > 0) return brouillon;
  const publie = await lireEtat(prospectId, PUBLIE);
  return { ...publie, majLe: null };
}

/** Les défauts maison, appliqués à tous les clients sans surcharge. */
export function charteMaison() {
  return lireEtat(MAISON, PUBLIE);
}

/**
 * Applique un lot de valeurs au brouillon. `null` retire la surcharge.
 *
 * Chaque valeur est contrôlée ici — c'est la seule porte, donc une valeur
 * invalide ne peut pas atteindre la base, et donc pas atteindre un écran client.
 * Les contrôles de couple (contraste) sont volontairement absents : indicatifs
 * pendant l'édition, ils bloquent à la publication.
 */
export async function modifierBrouillon(prospectId, valeurs, majPar = null) {
  const erreurs = {};
  for (const [cle, valeur] of Object.entries(valeurs || {})) {
    if (valeur === null) continue;
    const message = controler(cle, valeur);
    if (message) erreurs[cle] = message;
  }
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };

  const courant = await charteBrouillon(prospectId);
  const donnees = { ...courant.donnees };
  for (const [cle, valeur] of Object.entries(valeurs || {})) {
    if (valeur === null) delete donnees[cle];
    else donnees[cle] = valeur;
  }

  await ecrireEtat(prospectId, BROUILLON, { donnees, version: courant.version, majPar });
  return { ok: true, erreurs: {}, donnees };
}

/**
 * Publie le brouillon. Refusé tant qu'une valeur est invalide : une console qui
 * peut pousser une charte illisible chez un client payant est précisément ce que
 * cette couche existe pour empêcher.
 */
export async function publierCharte(prospectId, majPar = null) {
  const [brouillon, maison] = await Promise.all([charteBrouillon(prospectId), charteMaison()]);

  const erreurs = {};
  for (const [cle, valeur] of Object.entries(brouillon.donnees)) {
    const message = controler(cle, valeur);
    if (message) erreurs[cle] = message;
  }
  const resolu = valeursResolues(brouillon.donnees, maison.donnees);
  for (const [cle, message] of Object.entries(controlerCharte(resolu))) {
    if (!erreurs[cle]) erreurs[cle] = message;
  }
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };

  const publie = await lireEtat(prospectId, PUBLIE);
  const version = publie.version + 1;
  const modifiees = clesModifiees(publie.donnees, brouillon.donnees);

  await ecrireEtat(prospectId, PUBLIE, { donnees: brouillon.donnees, version, majPar });
  await ecrireEtat(prospectId, BROUILLON, { donnees: brouillon.donnees, version, majPar: null, majLe: null });

  // Le journal s'écrit avec la publication, pas après : une ligne qui peut
  // manquer rendrait l'historique trompeur.
  const db = await connexion();
  await db.executer(
    `INSERT INTO ${table('charte_journal')} (prospect_id, version, publie_le, publie_par, modifiees) VALUES (?, ?, ?, ?, ?)`,
    [Number(prospectId), version, new Date().toISOString(), majPar || null, JSON.stringify(modifiees)],
  );

  return { ok: true, erreurs: {}, version, modifiees };
}

/** Les clés dont la valeur publiée change — ce qu'un relecteur a besoin de voir. */
export function clesModifiees(avant, apres) {
  const cles = new Set([...Object.keys(avant || {}), ...Object.keys(apres || {})]);
  return [...cles]
    .filter((c) => JSON.stringify((avant || {})[c]) !== JSON.stringify((apres || {})[c]))
    .sort();
}

/** Les vingt dernières publications, la plus récente en tête. */
export async function journalCharte(prospectId, limite = 20) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT version, publie_le, publie_par, modifiees FROM ${table('charte_journal')}
      WHERE prospect_id = ? ORDER BY version DESC LIMIT ${Number(limite) || 20}`,
    [Number(prospectId)],
  );
  return lignes.map((l) => ({
    version: Number(l.version),
    publieLe: l.publie_le,
    publiePar: l.publie_par,
    modifiees: lireJson(l.modifiees, []) || [],
  }));
}

/** Combien de variables chaque client surcharge, pour la liste de la console. */
export async function compteursCharte() {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT prospect_id, etat, donnees, version, maj_le FROM ${table('charte')} WHERE prospect_id <> ?`,
    [MAISON],
  );
  const par = new Map();
  for (const l of lignes) {
    const id = Number(l.prospect_id);
    const entree = par.get(id) || { surcharges: 0, version: 0, brouillon: false };
    if (l.etat === PUBLIE) {
      entree.surcharges = Object.keys(lireJson(l.donnees, {}) || {}).length;
      entree.version = Number(l.version || 0);
    } else if (l.maj_le) {
      entree.brouillon = true;
    }
    par.set(id, entree);
  }
  return par;
}
