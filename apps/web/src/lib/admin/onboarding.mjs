/**
 * Lectures et écritures de l'onboarding — CÔTÉ SERVEUR UNIQUEMENT.
 *
 * Le module qui touche la base. Tout ce qui décide — quelles étapes, quel
 * mapping, quelle journée d'exploitation — vit dans `lib/onboarding/`, sans
 * base et testé ; ici on ne fait que lire, écrire, et appeler.
 *
 * Une règle traverse tout le fichier : **un secret ne remonte jamais.** Les
 * fonctions qui lisent une connexion rendent `secrets_poses` — la liste des
 * champs renseignés et leurs quatre derniers caractères — jamais les valeurs.
 * Seul `secretsDe()` déchiffre, et il n'est appelé que par ce qui parle
 * réellement à la caisse.
 */

import { connexion, estPostgres, lireJson, table, viderCache } from '../db.mjs';
import { chiffrer, dechiffrer, masque } from '../onboarding/coffre.mjs';
import { adaptateurGenerique } from '../onboarding/adaptateur.mjs';
import { capacitesRequises, construireParcours } from '../onboarding/moteur.mjs';
import {
  LigneRefusee,
  mappingIncomplet,
  normaliser,
  sansDonneesPersonnelles,
} from '../onboarding/normalisation.mjs';
import { createHash, randomBytes } from 'node:crypto';

/** Vrai littéral du dialecte. */
const vrai = (v) => (estPostgres() ? Boolean(v) : (v ? 1 : 0));

async function insererEtRendreId(db, sql, params) {
  const { id } = await db.executer(sql, params, 'id');
  if (id === null || id === undefined) throw new Error("L'insertion n'a rendu aucun identifiant.");
  return Number(id);
}

// ---------------------------------------------------------------------------
// Catalogue : capacités, besoins des modules, connecteurs
// ---------------------------------------------------------------------------

export async function listerCapacites() {
  const db = await connexion();
  return db.requete(`SELECT * FROM ${table('capacites')} ORDER BY ordre, cle`);
}

/**
 * Les modules vendables, avec ce dont chacun a besoin.
 *
 * C'est la matière de l'étape 1 : le catalogue existant, annoté de ses
 * capacités. Un module sans besoin déclaré n'en demande aucune — le webshop
 * produit des ventes, il n'en lit pas.
 */
export async function modulesAvecBesoins() {
  const db = await connexion();
  const modules = await db.requete(
    `SELECT id, slug, nom, accroche, benefices, groupe, ordre
     FROM ${table('modules')} WHERE actif = ? ORDER BY ordre, nom`,
    [vrai(true)],
  );
  const besoins = await db.requete(
    `SELECT mc.module_id, mc.requis, mc.note_degradee, c.cle, c.libelle
     FROM ${table('module_capacites')} mc
     JOIN ${table('capacites')} c ON c.id = mc.capacite_id`,
  );
  const parModule = new Map();
  for (const b of besoins) {
    if (!parModule.has(b.module_id)) parModule.set(b.module_id, []);
    parModule.get(b.module_id).push({
      capacite: b.cle, libelle: b.libelle,
      requis: Boolean(b.requis), note_degradee: b.note_degradee,
    });
  }
  return modules.map((m) => {
    const benefices = lireJson(m.benefices, []);
    return {
      ...m,
      // Le premier bénéfice tient lieu de description courte : il est déjà
      // rédigé et déjà traduit, et le réécrire ici en donnerait deux versions.
      quoi: m.accroche || (Array.isArray(benefices) ? benefices[0] : null),
      besoins: parModule.get(m.id) || [],
    };
  });
}

