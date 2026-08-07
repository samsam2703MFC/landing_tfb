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

/**
 * Une charte appartient à un client, ou à une marque.
 *
 * Une marque habille **tous ses clients** : un réseau de franchise a une
 * identité, pas trente. C'est la façon dont ces gens travaillent — l'enseigne
 * décide des couleurs, les sociétés qui l'exploitent les portent.
 *
 * Trois niveaux se superposent donc, du plus général au plus précis :
 *
 *   maison → marque → client
 *
 * Le plus précis l'emporte, clé par clé. Un franchisé qui n'a rien surchargé
 * sert exactement la charte de son enseigne ; s'il surcharge une couleur, il
 * ne surcharge que celle-là.
 *
 * `cible` accepte un nombre — un client, par commodité, parce que c'est le cas
 * de tous les appels d'origine — ou `{ portee, id }`.
 */
export function cibleCharte(cible) {
  if (cible && typeof cible === 'object') {
    return { portee: cible.portee === 'marque' ? 'marque' : 'client', id: Number(cible.id) || 0 };
  }
  return { portee: 'client', id: Number(cible) || 0 };
}

/** La charte d'une marque, désignée sans ambiguïté. */
export function marque(id) {
  return { portee: 'marque', id: Number(id) || 0 };
}

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

async function lireEtat(cible, etat) {
  const { portee, id } = cibleCharte(cible);
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT donnees, version, maj_le, maj_par FROM ${table('charte')}
      WHERE prospect_id = ? AND etat = ? AND (portee = ? OR (portee IS NULL AND ? = 'client'))
      LIMIT 1`,
    [id, etat, portee, portee],
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
async function ecrireEtat(cible, etat, { donnees, version, majPar, majLe = new Date().toISOString() }) {
  const { portee, id: cibleId } = cibleCharte(cible);
  const db = await connexion();
  const json = JSON.stringify(donnees || {});
  const existant = await db.requete(
    `SELECT id FROM ${table('charte')}
      WHERE prospect_id = ? AND etat = ? AND (portee = ? OR (portee IS NULL AND ? = 'client'))
      LIMIT 1`,
    [cibleId, etat, portee, portee],
  );
  if (existant[0]) {
    await db.executer(
      `UPDATE ${table('charte')} SET donnees = ?, version = ?, maj_le = ?, maj_par = ? WHERE id = ?`,
      [json, Number(version || 0), majLe, majPar || null, existant[0].id],
    );
  } else {
    await db.executer(
      `INSERT INTO ${table('charte')} (portee, prospect_id, etat, donnees, version, maj_le, maj_par)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [portee, cibleId, etat, json, Number(version || 0), majLe, majPar || null],
    );
  }
  viderCache();
}

export function chartePubliee(cible) {
  return lireEtat(cible, PUBLIE);
}

/** Le brouillon part du publié la première fois qu'on ouvre la fiche. */
export async function charteBrouillon(cible) {
  const brouillon = await lireEtat(cible, BROUILLON);
  if (brouillon.majLe || Object.keys(brouillon.donnees).length > 0) return brouillon;
  const publie = await lireEtat(cible, PUBLIE);
  return { ...publie, majLe: null };
}

/** Les défauts maison, appliqués à tous les clients sans surcharge. */
export function charteMaison() {
  return lireEtat(MAISON, PUBLIE);
}

/**
 * La marque d'un client, ou rien.
 *
 * Une requête directe plutôt qu'un passage par `chargerProspect` : ce chemin
 * est emprunté par l'API de charte à chaque appel d'une application cliente,
 * et il n'a besoin que d'un entier.
 */
export async function marqueDuClient(prospectId) {
  const db = await connexion();
  const [l] = await db.requete(
    `SELECT marque_id FROM ${table('prospects')} WHERE id = ? LIMIT 1`, [Number(prospectId)],
  );
  return Number(l?.marque_id) || null;
}

/**
 * Ce dont un client hérite : la maison, puis sa marque par-dessus.
 *
 * Rendu à part de ses propres surcharges, parce que c'est ce qui permet à
 * l'écran de dire d'où vient chaque valeur — et à un franchisé de comprendre
 * qu'une couleur qu'il n'a pas choisie vient de son enseigne, pas de nulle part.
 */
export async function charteHeritee(prospectId) {
  const marqueId = await marqueDuClient(prospectId);
  const [maison, deLaMarque] = await Promise.all([
    charteMaison(),
    marqueId ? chartePubliee(marque(marqueId)) : Promise.resolve(vide()),
  ]);
  return { ...maison.donnees, ...deLaMarque.donnees };
}

