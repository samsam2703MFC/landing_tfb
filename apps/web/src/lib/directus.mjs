/**
 * Accès Directus — CÔTÉ SERVEUR UNIQUEMENT.
 *
 * Ce fichier n'est importé que par des composants `.astro` rendus sur le
 * serveur : le jeton reste dans le processus Node et n'est jamais sérialisé
 * vers le navigateur. Ne jamais importer ce module depuis un script client.
 *
 * La configuration est lue dans `process.env` à l'exécution (et non via
 * `import.meta.env`, qui serait figée au build) : la même image Docker
 * fonctionne sur n'importe quel environnement.
 */

const TTL_CACHE = Number(process.env.CACHE_TTL_MS || 60000);

/** Cache mémoire très simple : évite de réinterroger Directus à chaque visite. */
const cache = new Map();

function config() {
  const url = (process.env.DIRECTUS_URL || '').replace(/\/+$/, '');
  const token = process.env.DIRECTUS_TOKEN || '';
  return { url, token };
}

/** Requête GET vers Directus. Renvoie `null` en cas d'échec, sans lever. */
async function lire(chemin, params = {}) {
  const { url, token } = config();
  if (!url || !token) {
    console.warn('[directus] DIRECTUS_URL ou DIRECTUS_TOKEN absent — contenu vide.');
    return null;
  }

  const qs = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(params)) {
    if (valeur !== undefined && valeur !== null) qs.append(cle, String(valeur));
  }
  const cible = `${url}${chemin}${qs.size ? `?${qs}` : ''}`;

  const enCache = cache.get(cible);
  if (enCache && Date.now() - enCache.date < TTL_CACHE) return enCache.donnees;

  try {
    const reponse = await fetch(cible, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!reponse.ok) {
      console.error(`[directus] ${chemin} → ${reponse.status}`);
      // En cas d'erreur, on préfère servir la dernière version connue.
      return enCache ? enCache.donnees : null;
    }
    const corps = await reponse.json();
    const donnees = corps.data ?? null;
    cache.set(cible, { date: Date.now(), donnees });
    return donnees;
  } catch (err) {
    console.error(`[directus] ${chemin} injoignable : ${err.message}`);
    return enCache ? enCache.donnees : null;
  }
}

const CHAMPS_MODULE =
  'slug,nom,accroche,resume,description,groupe,public_cible,problemes,benefices,stack,mots_cles,mermaid,ordre,genere_le,repo';

/** Contenu de la page d'accueil (singleton). */
export function chargerSite() {
  return lire('/items/site');
}

/** Liste des modules actifs, triés pour l'affichage. */
export async function chargerModules() {
  const modules = await lire('/items/modules', {
    'filter[actif][_eq]': 'true',
    fields: `${CHAMPS_MODULE},fonctions.cle,fonctions.nom,fonctions.icone`,
    sort: 'ordre,nom',
    limit: -1,
  });
  return modules || [];
}

/** Un module et toutes ses fonctions. `null` si le slug n'existe pas. */
export async function chargerModule(slug) {
  const modules = await lire('/items/modules', {
    'filter[slug][_eq]': slug,
    'filter[actif][_eq]': 'true',
    fields: `${CHAMPS_MODULE},fonctions.cle,fonctions.nom,fonctions.description,fonctions.benefice,fonctions.icone,fonctions.ordre`,
    limit: 1,
  });
  if (!modules || modules.length === 0) return null;

  const module = modules[0];
  module.fonctions = (module.fonctions || []).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  return module;
}

/** Regroupe les modules par famille, en conservant l'ordre d'apparition. */
export function grouperModules(modules) {
  const groupes = new Map();
  for (const module of modules) {
    const cle = module.groupe || 'Autres';
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(module);
  }
  return [...groupes.entries()].map(([nom, liste]) => ({ nom, modules: liste }));
}