/** Les connecteurs actifs, manifest décodé, avec leurs capacités. */
export async function listerConnecteurs({ tousMemeInactifs = false } = {}) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('connecteurs')}${tousMemeInactifs ? '' : ' WHERE actif = ?'} ORDER BY ordre, nom`,
    tousMemeInactifs ? [] : [vrai(true)],
  );
  const liens = await db.requete(
    `SELECT cc.connecteur_id, c.cle FROM ${table('connecteur_capacites')} cc
     JOIN ${table('capacites')} c ON c.id = cc.capacite_id`,
  );
  const parConnecteur = new Map();
  for (const l of liens) {
    if (!parConnecteur.has(l.connecteur_id)) parConnecteur.set(l.connecteur_id, []);
    parConnecteur.get(l.connecteur_id).push(l.cle);
  }
  return lignes.map((c) => ({
    ...c,
    actif: Boolean(c.actif),
    beta: Boolean(c.beta),
    manifest: lireJson(c.manifest, {}),
    capacites: parConnecteur.get(c.id) || [],
  }));
}

export async function chargerConnecteur(cle) {
  const tous = await listerConnecteurs({ tousMemeInactifs: true });
  return tous.find((c) => c.cle === cle || String(c.id) === String(cle)) || null;
}

/**
 * Enregistre une nouvelle version d'un manifest.
 *
 * La version monte, l'ancienne part à l'historique, et **les connexions déjà
 * posées ne bougent pas** : elles portent leurs propres adresses, recopiées à
 * leur création. Un manifest corrigé ne doit jamais changer sous les pieds
 * d'un client dont la synchro tourne.
 */
export async function enregistrerManifest(cle, manifest, { note = null, utilisateurId = null } = {}) {
  const db = await connexion();
  const connecteur = await chargerConnecteur(cle);
  if (!connecteur) throw new Error(`Le connecteur « ${cle} » n'existe pas.`);
  const version = Number(connecteur.version_manifest || 1) + 1;
  await db.executer(
    `UPDATE ${table('connecteurs')} SET manifest = ?, version_manifest = ? WHERE id = ?`,
    [JSON.stringify(manifest), version, connecteur.id],
  );
  await db.executer(
    `INSERT INTO ${table('connecteur_versions')} (connecteur_id, version, manifest, note, ecrit_le, ecrit_par)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [connecteur.id, version, JSON.stringify(manifest), note, new Date(), utilisateurId],
  );
  viderCache();
  return version;
}

/**
 * Ce qui ne va pas dans un manifest, avant de le publier.
 *
 * Un manifest cassé ne casse pas la console — il casse l'écran de connexion
 * d'un client, en silence, le jour où quelqu'un s'en sert.
 */
export function manifestFautif(manifest) {
  const griefs = [];
  if (!manifest || typeof manifest !== 'object') return ['Ce n’est pas un objet JSON.'];
  if (!manifest.code) griefs.push('Il manque `code`.');
  if (!Array.isArray(manifest.fields) || manifest.fields.length === 0) {
    griefs.push('Aucun champ (`fields`) : le formulaire de connexion serait vide.');
  }
  const points = Array.isArray(manifest.endpoints) ? manifest.endpoints : [];
  if (!points.some((p) => (p.kind || p.genre) === 'ventes')) {
    griefs.push('Aucune adresse de ventes : c’est la seule dont on ne peut pas se passer.');
  }
  for (const champ of manifest.fields || []) {
    if (!champ.code) griefs.push('Un champ sans `code`.');
    if (champ.type === 'secret' && champ.default) {
      griefs.push(`Le champ « ${champ.code} » est un secret : il ne peut pas avoir de valeur par défaut.`);
    }
  }
  for (const p of points) {
    if (!(p.path_template || p.gabarit)) griefs.push(`L’adresse « ${p.kind || p.genre} » n’a pas de chemin.`);
  }
  return griefs;
}

// ---------------------------------------------------------------------------
// Boutiques
// ---------------------------------------------------------------------------

export async function listerBoutiques(prospectId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('boutiques')} WHERE prospect_id = ? ORDER BY ordre, nom`,
    [Number(prospectId)],
  );
  return lignes.map((b) => ({ ...b, actif: Boolean(b.actif) }));
}

