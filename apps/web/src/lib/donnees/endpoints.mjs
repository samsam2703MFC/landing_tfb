/**
 * La bibliothèque des endpoints, et les applications qui les consomment.
 *
 * Un endpoint est une **déclaration** : une vue, les colonnes qui peuvent
 * sortir, les filtres acceptés, un plafond de lignes. Le SQL en est fabriqué et
 * de rien d'autre — une requête ne peut nommer qu'un filtre déjà déclaré, et sa
 * valeur part toujours en paramètre lié.
 *
 * POURQUOI EN BASE ET PLUS DANS LE CODE. Une déclaration dans le code se relit
 * dans une diff, ce qui est précieux ; mais elle ne se cherche pas, ne se relie
 * pas à une application, et ne s'essaie pas depuis un écran. Ce sont les trois
 * choses qu'on fait vraiment avec une bibliothèque d'endpoints. La table gagne
 * donc, à une condition : que `controlerRessource()` s'applique à **l'écriture**,
 * de sorte que rien d'invalide n'y entre jamais.
 *
 * Ce que la table doit rendre en échange de la relecture qu'offrait une diff :
 * un auteur, une date, un état, et surtout `pourquoi`. Un endpoint dont
 * personne ne sait à quoi il sert ne se supprime jamais — on le garde « au cas
 * où », et la bibliothèque se remplit de choses que plus personne n'ose toucher.
 */

import { connexion, lireJson, table, viderCache } from '../db.mjs';
import { controlerRessource, estCleRessource } from './catalogue.mjs';

export const STATUTS = [
  { valeur: 'brouillon', libelle: 'Brouillon', quoi: 'En cours d’écriture. Aucune application ne devrait s’y fier.' },
  { valeur: 'actif', libelle: 'Actif', quoi: 'Servi. Le changer casse ce qui le lit.' },
  { valeur: 'retire', libelle: 'Retiré', quoi: 'Conservé pour mémoire, plus proposé.' },
];

function ligneVersEndpoint(l) {
  if (!l) return null;
  return {
    id: Number(l.id),
    cle: l.cle,
    nom: l.nom,
    pourquoi: l.pourquoi || '',
    portee: l.portee || 'base_client',
    source: l.source,
    colonnes: lireJson(l.colonnes, []) || [],
    filtres: lireJson(l.filtres, {}) || {},
    triables: lireJson(l.triables, []) || [],
    maxLignes: Number(l.max_lignes || 500),
    colonneClient: l.colonne_client || null,
    statut: l.statut || 'brouillon',
    version: Number(l.version || 1),
    creeLe: l.cree_le,
    creePar: l.cree_par,
    majLe: l.maj_le,
    majPar: l.maj_par,
  };
}

/**
 * La bibliothèque, filtrée.
 *
 * La recherche porte sur la clé, le nom **et le pourquoi** : c'est souvent par
 * l'usage qu'on retrouve un endpoint — « celui du réassort » — plutôt que par
 * un nom technique dont on ne se souvient pas.
 */