/**
 * Tout ce qu'il faut pour servir la charte d'un client : les valeurs, et un
 * numéro de version qui bouge dès que **n'importe lequel** des trois niveaux
 * bouge.
 *
 * La version est la somme des trois. Une publication en incrémente exactement
 * une, donc la somme croît strictement : un cache en aval sait que sa copie a
 * vieilli, même si c'est la marque qui a changé et pas le client. Renvoyer la
 * seule version du client laisserait une refonte d'enseigne invisible chez ses
 * trente franchisés.
 */
export async function charteServie(prospectId) {
  const marqueId = await marqueDuClient(prospectId);
  const [maison, deLaMarque, client] = await Promise.all([
    charteMaison(),
    marqueId ? chartePubliee(marque(marqueId)) : Promise.resolve(vide()),
    chartePubliee(prospectId),
  ]);
  return {
    valeurs: valeursResolues(client.donnees, maison.donnees, deLaMarque.donnees),
    version: maison.version + deLaMarque.version + client.version,
    publieLe: client.majLe || deLaMarque.majLe || maison.majLe || null,
    marque_id: marqueId,
    niveaux: {
      maison: maison.donnees,
      marque: deLaMarque.donnees,
      client: client.donnees,
    },
  };
}

/**
 * Applique un lot de valeurs au brouillon. `null` retire la surcharge.
 *
 * Chaque valeur est contrôlée ici — c'est la seule porte, donc une valeur
 * invalide ne peut pas atteindre la base, et donc pas atteindre un écran client.
 * Les contrôles de couple (contraste) sont volontairement absents : indicatifs
 * pendant l'édition, ils bloquent à la publication.
 */
export async function modifierBrouillon(cible, valeurs, majPar = null) {
  const erreurs = {};
  for (const [cle, valeur] of Object.entries(valeurs || {})) {
    if (valeur === null) continue;
    const message = controler(cle, valeur);
    if (message) erreurs[cle] = message;
  }
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };

  const courant = await charteBrouillon(cible);
  const donnees = { ...courant.donnees };
  for (const [cle, valeur] of Object.entries(valeurs || {})) {
    if (valeur === null) delete donnees[cle];
    else donnees[cle] = valeur;
  }

  await ecrireEtat(cible, BROUILLON, { donnees, version: courant.version, majPar });
  return { ok: true, erreurs: {}, donnees };
}

/**
 * Publie le brouillon. Refusé tant qu'une valeur est invalide : une console qui
 * peut pousser une charte illisible chez un client payant est précisément ce que
 * cette couche existe pour empêcher.
 */
export async function publierCharte(cible, majPar = null) {
  const { portee, id } = cibleCharte(cible);
  // Le contrôle de contraste se fait sur ce qui sera RÉELLEMENT servi : une
  // couleur de texte héritée de la marque et un fond surchargé par le client
  // ne se lisent illisibles qu'une fois superposés.
  const dessous = portee === 'client' ? await charteHeritee(id) : await charteMaison();
  const brouillon = await charteBrouillon(cible);

  const erreurs = {};
  for (const [cle, valeur] of Object.entries(brouillon.donnees)) {
    const message = controler(cle, valeur);
    if (message) erreurs[cle] = message;
  }
  const resolu = { ...dessous, ...brouillon.donnees };
  for (const [cle, message] of Object.entries(controlerCharte(resolu))) {
    if (!erreurs[cle]) erreurs[cle] = message;
  }
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };

  const publie = await lireEtat(cible, PUBLIE);
  const version = publie.version + 1;
  const modifiees = clesModifiees(publie.donnees, brouillon.donnees);

  await ecrireEtat(cible, PUBLIE, { donnees: brouillon.donnees, version, majPar });
  await ecrireEtat(cible, BROUILLON, { donnees: brouillon.donnees, version, majPar: null, majLe: null });

  // Le journal s'écrit avec la publication, pas après : une ligne qui peut
  // manquer rendrait l'historique trompeur.
  const db = await connexion();
  await db.executer(
    `INSERT INTO ${table('charte_journal')} (portee, prospect_id, version, publie_le, publie_par, modifiees)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [portee, id, version, new Date().toISOString(), majPar || null, JSON.stringify(modifiees)],
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
export async function journalCharte(cible, limite = 20) {
  const { portee, id } = cibleCharte(cible);
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT version, publie_le, publie_par, modifiees FROM ${table('charte_journal')}
      WHERE prospect_id = ? AND (portee = ? OR (portee IS NULL AND ? = 'client'))
      ORDER BY version DESC LIMIT ${Number(limite) || 20}`,
    [id, portee, portee],
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
    // La portée est indispensable ici : sans elle, la charte de la marque 3
    // serait comptée comme celle du client 3. Les deux espaces d'identifiants
    // sont indépendants, et rien ne les empêche de se croiser.
    `SELECT prospect_id, etat, donnees, version, maj_le FROM ${table('charte')}
      WHERE prospect_id <> ? AND (portee = 'client' OR portee IS NULL)`,
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