export async function ajouterBoutique(prospectId, { nom, adresse = null, fuseau = null, coupure_jour = 4 }) {
  const propre = String(nom || '').trim();
  if (!propre) throw new Error('Une boutique a besoin d’un nom.');
  const db = await connexion();
  const id = await insererEtRendreId(db,
    `INSERT INTO ${table('boutiques')} (prospect_id, nom, adresse, fuseau, coupure_jour, actif, ordre)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [Number(prospectId), propre, adresse || null, fuseau || 'Europe/Brussels',
      Number(coupure_jour) || 0, vrai(true), 100]);
  viderCache();
  return id;
}

export async function enregistrerBoutique(id, valeurs) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('boutiques')} SET nom = ?, adresse = ?, fuseau = ?, coupure_jour = ?, actif = ? WHERE id = ?`,
    [String(valeurs.nom || '').trim(), valeurs.adresse || null,
      valeurs.fuseau || 'Europe/Brussels', Number(valeurs.coupure_jour) || 0,
      vrai(valeurs.actif !== false), Number(id)],
  );
  viderCache();
}

export async function supprimerBoutique(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('boutiques')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

// ---------------------------------------------------------------------------
// Connexions
// ---------------------------------------------------------------------------

/** Les connexions d'un client, ou toutes — sans jamais un secret. */
export async function listerConnexions({ prospectId = null, statut = '' } = {}) {
  const db = await connexion();
  const params = [];
  let ou = '';
  if (prospectId) { ou = 'WHERE x.prospect_id = ?'; params.push(Number(prospectId)); }
  const lignes = await db.requete(
    `SELECT x.*, k.cle AS connecteur_cle, k.nom AS connecteur_nom, p.raison_sociale
     FROM ${table('connexions')} x
     LEFT JOIN ${table('connecteurs')} k ON k.id = x.connecteur_id
     LEFT JOIN ${table('prospects')} p ON p.id = x.prospect_id
     ${ou} ORDER BY x.id DESC`,
    params,
  );
  const dits = lignes.map((c) => ({
    ...c,
    config: lireJson(c.config, {}),
    dernier_test: lireJson(c.dernier_test, null),
  }));
  return statut ? dits.filter((c) => c.statut === statut) : dits;
}

export async function chargerConnexion(id) {
  const toutes = await listerConnexions({});
  return toutes.find((x) => String(x.id) === String(id)) || null;
}

/** Les champs de secret renseignés, et leurs quatre derniers caractères. */
export async function secretsPoses(connexionId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT champ, quatre, version_cle FROM ${table('connexion_secrets')} WHERE connexion_id = ?`,
    [Number(connexionId)],
  );
  return lignes.map((s) => ({ champ: s.champ, masque: masque(s.quatre), version: s.version_cle }));
}

/**
 * Les secrets en clair.
 *
 * **La seule fonction du fichier qui déchiffre.** Elle n'est appelée que par
 * ce qui parle à la caisse — test, échantillon, import — et jamais par une
 * page. Le jour où une route l'appelle, c'est une erreur, et ce commentaire
 * est là pour qu'on s'en souvienne.
 */
export async function secretsDe(connexionId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT champ, chiffre, iv, sceau, version_cle FROM ${table('connexion_secrets')} WHERE connexion_id = ?`,
    [Number(connexionId)],
  );
  const clairs = {};
  for (const s of lignes) {
    clairs[s.champ] = dechiffrer({
      chiffre: s.chiffre, iv: s.iv, sceau: s.sceau, version: s.version_cle,
    });
  }
  return clairs;
}