export async function chercherEndpoints({ texte = '', application = 0, statut = '' } = {}) {
  const db = await connexion();
  const ou = [];
  const valeurs = [];

  const q = String(texte || '').trim();
  if (q) {
    ou.push('(e.cle LIKE ? OR e.nom LIKE ? OR e.pourquoi LIKE ? OR e.source LIKE ?)');
    valeurs.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (Number(application) > 0) {
    ou.push(`e.id IN (SELECT endpoint_id FROM ${table('endpoint_applications')} WHERE application_id = ?)`);
    valeurs.push(Number(application));
  }
  if (STATUTS.some((s) => s.valeur === statut)) {
    ou.push('e.statut = ?');
    valeurs.push(statut);
  }

  const lignes = await db.requete(
    `SELECT e.* FROM ${table('endpoints')} e
      ${ou.length ? `WHERE ${ou.join(' AND ')}` : ''}
      ORDER BY e.cle ASC`,
    valeurs,
  );
  const endpoints = lignes.map(ligneVersEndpoint);

  // Les applications en une requête plutôt qu'une par endpoint : une
  // bibliothèque de cent entrées ferait cent allers-retours autrement.
  const liens = await db.requete(
    `SELECT ea.endpoint_id, a.id, a.cle, a.nom
       FROM ${table('endpoint_applications')} ea
       JOIN ${table('applications')} a ON a.id = ea.application_id
      ORDER BY a.nom ASC`,
    [],
  );
  const parEndpoint = new Map();
  for (const l of liens) {
    const liste = parEndpoint.get(Number(l.endpoint_id)) || [];
    liste.push({ id: Number(l.id), cle: l.cle, nom: l.nom });
    parEndpoint.set(Number(l.endpoint_id), liste);
  }

  return endpoints.map((e) => ({ ...e, applications: parEndpoint.get(e.id) || [] }));
}

export async function chargerEndpoint(id) {
  const db = await connexion();
  const lignes = await db.requete(`SELECT * FROM ${table('endpoints')} WHERE id = ? LIMIT 1`, [Number(id)]);
  const e = ligneVersEndpoint(lignes[0]);
  if (!e) return null;
  const liens = await db.requete(
    `SELECT a.id, a.cle, a.nom FROM ${table('endpoint_applications')} ea
       JOIN ${table('applications')} a ON a.id = ea.application_id
      WHERE ea.endpoint_id = ? ORDER BY a.nom ASC`,
    [e.id],
  );
  return { ...e, applications: liens.map((l) => ({ id: Number(l.id), cle: l.cle, nom: l.nom })) };
}

/** Par clé, pour l'exécution. Seuls les endpoints actifs se servent. */
export async function endpointParCle(cle, { actifSeulement = true } = {}) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('endpoints')} WHERE cle = ?${actifSeulement ? " AND statut = 'actif'" : ''} LIMIT 1`,
    [String(cle)],
  );
  return ligneVersEndpoint(lignes[0]);
}

/**
 * Écrit un endpoint, après le même contrôle que celui d'une déclaration en dur.
 *
 * C'est la seule porte : un endpoint invalide ne peut donc pas exister en base,
 * et l'exécution n'a rien à revérifier au moment où elle sert.
 */
export async function enregistrerEndpoint(id, valeurs, qui = null) {
  const cle = String(valeurs.cle || '').trim();
  const nom = String(valeurs.nom || '').trim();
  if (!nom) return { ok: false, erreur: 'Donnez-lui un nom lisible — la clé ne suffit pas à s’y retrouver.' };
  // `pourquoi` est exigé : un endpoint dont personne ne sait à quoi il sert ne
  // se supprime jamais, et la bibliothèque se remplit de choses intouchables.
  const pourquoi = String(valeurs.pourquoi || '').trim();
  if (pourquoi.length < 10) {
    return { ok: false, erreur: 'Dites à quoi il sert, en une phrase. Sans cela personne n’osera le retirer plus tard.' };
  }

  const declaration = {
    portee: valeurs.portee,
    source: String(valeurs.source || '').trim(),
    colonnes: valeurs.colonnes || [],
    filtres: valeurs.filtres || {},
    triables: valeurs.triables || [],
    maxLignes: Number(valeurs.maxLignes) || 0,
    colonneClient: valeurs.portee === 'base_client' ? null : (valeurs.colonneClient || null),
  };
  const souci = controlerRessource(cle, declaration);
  if (souci) return { ok: false, erreur: souci };

  const statut = STATUTS.some((s) => s.valeur === valeurs.statut) ? valeurs.statut : 'brouillon';
  const db = await connexion();

  // La clé part dans un chemin d'URL : deux endpoints de même clé rendraient
  // l'un des deux injoignable, sans rien dire.
  const doublon = await db.requete(
    `SELECT id FROM ${table('endpoints')} WHERE cle = ? AND id <> ? LIMIT 1`,
    [cle, Number(id) || 0],
  );
  if (doublon[0]) return { ok: false, erreur: `La clé « ${cle} » est déjà prise par un autre endpoint.` };

  const communs = [
    cle, nom, pourquoi, declaration.portee, declaration.source,
    JSON.stringify(declaration.colonnes), JSON.stringify(declaration.filtres),
    JSON.stringify(declaration.triables), declaration.maxLignes, declaration.colonneClient, statut,
  ];

  if (Number(id) > 0) {
    await db.executer(
      `UPDATE ${table('endpoints')} SET cle = ?, nom = ?, pourquoi = ?, portee = ?, source = ?,
              colonnes = ?, filtres = ?, triables = ?, max_lignes = ?, colonne_client = ?, statut = ?,
              version = version + 1, maj_le = ?, maj_par = ? WHERE id = ?`,
      [...communs, new Date().toISOString(), qui, Number(id)],
    );
    viderCache();
    return { ok: true, id: Number(id) };
  }

  const r = await db.executer(
    `INSERT INTO ${table('endpoints')}
       (cle, nom, pourquoi, portee, source, colonnes, filtres, triables, max_lignes, colonne_client,
        statut, version, cree_le, cree_par)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [...communs, new Date().toISOString(), qui],
  );
  viderCache();
  return { ok: true, id: Number(r.id) };
}

