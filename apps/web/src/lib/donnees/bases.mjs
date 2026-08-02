/**
 * La base de données d'un client.
 *
 * Chaque client a **sa** base, de structure identique à celle des autres. C'est
 * ce qui change tout par rapport à un schéma partagé : l'isolation n'est plus
 * une colonne dans un `WHERE`, c'est la connexion elle-même. Une ressource du
 * catalogue se déclare donc une fois et s'exécute chez n'importe quel client,
 * sans jamais nommer le client dans le SQL.
 *
 * CE QUE CELA DÉPLACE. Avec un schéma partagé, l'erreur qui fait fuiter est un
 * filtre oublié — visible dans le SQL, donc testable. Ici, l'erreur qui fait
 * fuiter est une **connexion mal choisie**, et le SQL a l'air parfaitement sain.
 * D'où les deux règles ci-dessous, qui ne se négocient pas :
 *
 *   · `connexionBase()` ne retombe **jamais** sur la base de la console. Un
 *     client sans base déclarée lève ; il ne lit pas silencieusement la base
 *     d'administration, qui contient les prospects et les offres de tout le monde.
 *   · Le pool est indexé par identifiant de client, et l'empreinte des réglages
 *     est vérifiée à chaque reprise : modifier la base d'un client ferme
 *     l'ancien pool au lieu de continuer à servir l'ancienne connexion.
 *
 * LES IDENTIFIANTS NE SONT NI DANS LE CODE NI DANS UN COMMIT. Le mot de passe
 * est chiffré par le coffre — celui-là même qui garde les secrets des caisses —
 * et la clé vit dans l'environnement du serveur. La console n'affiche jamais
 * qu'un hôte, un nom de base et quatre caractères masqués.
 */

import { connexion, lireJson, table, viderCache } from '../db.mjs';
import { CoffreFerme, chiffrer, coffreOuvert, dechiffrer, masque } from '../onboarding/coffre.mjs';

/** Levée quand la base d'un client n'est pas utilisable. Toujours explicite. */
export class BaseIndisponible extends Error {}

/**
 * Les hôtes qu'une base de données n'a aucune raison d'être.
 *
 * 169.254.169.254 est le service de métadonnées des hébergeurs : il répond en
 * HTTP, pas en MySQL, donc pointer une « base » dessus ne peut pas être une
 * erreur de saisie honnête. Le reste du lien-local suit la même logique.
 */
const HOTES_INTERDITS = /^169\.254\./;

export function hoteAcceptable(hote) {
  const h = String(hote || '').trim();
  if (!h) return false;
  return !HOTES_INTERDITS.test(h);
}

/** Les champs qu'un écran édite, et rien d'autre. */
export const CHAMPS_BASE = [
  { nom: 'libelle', libelle: 'Libellé', aide: 'Ce que voit l’équipe. « Belleville — production ».' },
  { nom: 'hote', libelle: 'Hôte', aide: 'Nom ou adresse du serveur de base de données.' },
  { nom: 'port', libelle: 'Port', aide: '3306 pour MySQL et MariaDB.' },
  { nom: 'base', libelle: 'Nom de la base' },
  { nom: 'identifiant', libelle: 'Identifiant' },
];

function ligneVersBase(l) {
  if (!l) return null;
  return {
    id: Number(l.id),
    prospectId: Number(l.prospect_id),
    libelle: l.libelle || '',
    hote: l.hote || '',
    port: Number(l.port || 3306),
    base: l.base || '',
    identifiant: l.identifiant || '',
    // Jamais le mot de passe : quatre caractères suffisent à ce qu'on
    // reconnaisse celui qu'on a saisi.
    motDePasseMasque: l.quatre ? masque(l.quatre) : null,
    statut: l.statut || 'brouillon',
    dernierTestLe: l.dernier_test_le || null,
    dernierTest: lireJson(l.dernier_test, null),
  };
}