export async function poserSecret(connexionId, champ, valeur) {
  const paquet = chiffrer(valeur);
  const db = await connexion();
  await db.executer(
    `DELETE FROM ${table('connexion_secrets')} WHERE connexion_id = ? AND champ = ?`,
    [Number(connexionId), String(champ)],
  );
  await db.executer(
    `INSERT INTO ${table('connexion_secrets')}
     (connexion_id, champ, chiffre, iv, sceau, version_cle, quatre, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(connexionId), String(champ), paquet.chiffre, paquet.iv, paquet.sceau,
      paquet.version, paquet.quatre, new Date()],
  );
  viderCache();
}

/**
 * Crée une connexion à partir d'un connecteur.
 *
 * Les adresses du manifest sont **recopiées** sur la connexion. C'est ce qui
 * permet au client de les modifier — une adresse pour les ventes, une autre
 * pour le catalogue — et au manifest d'évoluer sans rien casser chez lui.
 */
export async function creerConnexion({ prospectId, connecteurCle, libelle, config = {}, utilisateurId = null }) {
  const connecteur = await chargerConnecteur(connecteurCle);
  if (!connecteur) throw new Error(`Le connecteur « ${connecteurCle} » n'existe pas.`);
  const db = await connexion();
  const maintenant = new Date();

  const id = await insererEtRendreId(db,
    `INSERT INTO ${table('connexions')}
     (prospect_id, connecteur_id, libelle, statut, config, version_manifest, cree_par, cree_le, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(prospectId), connecteur.id, String(libelle || connecteur.nom), 'brouillon',
      JSON.stringify(sansSecrets(config, connecteur.manifest)),
      connecteur.version_manifest || 1, utilisateurId, maintenant, maintenant]);

  for (const p of connecteur.manifest.endpoints || []) {
    await db.executer(
      `INSERT INTO ${table('connexion_points')} (connexion_id, genre, methode, gabarit, pagination, verifie)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, p.kind || p.genre, p.method || 'GET', p.path_template || p.gabarit,
        JSON.stringify(p.pagination || {}), vrai(false)],
    );
  }
  viderCache();
  return id;
}

/** Retire des valeurs de configuration tout ce que le manifest déclare secret. */
export function sansSecrets(config = {}, manifest = {}) {
  const secrets = new Set((manifest.fields || []).filter((f) => f.type === 'secret').map((f) => f.code));
  const propre = {};
  for (const [cle, valeur] of Object.entries(config)) {
    if (secrets.has(cle)) continue;
    propre[cle] = valeur;
  }
  return propre;
}

export async function enregistrerConfig(connexionId, config, manifest) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('connexions')} SET config = ?, maj_le = ? WHERE id = ?`,
    [JSON.stringify(sansSecrets(config, manifest)), new Date(), Number(connexionId)],
  );
  viderCache();
}

export async function listerPoints(connexionId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('connexion_points')} WHERE connexion_id = ? ORDER BY genre`,
    [Number(connexionId)],
  );
  return lignes.map((p) => ({ ...p, pagination: lireJson(p.pagination, {}), verifie: Boolean(p.verifie) }));
}

export async function enregistrerPoint(connexionId, genre, gabarit) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('connexion_points')} SET gabarit = ? WHERE connexion_id = ? AND genre = ?`,
    [String(gabarit), Number(connexionId), String(genre)],
  );
  viderCache();
}

/** Le manifest « vivant » d'une connexion : celui du connecteur, adresses du client. */
export async function manifestDe(connexionId) {
  const c = await chargerConnexion(connexionId);
  if (!c) return null;
  const connecteur = await chargerConnecteur(c.connecteur_cle);
  const points = await listerPoints(connexionId);
  return {
    ...connecteur.manifest,
    endpoints: points.map((p) => ({
      kind: p.genre, method: p.methode, path_template: p.gabarit, pagination: p.pagination,
    })),
  };
}

/** L'adaptateur d'une connexion, prêt à parler. */
export async function adaptateurDe(connexionId) {
  const manifest = await manifestDe(connexionId);
  if (!manifest) throw new Error("Cette connexion n'existe pas.");
  return adaptateurGenerique(manifest, {
    autoriserLocal: process.env.ONBOARDING_LOCAL === '1',
  });
}

/** Le contexte d'appel : config non secrète + secrets déchiffrés. */
export async function contexteDe(connexionId) {
  const c = await chargerConnexion(connexionId);
  if (!c) throw new Error("Cette connexion n'existe pas.");
  return { config: c.config || {}, secrets: await secretsDe(connexionId) };
}

/**
 * Teste une connexion et garde le résultat.
 *
 * Ne lève jamais : l'écran a besoin d'afficher l'échec autant que le succès,
 * et un échec de test n'est pas une erreur du programme.
 */
export async function testerConnexion(connexionId, { utilisateurId = null } = {}) {
  const db = await connexion();
  const traces = [];
  let resultat;
  try {
    const pos = await adaptateurDe(connexionId);
    const ctx = await contexteDe(connexionId);
    resultat = await pos.tester({ ...ctx, journaliser: (t) => traces.push(t) });
  } catch (err) {
    resultat = { ok: false, code: 'INTERNE', message: err.message, technique: err.message };
  }
  await db.executer(
    `UPDATE ${table('connexions')} SET statut = ?, dernier_test_le = ?, dernier_test = ? WHERE id = ?`,
    [resultat.ok ? 'test' : 'erreur', new Date(),
      JSON.stringify({ ...resultat, traces: traces.slice(-40) }), Number(connexionId)],
  );
  viderCache();
  return resultat;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export async function listerCorrespondances(connexionId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('connexion_correspondances')} WHERE connexion_id = ?`,
    [Number(connexionId)],
  );
  const carte = {};
  for (const l of lignes) {
    carte[l.cible] = { source: l.source, transform: lireJson(l.transform, null), confiance: l.confiance };
  }
  return carte;
}