export async function supprimerEndpoint(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('endpoint_applications')} WHERE endpoint_id = ?`, [Number(id)]);
  await db.executer(`DELETE FROM ${table('endpoints')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

// ---------------------------------------------------------------------------
// Les applications
// ---------------------------------------------------------------------------

export async function listerApplications({ activesSeulement = false } = {}) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT a.id, a.cle, a.nom, a.description, a.actif,
            (SELECT COUNT(*) FROM ${table('endpoint_applications')} ea WHERE ea.application_id = a.id) AS endpoints_
       FROM ${table('applications')} a
      ${activesSeulement ? 'WHERE a.actif = 1' : ''}
      ORDER BY a.nom ASC`,
    [],
  );
  return lignes.map((l) => ({
    id: Number(l.id),
    cle: l.cle,
    nom: l.nom,
    description: l.description || '',
    actif: Boolean(Number(l.actif ?? 1)),
    endpoints: Number(l.endpoints_ || 0),
  }));
}

export async function ajouterApplication({ cle, nom, description }) {
  const c = String(cle || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,58}$/.test(c)) {
    return { ok: false, erreur: 'Clé attendue en minuscules, sans espace — elle identifie l’application partout.' };
  }
  if (!String(nom || '').trim()) return { ok: false, erreur: 'Nom attendu.' };
  const db = await connexion();
  const existe = await db.requete(`SELECT id FROM ${table('applications')} WHERE cle = ? LIMIT 1`, [c]);
  if (existe[0]) return { ok: false, erreur: `La clé « ${c} » existe déjà.` };
  await db.executer(
    `INSERT INTO ${table('applications')} (cle, nom, description, actif, cree_le) VALUES (?, ?, ?, 1, ?)`,
    [c, String(nom).trim(), String(description || '').trim(), new Date().toISOString()],
  );
  viderCache();
  return { ok: true };
}

export async function supprimerApplication(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('endpoint_applications')} WHERE application_id = ?`, [Number(id)]);
  await db.executer(`DELETE FROM ${table('applications')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

/**
 * Remplace les liens d'un endpoint vers les applications.
 *
 * Remplacer plutôt qu'ajouter : l'écran présente des cases à cocher, et
 * décocher doit délier. Une liaison qu'on croit retirée mais qui subsiste
 * ferait croire qu'une application dépend encore d'un endpoint qu'elle ne lit
 * plus — donc l'empêcherait d'être retiré.
 */
export async function lierApplications(endpointId, applicationIds) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('endpoint_applications')} WHERE endpoint_id = ?`, [Number(endpointId)]);
  for (const a of [...new Set((applicationIds || []).map(Number).filter((n) => n > 0))]) {
    await db.executer(
      `INSERT INTO ${table('endpoint_applications')} (endpoint_id, application_id, cree_le) VALUES (?, ?, ?)`,
      [Number(endpointId), a, new Date().toISOString()],
    );
  }
  viderCache();
}

/** Les clés déjà prises, pour proposer une clé libre dans le générateur. */
export async function clesPrises() {
  const db = await connexion();
  const lignes = await db.requete(`SELECT cle FROM ${table('endpoints')}`, []);
  return new Set(lignes.map((l) => l.cle));
}

/**
 * Une clé libre dérivée d'un nom de source. « v_ventes » → « ventes.liste »,
 * puis « ventes.liste_2 » si la première est prise.
 */
export function cleProposee(source, prises = new Set()) {
  const nu = String(source || '').replace(/^v_/, '').replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'donnees';
  const base = `${nu}.liste`;
  if (!estCleRessource(base)) return '';
  if (!prises.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const essai = `${nu}.liste_${n}`;
    if (!prises.has(essai)) return essai;
  }
  return '';
}