export async function listerBases() {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT b.id, b.prospect_id, b.libelle, b.hote, b.port, b.base, b.identifiant, b.quatre,
            b.statut, b.dernier_test_le, b.dernier_test, p.raison_sociale
       FROM ${table('bases')} b
       LEFT JOIN ${table('prospects')} p ON p.id = b.prospect_id
      ORDER BY p.raison_sociale ASC, b.id ASC`,
    [],
  );
  return lignes.map((l) => ({ ...ligneVersBase(l), client: l.raison_sociale || `Prospect ${l.prospect_id}` }));
}

export async function chargerBase(prospectId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT id, prospect_id, libelle, hote, port, base, identifiant, quatre, statut, dernier_test_le, dernier_test
       FROM ${table('bases')} WHERE prospect_id = ? LIMIT 1`,
    [Number(prospectId)],
  );
  return ligneVersBase(lignes[0]);
}

/**
 * Enregistre la base d'un client. Le mot de passe n'est écrit que s'il est
 * fourni : réenregistrer un formulaire sans le retaper ne doit pas l'effacer.
 */
export async function enregistrerBase(prospectId, valeurs, motDePasse = null) {
  const hote = String(valeurs.hote || '').trim();
  if (!hoteAcceptable(hote)) {
    return { ok: false, erreur: 'Hôte refusé — une base de données n’est pas sur le lien-local.' };
  }
  const base = String(valeurs.base || '').trim();
  if (!base) return { ok: false, erreur: 'Le nom de la base est obligatoire.' };
  const port = Number(valeurs.port || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, erreur: 'Port invalide.' };

  let secret = null;
  if (motDePasse) {
    if (!coffreOuvert()) {
      return { ok: false, erreur: 'Coffre fermé : posez SECRETS_CLE_1 sur le serveur avant d’enregistrer un mot de passe.' };
    }
    secret = chiffrer(motDePasse);
  }

  const db = await connexion();
  const existante = await chargerBase(prospectId);
  const communs = [
    String(valeurs.libelle || '').trim(), hote, port, base,
    String(valeurs.identifiant || '').trim(),
  ];

  if (existante) {
    if (secret) {
      await db.executer(
        `UPDATE ${table('bases')} SET libelle = ?, hote = ?, port = ?, base = ?, identifiant = ?,
                chiffre = ?, iv = ?, sceau = ?, version_cle = ?, quatre = ?, maj_le = ? WHERE id = ?`,
        [...communs, secret.chiffre, secret.iv, secret.sceau, secret.version, secret.quatre,
          new Date().toISOString(), existante.id],
      );
    } else {
      await db.executer(
        `UPDATE ${table('bases')} SET libelle = ?, hote = ?, port = ?, base = ?, identifiant = ?, maj_le = ? WHERE id = ?`,
        [...communs, new Date().toISOString(), existante.id],
      );
    }
  } else {
    if (!secret) return { ok: false, erreur: 'Un mot de passe est nécessaire à la création.' };
    await db.executer(
      `INSERT INTO ${table('bases')}
         (prospect_id, libelle, hote, port, base, identifiant, chiffre, iv, sceau, version_cle, quatre, statut, maj_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'brouillon', ?)`,
      [Number(prospectId), ...communs, secret.chiffre, secret.iv, secret.sceau, secret.version, secret.quatre,
        new Date().toISOString()],
    );
  }

  fermerPool(prospectId);
  viderCache();
  return { ok: true };
}