/**
 * Propose un mapping à partir d'un échantillon.
 *
 * Deux passes : les alias déclarés au manifest, puis une ressemblance de nom.
 * Ce qui vient des alias est marqué `auto` et ne demande rien ; ce qui vient
 * de la ressemblance est `suggeree` et demande confirmation. La différence
 * n'est pas cosmétique — c'est elle qui dit au client où regarder.
 */
export function proposerMapping(echantillon = [], manifest = {}) {
  const ligne = echantillon[0] || {};
  const champs = Object.keys(ligne);
  const alias = manifest.alias || {};
  const transforms = manifest.transforms_proposees || {};
  const carte = {};

  for (const [cible, noms] of Object.entries(alias)) {
    const trouve = noms.find((n) => champs.includes(n));
    if (trouve) {
      carte[cible] = { source: trouve, transform: transforms[cible] || null, confiance: 'auto' };
      continue;
    }
    // Deuxième passe : un champ dont le nom contient l'un des alias. « price »
    // trouve « unit_price_gross ». Marqué « à confirmer », parce que c'est une
    // ressemblance et non une correspondance connue.
    const proche = champs.find((c) => noms.some((n) => c.toLowerCase().includes(n.toLowerCase())));
    if (proche) carte[cible] = { source: proche, transform: transforms[cible] || null, confiance: 'suggeree' };
  }
  return carte;
}

export async function enregistrerMapping(connexionId, carte) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('connexion_correspondances')} WHERE connexion_id = ?`, [Number(connexionId)]);
  for (const [cible, c] of Object.entries(carte)) {
    if (!c || (!c.source && !c.transform)) continue;
    await db.executer(
      `INSERT INTO ${table('connexion_correspondances')} (connexion_id, cible, source, transform, confiance)
       VALUES (?, ?, ?, ?, ?)`,
      [Number(connexionId), cible, c.source || null,
        c.transform ? JSON.stringify(c.transform) : null, c.confiance || 'manuelle'],
    );
  }
  viderCache();
}

export { mappingIncomplet };

// ---------------------------------------------------------------------------
// Rapprochement des boutiques
// ---------------------------------------------------------------------------

export async function listerRapprochements(connexionId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('boutique_correspondances')} WHERE connexion_id = ? ORDER BY externe_libelle, externe_id`,
    [Number(connexionId)],
  );
  return lignes.map((r) => ({ ...r, ignoree: Boolean(r.ignoree) }));
}

