/**
 * Lecture du contenu en base — CÔTÉ SERVEUR UNIQUEMENT.
 *
 * Ce fichier n'est importé que par des pages `.astro` rendues sur le serveur :
 * les identifiants de la base restent dans le processus Node et ne partent
 * jamais vers le navigateur. Ne jamais l'importer depuis un script client.
 *
 * La configuration est lue dans `process.env` à l'exécution (et non via
 * `import.meta.env`, qui serait figée au build) : la même image Docker
 * fonctionne sur n'importe quel environnement.
 */

const TTL_CACHE = Number(process.env.CACHE_TTL_MS || 60000);

/** Cache mémoire : évite une requête SQL à chaque visite. */
const cache = new Map();

let poolPromesse = null;

/**
 * Préfixe des tables, identique à celui du pipeline. `landing_` par défaut :
 * la base peut déjà contenir des tables d'un autre projet.
 */
function table(nom) {
  return `${process.env.DB_PREFIX || 'landing_'}${nom}`;
}

function estPostgres() {
  const client = (process.env.DB_CLIENT || 'mysql').toLowerCase();
  return client === 'pg' || client === 'postgres' || client === 'postgresql';
}

/** Convertit les `?` en `$1, $2, …` pour PostgreSQL. */
function adapterMarqueurs(sql) {
  if (!estPostgres()) return sql;
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

/** Pool de connexions, créé une seule fois pour tout le processus. */
function pool() {
  if (poolPromesse) return poolPromesse;

  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || (estPostgres() ? 5432 : 3306)),
    user: process.env.DB_LOGIN,
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME,
  };

  poolPromesse = (async () => {
    if (estPostgres()) {
      const { default: pg } = await import('pg');
      const p = new pg.Pool({ ...config, max: 5 });
      return { requete: async (sql, params) => (await p.query(adapterMarqueurs(sql), params)).rows };
    }
    const { default: mysql } = await import('mysql2/promise');
    const p = mysql.createPool({ ...config, connectionLimit: 5, waitForConnections: true });
    return { requete: async (sql, params) => (await p.query(sql, params))[0] };
  })();

  return poolPromesse;
}

/**
 * Exécute une requête avec cache et repli.
 * Ne lève jamais : une base injoignable rend la dernière valeur connue, ou
 * `null`. La landing affiche alors son contenu de repli plutôt qu'une erreur.
 */
async function lire(cle, sql, params = []) {
  const enCache = cache.get(cle);
  if (enCache && Date.now() - enCache.date < TTL_CACHE) return enCache.donnees;

  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    console.warn('[db] DB_HOST ou DB_NAME absent — contenu vide.');
    return enCache ? enCache.donnees : null;
  }

  try {
    const client = await pool();
    const lignes = await client.requete(sql, params);
    cache.set(cle, { date: Date.now(), donnees: lignes });
    return lignes;
  } catch (err) {
    console.error(`[db] ${cle} : ${err.message}`);
    return enCache ? enCache.donnees : null;
  }
}

/** Décode une colonne JSON, quel que soit le pilote. */
function lireJson(valeur, defaut = null) {
  if (valeur === null || valeur === undefined) return defaut;
  if (typeof valeur === 'object') return valeur;
  try {
    return JSON.parse(valeur);
  } catch {
    return defaut;
  }
}

/** Normalise une ligne de module : colonnes JSON décodées, booléen propre. */
function normaliserModule(ligne) {
  return {
    ...ligne,
    actif: Boolean(ligne.actif),
    problemes: lireJson(ligne.problemes, []),
    benefices: lireJson(ligne.benefices, []),
    stack: lireJson(ligne.stack, []),
    mots_cles: lireJson(ligne.mots_cles, []),
    fonctions: [],
  };
}

const VRAI = () => (estPostgres() ? true : 1);

/** Contenu de la page d'accueil (la ligne unique de la table site). */
export async function chargerSite() {
  const lignes = await lire('site', `SELECT * FROM ${table('site')} ORDER BY id LIMIT 1`);
  if (!lignes || lignes.length === 0) return null;
  const site = lignes[0];
  return {
    ...site,
    problemes: lireJson(site.problemes, []),
    reponses: lireJson(site.reponses, []),
  };
}

/** Liste des modules actifs, avec le nom de leurs fonctions. */
export async function chargerModules() {
  const lignes = await lire(
    'modules',
    `SELECT * FROM ${table('modules')} WHERE actif = ? ORDER BY ordre, nom`,
    [VRAI()],
  );
  if (!lignes || lignes.length === 0) return [];

  const modules = lignes.map(normaliserModule);
  const fonctions = await lire(
    'fonctions-resume',
    `SELECT module_id, cle, nom, icone FROM ${table('fonctions')} ORDER BY module_id, ordre`,
  );

  if (fonctions) {
    const parModule = new Map();
    for (const fonction of fonctions) {
      if (!parModule.has(fonction.module_id)) parModule.set(fonction.module_id, []);
      parModule.get(fonction.module_id).push(fonction);
    }
    for (const module of modules) {
      module.fonctions = parModule.get(module.id) || [];
    }
  }

  return modules;
}

/** Un module et toutes ses fonctions. `null` si le slug n'existe pas. */
export async function chargerModule(slug) {
  const lignes = await lire(
    `module:${slug}`,
    `SELECT * FROM ${table('modules')} WHERE slug = ? AND actif = ? LIMIT 1`,
    [slug, VRAI()],
  );
  if (!lignes || lignes.length === 0) return null;

  const module = normaliserModule(lignes[0]);
  const fonctions = await lire(
    `fonctions:${slug}`,
    `SELECT * FROM ${table('fonctions')} WHERE module_id = ? ORDER BY ordre`,
    [module.id],
  );
  module.fonctions = fonctions || [];
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
