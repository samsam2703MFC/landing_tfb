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

import { connexion, estPostgres, lireJson, table, viderCache } from '../db.mjs';
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

/**
 * Pourquoi cet hôte est refusé, ou `null` s'il convient.
 *
 * Un seul message pour tous les refus disait « pas sur le lien-local » à
 * quelqu'un qui avait simplement laissé le champ vide — un message qui décrit
 * une autre situation que la sienne fait chercher au mauvais endroit, et c'est
 * pire que pas de message du tout.
 */
export function refusHote(hote) {
  const h = String(hote || '').trim();
  if (!h) return 'Renseignez l’hôte du serveur de base de données.';
  // Un collage depuis une chaîne de connexion. On dit quoi retirer, plutôt que
  // de laisser le pilote échouer sur une résolution de nom incompréhensible.
  if (h.includes('://')) return 'Attendu un nom d’hôte ou une adresse, sans schéma — retirez la partie « …:// ».';
  if (h.includes('/')) return 'Attendu un hôte seul, sans chemin ni nom de base.';
  if (h.includes(':')) return 'Le port se saisit dans son propre champ — laissez ici l’hôte seul.';
  if (/\s/.test(h)) return 'Un nom d’hôte ne contient pas d’espace.';
  // 169.254.169.254 est le service de métadonnées des hébergeurs : il répond en
  // HTTP, pas en MySQL, donc l'y pointer ne peut pas être une saisie honnête.
  if (HOTES_INTERDITS.test(h)) return 'Hôte refusé — une base de données n’est pas sur le lien-local.';
  return null;
}