/** Une ressemblance simple entre deux noms, pour proposer un rapprochement. */
export function ressemblance(a, b) {
  const nu = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const x = nu(a);
  const y = nu(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.8;
  // Nombre de lettres communes, rapporté à la plus longue : grossier, mais
  // suffisant pour proposer « Atelier Centre » face à « Boulangerie Centre ».
  const communes = [...new Set(x)].filter((c) => y.includes(c)).length;
  return communes / Math.max(x.length, y.length);
}

/**
 * Rafraîchit la liste des boutiques vues chez la caisse.
 *
 * Les rapprochements déjà faits sont conservés : une boutique renommée chez le
 * client ne doit pas perdre son lien. Une boutique apparue depuis la dernière
 * fois arrive sans lien, et l'écran la signale — c'est le cas « une nouvelle
 * boutique est apparue dans votre caisse ».
 */
export async function rafraichirBoutiquesDistantes(connexionId, prospectId) {
  const pos = await adaptateurDe(connexionId);
  const ctx = await contexteDe(connexionId);
  const rep = await pos.lister('boutiques', ctx);
  if (!rep.ok) return rep;

  const db = await connexion();
  const connues = new Map((await listerRapprochements(connexionId)).map((r) => [r.externe_id, r]));
  const notres = await listerBoutiques(prospectId);
  let nouvelles = 0;

  for (const brute of rep.elements) {
    const externeId = String(brute.id ?? brute.uuid ?? brute.code ?? '').trim();
    if (!externeId) continue;
    const libelle = String(brute.name ?? brute.nom ?? brute.label ?? externeId);
    if (connues.has(externeId)) {
      await db.executer(
        `UPDATE ${table('boutique_correspondances')} SET externe_libelle = ? WHERE id = ?`,
        [libelle, connues.get(externeId).id],
      );
      continue;
    }
    // Proposition par ressemblance de nom, au-dessus d'un seuil : en dessous,
    // mieux vaut ne rien proposer que proposer n'importe quoi.
    const meilleure = notres
      .map((b) => ({ b, score: ressemblance(libelle, b.nom) }))
      .sort((a, c) => c.score - a.score)[0];
    await db.executer(
      `INSERT INTO ${table('boutique_correspondances')}
       (connexion_id, externe_id, externe_libelle, boutique_id, ignoree) VALUES (?, ?, ?, ?, ?)`,
      [Number(connexionId), externeId, libelle,
        meilleure && meilleure.score >= 0.6 ? meilleure.b.id : null, vrai(false)],
    );
    nouvelles += 1;
  }
  viderCache();
  return { ok: true, vues: rep.elements.length, nouvelles };
}

export async function rapprocher(id, { boutiqueId = null, ignoree = false }) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('boutique_correspondances')} SET boutique_id = ?, ignoree = ? WHERE id = ?`,
    [boutiqueId ? Number(boutiqueId) : null, vrai(ignoree), Number(id)],
  );
  viderCache();
}

/** Ce qui reste à trancher : ni rapproché, ni explicitement ignoré. */
export function rapprochementsEnSuspens(rapprochements = []) {
  return rapprochements.filter((r) => !r.boutique_id && !r.ignoree);
}

// ---------------------------------------------------------------------------
// Ingestion
// ---------------------------------------------------------------------------

/** L'empreinte d'une ligne brute, stable d'une exécution à l'autre. */
export function empreinteLigne(objet) {
  // Les clés triées, sans quoi deux réponses identiques dont l'ordre des
  // champs diffère donneraient deux empreintes — et un doublon.
  const canonique = JSON.stringify(objet, Object.keys(objet).sort());
  return createHash('sha256').update(canonique).digest('hex');
}

/**
 * Écrit une page de ventes : brut, puis normalisé.
 *
 * L'idempotence tient à deux clés uniques, et non à un contrôle applicatif :
 * rejouer la même page deux fois est refusé par la base, pas par une lecture
 * préalable qui laisserait une fenêtre entre le contrôle et l'écriture.
 */
export async function ecrirePage(connexionId, lignes, {
  passageId = null, prospectId, correspondances, boutiques, devise = 'EUR', connecteur = null,
} = {}) {
  const db = await connexion();
  const parExterne = new Map(boutiques.map((b) => [b.externe_id, b]));
  let inserees = 0;
  let doublons = 0;
  let rejetees = 0;

  for (const brute of lignes) {
    const propre = sansDonneesPersonnelles(brute);
    const empreinte = empreinteLigne(propre);

    let bruteId = null;
    try {
      bruteId = await insererEtRendreId(db,
        `INSERT INTO ${table('ventes_brutes')} (connexion_id, passage_id, charge, empreinte, recue_le)
         VALUES (?, ?, ?, ?, ?)`,
        [Number(connexionId), passageId, JSON.stringify(propre), empreinte, new Date()]);
    } catch (err) {
      // Déjà vue : c'est exactement ce qu'on veut d'un rejeu. On continue
      // quand même vers la normalisation, parce qu'un mapping corrigé doit
      // pouvoir réécrire la ligne normalisée sans réinterroger la caisse.
      if (!estDoublon(err)) throw err;
      doublons += 1;
    }

    let ligne;
    try {
      const rapprochee = parExterne.get(String(propre[correspondances.boutique_externe_id?.source] ?? ''));
      ligne = normaliser(propre, {
        correspondances,
        boutique: rapprochee ? rapprochee.boutique || {} : {},
        devise,
        connecteur,
      });
      if (rapprochee && rapprochee.ignoree) continue;
    } catch (err) {
      if (!(err instanceof LigneRefusee)) throw err;
      await db.executer(
        `INSERT INTO ${table('sync_rebut')} (connexion_id, passage_id, charge, code_erreur, detail, essais, cree_le)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [Number(connexionId), passageId, JSON.stringify(propre), err.code, err.message, 0, new Date()],
      );
      rejetees += 1;
      continue;
    }

    const boutique = parExterne.get(ligne.boutique_externe_id);
    const colonnes = [
      'prospect_id', 'connexion_id', 'boutique_id', 'externe_id', 'commande_externe_id',
      'boutique_externe_id', 'vendu_le', 'jour_exploitation', 'heure', 'produit_externe_id',
      'produit_libelle', 'categorie_externe_id', 'categorie_libelle', 'quantite',
      'prix_unitaire_ht', 'prix_unitaire_ttc', 'taux_tva', 'remise', 'total_ht', 'total_ttc',
      'devise', 'moyen_paiement', 'canal', 'connecteur', 'brute_id', 'recue_le',
    ];
    const valeurs = [
      Number(prospectId), Number(connexionId), boutique?.boutique_id || null,
      ligne.externe_id, ligne.commande_externe_id, ligne.boutique_externe_id,
      ligne.vendu_le, ligne.jour_exploitation, ligne.heure, ligne.produit_externe_id,
      ligne.produit_libelle, ligne.categorie_externe_id, ligne.categorie_libelle, ligne.quantite,
      ligne.prix_unitaire_ht, ligne.prix_unitaire_ttc, ligne.taux_tva, ligne.remise,
      ligne.total_ht, ligne.total_ttc, ligne.devise, ligne.moyen_paiement, ligne.canal,
      ligne.connecteur, bruteId, new Date(),
    ];
    try {
      await db.executer(
        `INSERT INTO ${table('ventes')} (${colonnes.join(', ')}) VALUES (${colonnes.map(() => '?').join(', ')})`,
        valeurs,
      );
      inserees += 1;
    } catch (err) {
      if (!estDoublon(err)) throw err;
      // Déjà connue : on la met à jour. Une caisse corrige un ticket après
      // coup, et la fenêtre glissante nous le ramène — c'est fait pour.
      const sansCles = colonnes.slice(2);
      await db.executer(
        `UPDATE ${table('ventes')} SET ${sansCles.map((c) => `${c} = ?`).join(', ')}
         WHERE connexion_id = ? AND externe_id = ?`,
        [...valeurs.slice(2), Number(connexionId), ligne.externe_id],
      );
    }
  }
  return { inserees, doublons, rejetees };
}

