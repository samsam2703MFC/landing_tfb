/**
 * Accès direct à la base SQL — MySQL/MariaDB ou PostgreSQL selon DB_CLIENT.
 *
 * Le contenu généré est écrit dans trois tables ordinaires (`tfb_modules`,
 * `tfb_fonctions`, `tfb_site`). Pas de CMS intermédiaire : ce sont des tables
 * SQL comme les autres, lisibles et modifiables par n'importe quel outil.
 *
 * Les deux dialectes diffèrent sur trois points, gérés ici une fois pour
 * toutes : les marqueurs de paramètres (`?` contre `$1`), la récupération de
 * l'identifiant inséré, et le type JSON.
 */

const CLIENT = () => (process.env.DB_CLIENT || 'mysql').toLowerCase();

/** true si l'on parle à PostgreSQL. */
export function estPostgres() {
  return CLIENT() === 'pg' || CLIENT() === 'postgres' || CLIENT() === 'postgresql';
}

/** Configuration de connexion, lue dans l'environnement. */
function config() {
  const manquants = ['DB_HOST', 'DB_LOGIN', 'DB_NAME'].filter((v) => !process.env[v]);
  if (manquants.length) {
    throw new Error(`Variables de base manquantes : ${manquants.join(', ')}`);
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || (estPostgres() ? 5432 : 3306)),
    user: process.env.DB_LOGIN,
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME,
  };
}

/** Convertit les `?` en `$1, $2, …` pour PostgreSQL. */
function adapterMarqueurs(sql) {
  if (!estPostgres()) return sql;
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

/**
 * Ouvre une connexion et renvoie une petite interface commune aux deux
 * dialectes. Appeler `fermer()` à la fin — sinon le script ne rend pas la main.
 */
export async function ouvrir() {
  const cfg = config();

  if (estPostgres()) {
    const { default: pg } = await import('pg');
    const client = new pg.Client(cfg);
    await client.connect();
    return {
      dialecte: 'pg',
      async requete(sql, params = []) {
        const res = await client.query(adapterMarqueurs(sql), params);
        return res.rows;
      },
      async executer(sql, params = []) {
        await client.query(adapterMarqueurs(sql), params);
      },
      async inserer(sql, params = []) {
        const res = await client.query(`${adapterMarqueurs(sql)} RETURNING id`, params);
        return res.rows[0]?.id;
      },
      fermer: () => client.end(),
    };
  }

  const { default: mysql } = await import('mysql2/promise');
  const connexion = await mysql.createConnection({ ...cfg, multipleStatements: false });
  return {
    dialecte: 'mysql',
    async requete(sql, params = []) {
      const [lignes] = await connexion.query(sql, params);
      return lignes;
    },
    async executer(sql, params = []) {
      await connexion.query(sql, params);
    },
    async inserer(sql, params = []) {
      const [resultat] = await connexion.query(sql, params);
      return resultat.insertId;
    },
    fermer: () => connexion.end(),
  };
}

// ---------------------------------------------------------------------------
// Aides d'écriture
// ---------------------------------------------------------------------------

/** Sérialise ce qui va dans une colonne JSON. */
export function json(valeur) {
  return valeur === undefined || valeur === null ? null : JSON.stringify(valeur);
}

/** Relit une colonne JSON, quel que soit le pilote. */
export function lireJson(valeur, defaut = null) {
  if (valeur === null || valeur === undefined) return defaut;
  if (typeof valeur === 'object') return valeur; // pg et mysql2 décodent parfois seuls
  try {
    return JSON.parse(valeur);
  } catch {
    return defaut;
  }
}

/**
 * Insertion ou mise à jour selon une clé unique — le cœur de l'idempotence.
 * Renvoie { id, cree }.
 */
export async function upsert(db, table, cleColonne, cleValeur, donnees) {
  const existants = await db.requete(
    `SELECT id FROM ${table} WHERE ${cleColonne} = ? LIMIT 1`,
    [cleValeur],
  );

  const colonnes = Object.keys(donnees);
  const valeurs = colonnes.map((c) => donnees[c]);

  if (existants.length > 0) {
    const id = existants[0].id;
    const affectations = colonnes.map((c) => `${c} = ?`).join(', ');
    await db.executer(`UPDATE ${table} SET ${affectations} WHERE id = ?`, [...valeurs, id]);
    return { id, cree: false };
  }

  const toutes = [cleColonne, ...colonnes];
  const marqueurs = toutes.map(() => '?').join(', ');
  const id = await db.inserer(
    `INSERT INTO ${table} (${toutes.join(', ')}) VALUES (${marqueurs})`,
    [cleValeur, ...valeurs],
  );
  return { id, cree: true };
}