export function hoteAcceptable(hote) {
  return refusHote(hote) === null;
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
  const refus = refusHote(hote);
  if (refus) return { ok: false, erreur: refus };
  const base = String(valeurs.base || '').trim();
  if (!base) return { ok: false, erreur: 'Le nom de la base est obligatoire.' };
  const port = Number(valeurs.port || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, erreur: 'Port invalide.' };

  // Refusé, pas seulement signalé. Deux clients sur la même base, c'est
  // l'isolation supprimée sans que rien ne casse : les écrans marchent, les
  // requêtes répondent, et chacun lit les données de l'autre. Ce n'est pas le
  // genre d'erreur qu'on laisse passer derrière un bandeau qu'on peut ignorer.
  //
  // Déplacer une base d'un client à un autre reste possible : on la retire du
  // premier, puis on la déclare sur le second. Un clic de plus pour un cas rare,
  // contre une fuite silencieuse pour un cas fréquent.
  // La base de la console n'est la base d'aucun client. L'y déclarer donnerait à
  // son application les prospects, les offres, les contrats et les secrets
  // chiffrés de tout le monde — et le SQL n'y paraîtrait rien, puisqu'en portée
  // « base client » il ne nomme personne.
  if (base === (process.env.DB_NAME || '') && hote === (process.env.DB_HOST || '')) {
    return {
      ok: false,
      erreur: 'Ceci est la base de la console, pas celle d’un client. L’y déclarer ouvrirait à ce '
        + 'client les prospects, les offres et les contrats de tout le monde.',
    };
  }

  const autres = await dejaPrise(hote, port, base, prospectId);
  if (autres.length > 0) {
    return {
      ok: false,
      erreur: `Cette base est déjà celle de ${autres.join(', ')}. Retirez-la de ce client d’abord — `
        + 'deux clients sur une même base lisent les données l’un de l’autre sans que rien ne le signale.',
    };
  }

  let secret = null;
  if (motDePasse) {
    if (!coffreOuvert()) {
      return { ok: false, erreur: 'Coffre fermé : relancez le déploiement, il fabrique la clé de chiffrement sur le serveur. Rien à enregistrer avant qu’elle existe.' };
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
  const refus = refusHote(reglages.hote);
  if (refus) throw new BaseIndisponible(refus);

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

// ---------------------------------------------------------------------------
// La découverte
// ---------------------------------------------------------------------------

/**
 * Les schémas que MySQL tient pour lui. Les proposer serait proposer une
 * erreur : `mysql` contient les comptes du serveur, `information_schema` son
 * catalogue. Ils sont écartés de la liste plutôt que grisés — une entrée qu'on
 * ne doit jamais choisir n'a rien à faire dans un choix.
 */
const SCHEMAS_SYSTEME = new Set(['information_schema', 'mysql', 'performance_schema', 'sys']);

/**
 * Les bases visibles sur un serveur, avec de quoi reconnaître la bonne.
 *
 * Le compte de tables et l'estimation de lignes sont là pour ça : entre
 * `belleville`, `belleville_test` et `belleville_old`, seul le contenu dit
 * laquelle sert vraiment. Un nom ne le dit jamais.
 *
 * La liste est **déjà bornée par les droits du compte MySQL** qu'on utilise :
 * `information_schema.SCHEMATA` ne montre à un utilisateur que ce sur quoi il a
 * un privilège. Un compte correctement restreint à la base de son client ne
 * verra donc que celle-là, et cet écran n'y change rien.
 *
 * Ne lève jamais : rend de quoi écrire l'écran, succès comme échec.
 */
export async function sonderServeur({ hote, port, identifiant, motDePasse }) {
  const refus = refusHote(hote);
  if (refus) return { ok: false, dit: refus };
  if (!String(identifiant || '').trim()) {
    return { ok: false, dit: 'Renseignez l’identifiant du compte qui lit cette base.' };
  }
  if (!motDePasse) {
    return { ok: false, dit: 'Mot de passe nécessaire pour interroger le serveur — saisissez-le, il ne sera pas réaffiché.' };
  }

  let pool = null;
  try {
    const { default: mysql } = await import('mysql2/promise');
    // Sans `database` : on se connecte au serveur, pas à une base. C'est tout
    // l'intérêt — on ne sait pas encore laquelle choisir.
    pool = mysql.createPool({
      host: String(hote), port: Number(port) || 3306,
      user: String(identifiant || ''), password: String(motDePasse),
      connectionLimit: 1, waitForConnections: true, connectTimeout: 8000,
      multipleStatements: false,
    });
    const [lignes] = await pool.query(
      `SELECT s.SCHEMA_NAME AS nom,
              (SELECT COUNT(*) FROM information_schema.TABLES t
                WHERE t.TABLE_SCHEMA = s.SCHEMA_NAME) AS tables_,
              (SELECT COALESCE(SUM(t.TABLE_ROWS), 0) FROM information_schema.TABLES t
                WHERE t.TABLE_SCHEMA = s.SCHEMA_NAME) AS lignes_
         FROM information_schema.SCHEMATA s
        ORDER BY s.SCHEMA_NAME ASC`,
    );
    const bases = lignes
      .filter((l) => !SCHEMAS_SYSTEME.has(String(l.nom).toLowerCase()))
      .map((l) => ({ nom: l.nom, tables: Number(l.tables_ || 0), lignes: Number(l.lignes_ || 0) }));
    return { ok: true, bases };
  } catch (err) {
    // Le message du pilote peut porter l'hôte et l'identifiant ; il reste dans
    // la console, jamais dans un journal partagé.
    return { ok: false, dit: `Connexion refusée : ${err.code || err.message}` };
  } finally {
    await pool?.end?.().catch(() => {});
  }
}

/**
 * Le mot de passe enregistré d'un client, pour resonder son serveur sans le
 * retaper. Rendu à l'appelant immédiat et jamais à un écran.
 */
export async function motDePasseEnregistre(prospectId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT chiffre, iv, sceau, version_cle FROM ${table('bases')} WHERE prospect_id = ? LIMIT 1`,
    [Number(prospectId)],
  );
  if (!lignes[0]?.chiffre) return null;
  try {
    return dechiffrer({
      chiffre: lignes[0].chiffre, iv: lignes[0].iv, sceau: lignes[0].sceau, version: lignes[0].version_cle,
    });
  } catch {
    return null;
  }
}

/**
 * Quels autres clients pointent déjà sur cette base.
 *
 * Deux clients sur la même base, c'est l'isolation supprimée sans que rien ne
 * casse : les écrans marchent, les requêtes répondent, et chacun lit les
 * données de l'autre. C'est précisément l'erreur que la portée « base client »
 * rend invisible, puisque le SQL ne nomme jamais personne. D'où cette
 * vérification, faite au moment de choisir.
 */
export async function dejaPrise(hote, port, base, saufProspectId = 0) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT b.prospect_id, p.raison_sociale
       FROM ${table('bases')} b
       LEFT JOIN ${table('prospects')} p ON p.id = b.prospect_id
      WHERE b.hote = ? AND b.port = ? AND b.base = ? AND b.prospect_id <> ?`,
    [String(hote), Number(port) || 3306, String(base), Number(saufProspectId) || 0],
  );
  return lignes.map((l) => l.raison_sociale || `Prospect ${l.prospect_id}`);
}

/**
 * L'inventaire du serveur sur lequel tourne la console, **sans identifiants à
 * saisir** : la connexion existe déjà, elle est dans l'environnement du serveur.
 *
 * C'est le bon point de départ quand on découvre un parc : on regarde ce qui
 * existe avant de commencer à taper des comptes. Deux limites à dire à l'écran
 * plutôt qu'à laisser découvrir :
 *
 *   · il ne montre que le serveur de la console. Une base cliente hébergée
 *     ailleurs n'y figure pas, et c'est à cela que sert la recherche par
 *     identifiants ;
 *   · il ne montre que ce que le compte de la console a le droit de voir.
 *
 * Chaque entrée dit qui l'utilise déjà, parce que la question qu'on se pose en
 * lisant un inventaire est « laquelle est encore libre ».
 */
export async function inventaireConsole() {
  if (estPostgres()) {
    return { ok: false, dit: 'L’inventaire est écrit pour MySQL. Le dire plutôt que d’afficher une liste fausse.' };
  }
  try {
    const db = await connexion();
    const lignes = await db.requete(
      `SELECT s.SCHEMA_NAME AS nom,
              (SELECT COUNT(*) FROM information_schema.TABLES t
                WHERE t.TABLE_SCHEMA = s.SCHEMA_NAME) AS tables_,
              (SELECT COALESCE(SUM(t.TABLE_ROWS), 0) FROM information_schema.TABLES t
                WHERE t.TABLE_SCHEMA = s.SCHEMA_NAME) AS lignes_
         FROM information_schema.SCHEMATA s
        ORDER BY s.SCHEMA_NAME ASC`,
      [],
    );

    const prises = await connexion().then((c) => c.requete(
      `SELECT b.base, b.hote, p.raison_sociale, b.prospect_id
         FROM ${table('bases')} b
         LEFT JOIN ${table('prospects')} p ON p.id = b.prospect_id`,
      [],
    ));
    const hote = process.env.DB_HOST || '';
    const parNom = new Map(
      prises
        .filter((l) => !l.hote || l.hote === hote)
        .map((l) => [l.base, l.raison_sociale || `Prospect ${l.prospect_id}`]),
    );

    return {
      ok: true,
      hote,
      port: Number(process.env.DB_PORT || 3306),
      bases: lignes
        .filter((l) => !SCHEMAS_SYSTEME.has(String(l.nom).toLowerCase()))
        .map((l) => ({
          nom: l.nom,
          tables: Number(l.tables_ || 0),
          lignes: Number(l.lignes_ || 0),
          // Celle de la console : la déclarer pour un client lui donnerait les
          // prospects, les offres, les contrats et les secrets chiffrés de tout
          // le monde. L'écran le dit, et enregistrerBase() le refuse.
          console: l.nom === (process.env.DB_NAME || ''),
          prisePar: parNom.get(l.nom) || null,
        })),
    };
  } catch (err) {
    return { ok: false, dit: `Inventaire indisponible : ${err.code || err.message}` };
  }
}