/** L'erreur de la base dit-elle « cette ligne existe déjà » ? */
function estDoublon(err) {
  const m = String(err?.message || '');
  return err?.code === 'ER_DUP_ENTRY' || err?.code === '23505'
    || /duplicate|unique/i.test(m);
}

// ---------------------------------------------------------------------------
// Parcours
// ---------------------------------------------------------------------------

export async function chargerParcours(prospectId) {
  const db = await connexion();
  const [p] = await db.requete(
    `SELECT * FROM ${table('parcours')} WHERE prospect_id = ? ORDER BY id DESC LIMIT 1`,
    [Number(prospectId)],
  );
  if (!p) return null;
  const etapes = await db.requete(
    `SELECT * FROM ${table('parcours_etapes')} WHERE parcours_id = ? ORDER BY ordre`,
    [p.id],
  );
  return {
    ...p,
    etat: lireJson(p.etat, {}),
    etapes: etapes.map((e) => ({ ...e, charge: lireJson(e.charge, {}) })),
  };
}

export async function ouvrirParcours(prospectId) {
  const deja = await chargerParcours(prospectId);
  if (deja && deja.statut === 'en_cours') return deja;
  const db = await connexion();
  const maintenant = new Date();
  await insererEtRendreId(db,
    `INSERT INTO ${table('parcours')} (prospect_id, statut, etape_courante, etat, jeton_reprise, debut_le, activite_le)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [Number(prospectId), 'en_cours', 'entreprise', JSON.stringify({}),
      randomBytes(24).toString('base64url'), maintenant, maintenant]);
  viderCache();
  return chargerParcours(prospectId);
}

/** Marque une étape faite, et note ce qui s'y est décidé. */
export async function marquerEtape(parcoursId, cle, { connexionId = null, charge = null, utilisateurId = null } = {}) {
  const db = await connexion();
  const maintenant = new Date();
  const [deja] = await db.requete(
    `SELECT id FROM ${table('parcours_etapes')}
     WHERE parcours_id = ? AND cle = ? AND ${connexionId ? 'connexion_id = ?' : 'connexion_id IS NULL'} LIMIT 1`,
    connexionId ? [Number(parcoursId), cle, Number(connexionId)] : [Number(parcoursId), cle],
  );
  if (deja) {
    await db.executer(
      `UPDATE ${table('parcours_etapes')} SET statut = ?, charge = ?, fait_le = ?, fait_par = ? WHERE id = ?`,
      ['faite', charge ? JSON.stringify(charge) : null, maintenant, utilisateurId, deja.id],
    );
  } else {
    await db.executer(
      `INSERT INTO ${table('parcours_etapes')} (parcours_id, connexion_id, cle, ordre, statut, charge, fait_le, fait_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(parcoursId), connexionId, cle, 100, 'faite',
        charge ? JSON.stringify(charge) : null, maintenant, utilisateurId],
    );
  }
  await db.executer(
    `UPDATE ${table('parcours')} SET activite_le = ?, etape_courante = ? WHERE id = ?`,
    [maintenant, cle, Number(parcoursId)],
  );
  viderCache();
}