export async function supprimerBase(prospectId) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('bases')} WHERE prospect_id = ?`, [Number(prospectId)]);
  fermerPool(prospectId);
  viderCache();
}

// ---------------------------------------------------------------------------
// Les connexions
// ---------------------------------------------------------------------------

/** Un pool par client. L'empreinte permet de détecter un réglage modifié. */
const pools = new Map();

/** Ce qui, s'il change, doit fermer le pool plutôt que continuer à servir. */
function empreinte(b) {
  return `${b.hote}|${b.port}|${b.base}|${b.identifiant}`;
}

export function fermerPool(prospectId) {
  const garde = pools.get(Number(prospectId));
  if (!garde) return;
  pools.delete(Number(prospectId));
  // `end()` attend les requêtes en cours ; on ne le guette pas, mais on ne
  // laisse pas non plus l'erreur remonter dans une écriture de formulaire.
  Promise.resolve(garde.pool).then((p) => p?.end?.()).catch(() => {});
}

/**
 * La connexion à la base d'un client.
 *
 * Ne retombe jamais sur la base de la console : sans base déclarée, elle lève.
 * Une ressource qui interrogerait la base d'administration par défaut lirait
 * les prospects, les offres et les contrats de tout le monde, et le SQL aurait
 * l'air parfaitement normal.
 */
export async function connexionBase(prospectId) {
  const id = Number(prospectId);
  if (!Number.isInteger(id) || id <= 0) throw new BaseIndisponible('Client inconnu.');

  const reglages = await chargerBase(id);
  if (!reglages) throw new BaseIndisponible(`Aucune base déclarée pour le client ${id}.`);
  if (!hoteAcceptable(reglages.hote)) throw new BaseIndisponible('Hôte refusé.');

  const marque = empreinte(reglages);
  const garde = pools.get(id);
  if (garde && garde.marque === marque) return garde.pool;
  if (garde) fermerPool(id);

  const promesse = (async () => {
    const db = await connexion();
    const lignes = await db.requete(
      `SELECT chiffre, iv, sceau, version_cle FROM ${table('bases')} WHERE prospect_id = ? LIMIT 1`,
      [id],
    );
    if (!lignes[0]) throw new BaseIndisponible(`Aucune base déclarée pour le client ${id}.`);
    let motDePasse;
    try {
      motDePasse = dechiffrer({
        chiffre: lignes[0].chiffre, iv: lignes[0].iv, sceau: lignes[0].sceau, version: lignes[0].version_cle,
      });
    } catch (err) {
      throw err instanceof CoffreFerme ? err : new BaseIndisponible(err.message);
    }

    const { default: mysql } = await import('mysql2/promise');
    return mysql.createPool({
      host: reglages.hote,
      port: reglages.port,
      user: reglages.identifiant,
      password: motDePasse,
      database: reglages.base,
      // Peu de connexions par client : il y en a une pile par client, et un
      // serveur de base a un plafond global qu'on atteint vite autrement.
      connectionLimit: 3,
      waitForConnections: true,
      connectTimeout: 8000,
      // Aucune requête multiple, jamais. Le catalogue n'en produit pas, et
      // l'autoriser transformerait la moindre faille d'échappement en
      // exécution de plusieurs instructions.
      multipleStatements: false,
    });
  })();

  pools.set(id, { marque, pool: promesse });
  return promesse;
}

/**
 * Le test de connexion. Ne lève jamais : rend de quoi écrire l'écran, succès
 * comme échec, et dit des nombres — « 48 tables » — parce qu'un « ✓ OK » ne
 * prouve rien à qui doute d'avoir saisi la bonne base.
 */
export async function testerBase(prospectId) {
  try {
    const pool = await connexionBase(prospectId);
    const [lignes] = await pool.query(
      'SELECT COUNT(*) AS tables_, DATABASE() AS base FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
    );
    const detail = { tables: Number(lignes[0]?.tables_ ?? 0), base: lignes[0]?.base || null };

    const db = await connexion();
    await db.executer(
      `UPDATE ${table('bases')} SET statut = 'active', dernier_test_le = ?, dernier_test = ? WHERE prospect_id = ?`,
      [new Date().toISOString(), JSON.stringify({ ok: true, ...detail }), Number(prospectId)],
    );
    viderCache();
    return { ok: true, detail };
  } catch (err) {
    const dit = err instanceof CoffreFerme || err instanceof BaseIndisponible
      ? err.message
      // Le message du pilote peut porter l'hôte et l'identifiant ; il reste
      // dans la console, jamais dans un journal partagé.
      : `Connexion refusée : ${err.code || err.message}`;
    try {
      const db = await connexion();
      await db.executer(
        `UPDATE ${table('bases')} SET statut = 'erreur', dernier_test_le = ?, dernier_test = ? WHERE prospect_id = ?`,
        [new Date().toISOString(), JSON.stringify({ ok: false, dit }), Number(prospectId)],
      );
      viderCache();
    } catch { /* la console dira l'erreur de connexion elle-même */ }
    return { ok: false, dit };
  }
}
