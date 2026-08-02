/**
 * L'exécution d'une ressource déclarée.
 *
 * Tout ce qui atteint le SQL comme identifiant vient du catalogue — jamais de la
 * requête. La requête ne peut que **nommer** un filtre que le catalogue déclare
 * déjà, et sa valeur part en paramètre lié. Rien d'autre ne franchit cette
 * ligne.
 *
 * Le refus est préféré au silence : un filtre inconnu qu'on ignorerait
 * poliment rendrait plus de lignes que l'appelant n'en a demandé, et personne
 * ne s'en apercevrait avant de lire un chiffre faux.
 */

import { connexion, estPostgres } from '../db.mjs';
import { OPERATEURS, estIdentifiant } from './catalogue.mjs';
import { connexionBase } from './bases.mjs';

export class DemandeRefusee extends Error {
  constructor(message, statut = 400) {
    super(message);
    this.statut = statut;
  }
}

/**
 * Lit `filtre[colonne][op]=valeur`, `limite` et `tri` dans une URL, contre une
 * ressource. Ce que la ressource ne déclare pas est refusé.
 */
export function lireDemande(url, r) {
  const filtres = [];

  for (const [brut, valeur] of url.searchParams.entries()) {
    const trouve = /^filtre\[([^\]]+)\]\[([^\]]+)\]$/.exec(brut);
    if (!trouve) continue;
    const [, colonne, op] = trouve;

    const permis = (r.filtres || {})[colonne];
    if (!permis) throw new DemandeRefusee(`Filtre non déclaré pour cette ressource : ${colonne}.`);
    if (!permis.includes(op)) {
      throw new DemandeRefusee(`Opérateur « ${op} » non autorisé sur ${colonne} — déclarés : ${permis.join(', ')}.`);
    }
    filtres.push({ colonne, op, valeur });
  }

  const demande = Number(url.searchParams.get('limite') ?? r.maxLignes);
  const limite = Number.isInteger(demande) && demande > 0 ? Math.min(demande, r.maxLignes) : r.maxLignes;

  let tri;
  const triBrut = url.searchParams.get('tri');
  if (triBrut) {
    const [colonne, sens] = triBrut.split(':');
    if (!colonne || !(r.triables || []).includes(colonne)) {
      throw new DemandeRefusee(`Tri non autorisé — colonnes triables : ${(r.triables || []).join(', ') || 'aucune'}.`);
    }
    tri = { colonne, sens: sens === 'asc' ? 'asc' : 'desc' };
  }

  return { filtres, limite, tri };
}

/**
 * Échappe un identifiant. Bretelles **et** ceinture : ils viennent tous du
 * catalogue, mais une entrée ajoutée à la main avec une faute doit échouer ici
 * plutôt qu'atteindre la base.
 */
function citer(identifiant) {
  if (!estIdentifiant(identifiant)) throw new DemandeRefusee(`Identifiant SQL invalide : ${identifiant}.`, 500);
  return estPostgres() ? `"${identifiant}"` : `\`${identifiant}\``;
}

/** Le SQL qu'une demande produirait, sans l'exécuter — ce que la console montre. */
export function sqlDe(r, options) {
  const colonnes = r.colonnes.map(citer).join(', ');
  // En base par client, l'isolation est la connexion : il n'y a rien à filtrer,
  // et inventer un filtre reviendrait à nommer dans le SQL un client dont la
  // base ne connaît pas l'existence.
  const ou = r.portee === 'base_client' ? [] : [`${citer(r.colonneClient)} = ?`];
  const valeurs = [];

  for (const f of options.filtres) {
    const colonne = citer(f.colonne);
    if (f.op === 'eq') { ou.push(`${colonne} = ?`); valeurs.push(f.valeur); }
    else if (f.op === 'gte') { ou.push(`${colonne} >= ?`); valeurs.push(f.valeur); }
    else if (f.op === 'lte') { ou.push(`${colonne} <= ?`); valeurs.push(f.valeur); }
    else if (f.op === 'in') {
      // Cent valeurs suffisent à tout usage légitime, et bornent le coût d'une
      // requête que personne ne relira avant qu'elle ne tourne en production.
      const items = String(f.valeur).split(',').filter(Boolean).slice(0, 100);
      if (items.length === 0) throw new DemandeRefusee(`Filtre « in » vide sur ${f.colonne}.`);
      ou.push(`${colonne} IN (${items.map(() => '?').join(', ')})`);
      valeurs.push(...items);
    } else {
      throw new DemandeRefusee(`Opérateur inconnu : ${f.op}.`, 500);
    }
  }

  const tri = options.tri
    ? ` ORDER BY ${citer(options.tri.colonne)} ${options.tri.sens === 'asc' ? 'ASC' : 'DESC'}`
    : '';
  const filtre = ou.length > 0 ? ` WHERE ${ou.join(' AND ')}` : '';

  return {
    sql: `SELECT ${colonnes} FROM ${citer(r.source)}${filtre}${tri} LIMIT ?`,
    valeurs,
  };
}

/**
 * Exécute une ressource pour **un** client.
 *
 * `prospectId` est résolu côté serveur par l'appelant et passé ici. Il n'est
 * jamais lu dans la chaîne de requête.
 *
 * En portée « base_client », la requête part sur la base du client — et
 * `connexionBase()` lève plutôt que de retomber sur celle de la console. C'est
 * volontairement l'appel qui échoue : une ressource qui interrogerait la base
 * d'administration par défaut rendrait les prospects et les offres de tout le
 * monde, avec un SQL d'apparence irréprochable.
 */
export async function executerRessource(r, prospectId, options) {
  const { sql, valeurs } = sqlDe(r, options);

  if (r.portee === 'base_client') {
    const pool = await connexionBase(prospectId);
    const [lignes] = await pool.query(sql, [...valeurs, options.limite]);
    return lignes.map(normaliserLigne);
  }

  const db = await connexion();
  const lignes = await db.requete(sql, [Number(prospectId), ...valeurs, options.limite]);
  return lignes.map(normaliserLigne);
}

/**
 * MySQL rend un BIGINT en `bigint` JavaScript et une DATE en `Date`, deux
 * choses auxquelles `JSON.stringify` ne survit pas : un bigint le fait lever,
 * ce qui transformait toute ressource portant une colonne d'identifiant en
 * erreur 503. Le défaut a été trouvé en exécutant, pas en relisant — les tests
 * vérifiaient la valeur de retour de la fonction, pas celle de la route.
 *
 * Un bigint au-delà de `Number.MAX_SAFE_INTEGER` devient une chaîne plutôt
 * qu'un nombre silencieusement arrondi : un identifiant faux est pire qu'un
 * identifiant incommode.
 */
export function normaliserLigne(ligne) {
  const sortie = {};
  for (const [cle, valeur] of Object.entries(ligne)) {
    if (typeof valeur === 'bigint') {
      sortie[cle] = valeur >= BigInt(Number.MIN_SAFE_INTEGER) && valeur <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(valeur)
        : valeur.toString();
    } else if (valeur instanceof Date) {
      sortie[cle] = valeur.toISOString();
    } else if (Buffer.isBuffer(valeur)) {
      sortie[cle] = valeur.toString('base64');
    } else {
      sortie[cle] = valeur;
    }
  }
  return sortie;
}

/** Les opérateurs, réexportés pour les écrans qui construisent un formulaire. */
export { OPERATEURS };