export async function journaliserParcours(parcoursId, { type, texte, detail = null, connexionId = null, utilisateurId = null }) {
  const db = await connexion();
  await db.executer(
    `INSERT INTO ${table('parcours_journal')} (parcours_id, connexion_id, type, texte, detail, quand, utilisateur_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [Number(parcoursId), connexionId, type, texte, detail ? JSON.stringify(detail) : null,
      new Date(), utilisateurId],
  );
}

export async function lireJournalParcours(parcoursId, limite = 60) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT j.*, u.nom AS qui FROM ${table('parcours_journal')} j
     LEFT JOIN ${table('utilisateurs')} u ON u.id = j.utilisateur_id
     WHERE j.parcours_id = ? ORDER BY j.id DESC`,
    [Number(parcoursId)],
  );
  return lignes.slice(0, limite).map((l) => ({ ...l, detail: lireJson(l.detail, null) }));
}

/**
 * L'état complet d'un parcours : modules choisis, caisses, étapes, avancement.
 *
 * Une seule fonction pour tous les écrans de l'assistant — sans quoi chacun
 * recalculerait sa propre idée de « où en est-on », et ils finiraient par ne
 * plus être d'accord.
 */
export async function etatParcours(prospectId) {
  const parcours = await chargerParcours(prospectId);
  const modules = await modulesAvecBesoins();
  const connexions = await listerConnexions({ prospectId });
  const choisis = new Set((parcours?.etat?.modules) || []);
  const retenus = modules.filter((m) => choisis.has(m.slug));

  const groupes = connexions.map((c) => ({
    cle: String(c.id),
    id: c.id,
    nom: c.libelle || c.connecteur_nom,
    connecteur: c.connecteur_cle,
    statut: c.statut,
  }));

  const plan = construireParcours({ modules: retenus, groupes });
  const faites = (parcours?.etapes || [])
    .filter((e) => e.statut === 'faite')
    .map((e) => (e.connexion_id ? `${e.connexion_id}:${e.cle}` : e.cle));

  return { parcours, modules, retenus, connexions, plan, faites, capacites: capacitesRequises(retenus) };
}
