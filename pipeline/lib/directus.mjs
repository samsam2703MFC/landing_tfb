/**
 * Client REST minimal pour Directus 11.
 *
 * Tout passe par le jeton statique `DIRECTUS_TOKEN` (utilisateur admin) :
 * le pipeline crée les collections, puis écrit les items. Aucune dépendance,
 * juste `fetch` (Node 20+).
 */

/** Lit la configuration dans l'environnement, au moment de l'appel. */
export function configDirectus() {
  const url = (process.env.DIRECTUS_URL || '').replace(/\/+$/, '');
  const token = process.env.DIRECTUS_TOKEN || '';
  if (!url) throw new Error('DIRECTUS_URL manquant.');
  if (!token) throw new Error('DIRECTUS_TOKEN manquant.');
  return { url, token };
}

/**
 * Appel HTTP vers Directus.
 * Renvoie `data` (la clé standard des réponses Directus) ou `null` si le corps
 * est vide (204). Lève une erreur lisible en cas de statut non 2xx.
 */
export async function appelDirectus(chemin, options = {}) {
  const { url, token } = configDirectus();
  const { params, body, methode = 'GET', ...reste } = options;

  let cible = `${url}${chemin}`;
  if (params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams();
    for (const [cle, valeur] of Object.entries(params)) {
      if (valeur !== undefined && valeur !== null) qs.append(cle, String(valeur));
    }
    cible += `?${qs.toString()}`;
  }

  const reponse = await fetch(cible, {
    method: methode,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(reste.headers || {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const texte = await reponse.text();
  let donnees = null;
  if (texte) {
    try {
      donnees = JSON.parse(texte);
    } catch {
      donnees = { brut: texte };
    }
  }

  if (!reponse.ok) {
    const detail =
      donnees?.errors?.map((e) => e.message).join(' / ') || texte.slice(0, 300) || 'sans détail';
    const err = new Error(`Directus ${methode} ${chemin} → ${reponse.status} : ${detail}`);
    err.statut = reponse.status;
    throw err;
  }

  return donnees ? (donnees.data ?? donnees) : null;
}

// ---------------------------------------------------------------------------
// Schéma (collections et champs)
// ---------------------------------------------------------------------------

/** true si la collection existe déjà. */
export async function collectionExiste(nom) {
  try {
    await appelDirectus(`/collections/${nom}`);
    return true;
  } catch (err) {
    if (err.statut === 403 || err.statut === 404) return false;
    throw err;
  }
}

/** Crée une collection (avec ses champs initiaux). */
export function creerCollection(definition) {
  return appelDirectus('/collections', { methode: 'POST', body: definition });
}

/** Liste les noms de champs existants d'une collection. */
export async function champsExistants(collection) {
  const champs = await appelDirectus(`/fields/${collection}`);
  return new Set((champs || []).map((c) => c.field));
}

/** Crée un champ sur une collection existante. */
export function creerChamp(collection, definition) {
  return appelDirectus(`/fields/${collection}`, { methode: 'POST', body: definition });
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export function lireItems(collection, params = {}) {
  return appelDirectus(`/items/${collection}`, { params });
}

export function creerItem(collection, donnees) {
  return appelDirectus(`/items/${collection}`, { methode: 'POST', body: donnees });
}

export function majItem(collection, id, donnees) {
  return appelDirectus(`/items/${collection}/${id}`, { methode: 'PATCH', body: donnees });
}

/** Suppression en lot. Ne fait rien si la liste est vide. */
export async function supprimerItems(collection, ids) {
  if (!ids || ids.length === 0) return;
  await appelDirectus(`/items/${collection}`, { methode: 'DELETE', body: ids });
}

/** Lecture d'un singleton (collection marquée `singleton`). */
export function lireSingleton(collection) {
  return appelDirectus(`/items/${collection}`);
}

/** Écriture d'un singleton. */
export function majSingleton(collection, donnees) {
  return appelDirectus(`/items/${collection}`, { methode: 'PATCH', body: donnees });
}

/**
 * Insertion ou mise à jour selon une clé unique — le cœur de l'idempotence :
 * rejouer l'ingestion ne crée pas de doublon.
 * Renvoie { id, cree } où `cree` indique une création.
 */
export async function upsertParCle(collection, champCle, valeurCle, donnees) {
  const existants = await lireItems(collection, {
    [`filter[${champCle}][_eq]`]: valeurCle,
    fields: 'id',
    limit: 1,
  });

  if (existants && existants.length > 0) {
    const id = existants[0].id;
    await majItem(collection, id, donnees);
    return { id, cree: false };
  }

  const cree = await creerItem(collection, { ...donnees, [champCle]: valeurCle });
  return { id: cree.id, cree: true };
}
