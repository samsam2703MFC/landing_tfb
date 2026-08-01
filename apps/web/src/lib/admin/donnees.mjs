/**
 * Lectures et écritures de la console — CÔTÉ SERVEUR UNIQUEMENT.
 *
 * Deux différences avec `lib/db.mjs`, qui sert les pages publiques :
 *   · aucune mise en cache — la console doit voir l'état réel de la base ;
 *   · les erreurs remontent, au lieu d'être avalées au profit d'un repli.
 *
 * Après chaque écriture on vide le cache de lecture, sinon la modification
 * n'apparaîtrait sur le site qu'au bout de CACHE_TTL_MS.
 */

import { connexion, estPostgres, lireJson, table, viderCache } from '../db.mjs';
import { enCents, lireTarif, saisirTarif } from '../offres/montants.mjs';
import { calculerOffre, lignesDe } from '../offres/calcul.mjs';
import { ROLES, empreinteValide, hacher } from './session.mjs';

/** Vrai littéral du dialecte : MySQL n'a pas de type booléen. */
function vrai(valeur) {
  return estPostgres() ? Boolean(valeur) : valeur ? 1 : 0;
}

/** Sérialise une valeur destinée à une colonne JSON. */
function json(valeur) {
  return JSON.stringify(valeur ?? []);
}

/**
 * Insère et rend l'identifiant créé.
 *
 * `executer` prend en troisième argument le nom de la colonne à récupérer :
 * PostgreSQL la rend par `RETURNING`, MySQL par `insertId` et ignore
 * l'argument. Cette enveloppe évite d'avoir à s'en souvenir à chaque appel.
 */
async function insererEtRendreId(db, sql, params) {
  const { id } = await db.executer(sql, params, 'id');
  if (id === null || id === undefined) throw new Error("L'insertion n'a rendu aucun identifiant.");
  return Number(id);
}

/** Les colonnes du module éditables depuis la console, dans l'ordre du formulaire. */
export const CHAMPS_MODULE = [
  { nom: 'nom', libelle: 'Nom', type: 'ligne' },
  { nom: 'accroche', libelle: 'Accroche', type: 'ligne', aide: "Une phrase, affichée sous le nom sur la carte du module." },
  { nom: 'resume', libelle: 'Résumé', type: 'zone', lignes: 4 },
  { nom: 'public_cible', libelle: 'Public visé', type: 'ligne' },
  { nom: 'groupe', libelle: 'Famille', type: 'ligne', aide: 'Sert à regrouper les modules sur la page d’accueil.' },
  { nom: 'icone', libelle: 'Icône', type: 'ligne', aide: 'Nom du jeu TFB : shopping-cart, store, truck, handshake, chef-hat…' },
  { nom: 'onboarding', libelle: 'Phrase d’onboarding', type: 'zone', lignes: 3, aide: "Ce que le nouveau client lit quand il clique sur ce module dans le fil." },
  { nom: 'description', libelle: 'Description longue', type: 'zone', lignes: 14, aide: 'Markdown accepté. Un paragraphe par idée.' },
  // Les colonnes `mermaid` (module et site) existent toujours en base, mais
  // aucune page publique ne les rend : proposer le champ ferait croire à un
  // réglage qui ne change rien. Les remettre ici le jour où le schéma est rendu.
];

/** Les colonnes de la page d’accueil éditables depuis la console. */
export const CHAMPS_SITE = [
  { nom: 'titre', libelle: 'Titre principal', type: 'zone', lignes: 2 },
  { nom: 'sous_titre', libelle: 'Sous-titre', type: 'zone', lignes: 2 },
  { nom: 'accroche', libelle: 'Accroche', type: 'zone', lignes: 6 },
  { nom: 'cta_texte', libelle: 'Libellé du bouton', type: 'ligne' },
  { nom: 'cta_url', libelle: 'Cible du bouton', type: 'ligne' },
  { nom: 'meta_description', libelle: 'Description pour les moteurs', type: 'zone', lignes: 3 },
];

/** Décode les colonnes JSON d’un module. */
function normaliser(ligne) {
  return {
    ...ligne,
    actif: Boolean(ligne.actif),
    nouveau: ligne.statut === 'nouveau',
    problemes: lireJson(ligne.problemes, []),
    benefices: lireJson(ligne.benefices, []),
    stack: lireJson(ligne.stack, []),
    mots_cles: lireJson(ligne.mots_cles, []),
    leviers: lireJson(ligne.leviers, []),
    liens: lireJson(ligne.liens, []),
  };
}

/** Compte les lignes de chaque table — le tableau de bord de la console. */
export async function compteurs() {
  const db = await connexion();
  const [modules] = await db.requete(
    `SELECT COUNT(*) AS total FROM ${table('modules')}`,
  );
  const [actifs] = await db.requete(
    `SELECT COUNT(*) AS total FROM ${table('modules')} WHERE actif = ?`,
    [vrai(true)],
  );
  const [fonctions] = await db.requete(`SELECT COUNT(*) AS total FROM ${table('fonctions')}`);
  const [captures] = await db.requete(`SELECT COUNT(*) AS total FROM ${table('captures')}`);
  const [textes] = await db.requete(`SELECT COUNT(*) AS total FROM ${table('textes')}`);
  const [langues] = await db.requete(`SELECT COUNT(*) AS total FROM ${table('langues')} WHERE publiee = ?`, [vrai(true)]);
  const [leads] = await db.requete(`SELECT COUNT(*) AS total FROM ${table('leads')} WHERE traite = ?`, [vrai(false)]);
  const [clients] = await db.requete(`SELECT COUNT(*) AS total FROM ${table('clients')}`);
  const [questions] = await db.requete(`SELECT COUNT(*) AS total FROM ${table('questions')}`);
  const [prestations] = await db.requete(
    `SELECT COUNT(*) AS total FROM ${table('prestations')} WHERE actif = ?`,
    [vrai(true)],
  );
  const [offres] = await db.requete(
    `SELECT COUNT(*) AS total FROM ${table('offres')} WHERE statut = 'brouillon'`,
  );
  const [aValider] = await db.requete(
    `SELECT (SELECT COUNT(*) FROM ${table('modules')} WHERE statut = 'nouveau')
          + (SELECT COUNT(*) FROM ${table('fonctions')} WHERE statut = 'nouveau') AS total`,
  );
  const nombre = (ligne) => Number(ligne?.total ?? ligne?.TOTAL ?? 0);
  return {
    modules: nombre(modules),
    actifs: nombre(actifs),
    fonctions: nombre(fonctions),
    captures: nombre(captures),
    textes: nombre(textes),
    langues: nombre(langues),
    leads: nombre(leads),
    clients: nombre(clients),
    questions: nombre(questions),
    prestations: nombre(prestations),
    offres: nombre(offres),
    aValider: nombre(aValider),
  };
}

/** Tous les modules, actifs ou non, avec leur nombre de fonctions et de captures. */
export async function listerModules() {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('modules')} ORDER BY ordre, nom`,
  );
  const fonctions = await db.requete(
    `SELECT module_id, COUNT(*) AS total FROM ${table('fonctions')} GROUP BY module_id`,
  );
  const captures = await db.requete(
    `SELECT module_id, COUNT(*) AS total FROM ${table('captures')} GROUP BY module_id`,
  );
  const compte = (liste, id) => Number(liste.find((l) => l.module_id === id)?.total ?? 0);
  const nouvelles = await db.requete(
    `SELECT module_id, COUNT(*) AS total FROM ${table('fonctions')} WHERE statut = 'nouveau' GROUP BY module_id`,
  );
  return lignes.map((l) => ({
    ...normaliser(l),
    nb_fonctions: compte(fonctions, l.id),
    nb_captures: compte(captures, l.id),
    nb_nouvelles: compte(nouvelles, l.id),
  }));
}

/** Un module avec ses fonctions et ses captures. `null` si le slug est inconnu. */
export async function chargerModuleAdmin(slug) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('modules')} WHERE slug = ? LIMIT 1`,
    [slug],
  );
  if (lignes.length === 0) return null;
  const module = normaliser(lignes[0]);

  const fonctions = await db.requete(
    `SELECT * FROM ${table('fonctions')} WHERE module_id = ? ORDER BY ordre, id`,
    [module.id],
  );
  module.fonctions = fonctions.map((f) => ({
    ...f,
    leviers: lireJson(f.leviers, []),
    nouveau: f.statut === 'nouveau',
    en_ligne: Boolean(f.en_ligne),
  }));

  module.captures = await db.requete(
    `SELECT * FROM ${table('captures')} WHERE module_id = ? ORDER BY ordre, id`,
    [module.id],
  );
  return module;
}

/** Les slugs et noms de tous les modules — pour les listes de liens. */
export async function slugsModules() {
  const db = await connexion();
  return db.requete(`SELECT slug, nom FROM ${table('modules')} ORDER BY ordre, nom`);
}

/** Enregistre les champs textuels d’un module, plus ses leviers et ses liens. */
export async function enregistrerModule(slug, valeurs) {
  const db = await connexion();
  const colonnes = [...CHAMPS_MODULE.map((c) => c.nom), 'ordre', 'actif'];
  const affectations = colonnes.map((c) => `${c} = ?`);
  const params = colonnes.map((c) => (c === 'actif' ? vrai(valeurs.actif) : valeurs[c] ?? null));

  // Les colonnes JSON passent par le sérialiseur, jamais par la valeur brute.
  for (const [colonne, valeur] of [
    ['leviers', valeurs.leviers],
    ['liens', valeurs.liens],
    ['problemes', valeurs.problemes],
    ['benefices', valeurs.benefices],
    ['stack', valeurs.stack],
    ['mots_cles', valeurs.mots_cles],
  ]) {
    affectations.push(`${colonne} = ?`);
    params.push(json(valeur));
  }

  params.push(slug);
  await db.executer(
    `UPDATE ${table('modules')} SET ${affectations.join(', ')} WHERE slug = ?`,
    params,
  );
  viderCache();
}

/** Bascule l’affichage d’un module sur le site public. */
export async function basculerModule(slug, actif) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('modules')} SET actif = ? WHERE slug = ?`,
    [vrai(actif), slug],
  );
  viderCache();
}

/** Enregistre une fonction existante. */
export async function enregistrerFonction(id, valeurs) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('fonctions')}
        SET nom = ?, description = ?, benefice = ?, icone = ?, ordre = ?, leviers = ?
      WHERE id = ?`,
    [
      valeurs.nom ?? null,
      valeurs.description ?? null,
      valeurs.benefice ?? null,
      valeurs.icone ?? null,
      Number(valeurs.ordre) || 100,
      json(valeurs.leviers),
      Number(id),
    ],
  );
  viderCache();
}

/**
 * Ajoute une fonction. La clé identifie la fonction pour tout le pipeline :
 * elle doit rester stable et unique dans le module, sans quoi une ingestion
 * ultérieure créerait un doublon au lieu de mettre à jour la ligne.
 */
export async function ajouterFonction(moduleId, valeurs) {
  const db = await connexion();
  const cle = normaliserCle(valeurs.cle);
  if (!cle) throw new Error('La clé de la fonction est obligatoire.');

  const existantes = await db.requete(
    `SELECT id FROM ${table('fonctions')} WHERE module_id = ? AND cle = ? LIMIT 1`,
    [Number(moduleId), cle],
  );
  if (existantes.length > 0) throw new Error(`La clé « ${cle} » existe déjà dans ce module.`);

  await db.executer(
    `INSERT INTO ${table('fonctions')} (module_id, cle, nom, description, benefice, icone, ordre, leviers)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(moduleId),
      cle,
      valeurs.nom ?? cle,
      valeurs.description ?? null,
      valeurs.benefice ?? null,
      valeurs.icone || 'layers',
      Number(valeurs.ordre) || 100,
      json(valeurs.leviers),
    ],
  );
  viderCache();
}

/** Supprime une fonction. */
export async function supprimerFonction(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('fonctions')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

/** Toutes les captures, avec le module auquel elles appartiennent. */
export async function listerCaptures() {
  const db = await connexion();
  return db.requete(
    `SELECT c.*, m.slug AS module_slug, m.nom AS module_nom
       FROM ${table('captures')} c
       JOIN ${table('modules')} m ON m.id = c.module_id
      ORDER BY m.ordre, c.ordre, c.id`,
  );
}

/** Enregistre le titre, le rattachement et l’ordre d’une capture. */
export async function enregistrerCapture(id, valeurs) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('captures')} SET titre = ?, fonction_cle = ?, ordre = ? WHERE id = ?`,
    [valeurs.titre || null, valeurs.fonction_cle || null, Number(valeurs.ordre) || 100, Number(id)],
  );
  viderCache();
}

/**
 * Supprime la ligne d’une capture. Le fichier reste dans `public/captures/` :
 * il sera de toute façon régénéré au prochain `sync-captures.mjs`, et la
 * console n’a pas à écrire sur le disque du serveur.
 */
export async function supprimerCapture(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('captures')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

/** La ligne unique de la page d’accueil. */
export async function chargerSiteAdmin() {
  const db = await connexion();
  const lignes = await db.requete(`SELECT * FROM ${table('site')} ORDER BY id LIMIT 1`);
  if (lignes.length === 0) return null;
  return {
    ...lignes[0],
    problemes: lireJson(lignes[0].problemes, []),
    reponses: lireJson(lignes[0].reponses, []),
  };
}

/** Enregistre la page d’accueil. */
export async function enregistrerSite(id, valeurs) {
  const db = await connexion();
  const colonnes = CHAMPS_SITE.map((c) => c.nom);
  const affectations = [...colonnes.map((c) => `${c} = ?`), 'problemes = ?', 'reponses = ?'];
  const params = [
    ...colonnes.map((c) => valeurs[c] ?? null),
    json(valeurs.problemes),
    json(valeurs.reponses),
    Number(id),
  ];
  await db.executer(`UPDATE ${table('site')} SET ${affectations.join(', ')} WHERE id = ?`, params);
  viderCache();
}

/** Une clé technique : minuscules, chiffres et tirets seulement. */
export function normaliserCle(brut) {
  return String(brut || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Relit une liste de blocs « titre + texte » depuis un formulaire.
 * Les lignes entièrement vides sont écartées : supprimer un bloc revient à
 * vider ses deux champs.
 */
export function lireBlocs(formulaire, prefixe) {
  const titres = formulaire.getAll(`${prefixe}_titre`);
  const textes = formulaire.getAll(`${prefixe}_texte`);
  const blocs = [];
  for (let i = 0; i < titres.length; i += 1) {
    const titre = String(titres[i] || '').trim();
    const texte = String(textes[i] || '').trim();
    if (titre || texte) blocs.push({ titre, texte });
  }
  return blocs;
}

/** Relit une liste séparée par des virgules ou des retours à la ligne. */
export function lireListe(valeur) {
  return String(valeur || '')
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Relit les liens inter-modules d’un formulaire. */
export function lireLiens(formulaire) {
  const slugs = formulaire.getAll('lien_slug');
  const sens = formulaire.getAll('lien_sens');
  const quoi = formulaire.getAll('lien_quoi');
  const liens = [];
  for (let i = 0; i < slugs.length; i += 1) {
    const slug = String(slugs[i] || '').trim();
    if (!slug) continue;
    liens.push({
      slug,
      sens: sens[i] === 'recoit' ? 'recoit' : 'envoie',
      quoi: String(quoi[i] || '').trim(),
    });
  }
  return liens;
}

// ---------------------------------------------------------------------------
// Le contenu éditorial : textes, réseaux, langues, demandes reçues
// ---------------------------------------------------------------------------

/** Les textes des pages, groupés par section dans l'ordre de la maquette. */
export async function listerTextes() {
  const db = await connexion();
  const lignes = await db.requete(`SELECT * FROM ${table('textes')} ORDER BY ordre, cle`);
  const sections = new Map();
  for (const l of lignes) {
    const nom = l.section || 'Divers';
    if (!sections.has(nom)) sections.set(nom, []);
    sections.get(nom).push(l);
  }
  return [...sections.entries()].map(([nom, textes]) => ({ nom, textes }));
}

/** Enregistre d'un coup les textes modifiés. */
export async function enregistrerTextes(formulaire) {
  const db = await connexion();
  const ids = formulaire.getAll('texte_id');
  const valeurs = formulaire.getAll('texte_valeur');
  let ecrits = 0;
  for (let i = 0; i < ids.length; i += 1) {
    await db.executer(
      `UPDATE ${table('textes')} SET valeur = ? WHERE id = ?`,
      [String(valeurs[i] ?? ''), Number(ids[i])],
    );
    ecrits += 1;
  }
  viderCache();
  return ecrits;
}

/** Les demandes de démonstration, les plus récentes d'abord. */
export async function listerLeads() {
  const db = await connexion();
  const lignes = await db.requete(`SELECT * FROM ${table('leads')} ORDER BY recu_le DESC, id DESC`);
  return lignes.map((l) => ({ ...l, traite: Boolean(l.traite) }));
}

/** Marque une demande comme traitée, ou la remet en attente. */
export async function marquerLead(id, traite) {
  const db = await connexion();
  await db.executer(`UPDATE ${table('leads')} SET traite = ? WHERE id = ?`, [vrai(traite), Number(id)]);
  viderCache();
}

/** Supprime une demande — une fois traitée, elle n'a pas à traîner. */
export async function supprimerLead(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('leads')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

/** Les réseaux du bandeau, publiés ou non. */
export async function listerClients() {
  const db = await connexion();
  const lignes = await db.requete(`SELECT * FROM ${table('clients')} ORDER BY ordre, nom`);
  return lignes.map((c) => ({ ...c, actif: Boolean(c.actif) }));
}

/** Ajoute un réseau au bandeau. */
export async function ajouterClient(valeurs) {
  const nom = String(valeurs.nom || '').trim();
  if (!nom) throw new Error('Le nom du réseau est obligatoire.');
  const db = await connexion();
  await db.executer(
    `INSERT INTO ${table('clients')} (nom, note, actif, ordre) VALUES (?, ?, ?, ?)`,
    [nom.slice(0, 160), String(valeurs.note || '').trim().slice(0, 255) || null, vrai(true), Number(valeurs.ordre) || 100],
  );
  viderCache();
}

/** Enregistre un réseau existant. */
export async function enregistrerClient(id, valeurs) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('clients')} SET nom = ?, note = ?, actif = ?, ordre = ? WHERE id = ?`,
    [
      String(valeurs.nom || '').trim().slice(0, 160),
      String(valeurs.note || '').trim().slice(0, 255) || null,
      vrai(valeurs.actif),
      Number(valeurs.ordre) || 100,
      Number(id),
    ],
  );
  viderCache();
}

/** Retire un réseau du bandeau. */
export async function supprimerClient(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('clients')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

/**
 * Les questions de l'onboarding. Chacune porte les slugs des modules qu'elle
 * fait apparaître : c'est le seul endroit où se décide ce que le franchiseur
 * voit s'assembler quand il coche.
 */
export async function listerQuestions() {
  const db = await connexion();
  const lignes = await db.requete(`SELECT * FROM ${table('questions')} ORDER BY ordre, id`);
  return lignes.map((q) => ({ ...q, slugs: lireJson(q.slugs, []) }));
}

/** Ajoute une question au questionnaire. */
export async function ajouterQuestion(valeurs) {
  const cle = normaliserCle(valeurs.cle);
  if (!cle) throw new Error('La clé de la question est obligatoire.');
  const db = await connexion();
  const existantes = await db.requete(`SELECT id FROM ${table('questions')} WHERE cle = ? LIMIT 1`, [cle]);
  if (existantes.length > 0) throw new Error(`La clé « ${cle} » existe déjà.`);
  await db.executer(
    `INSERT INTO ${table('questions')} (cle, tag, texte, cible, slugs, ordre) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      cle,
      String(valeurs.tag || 'Problème').trim().slice(0, 20),
      String(valeurs.texte || '').trim(),
      String(valeurs.cible || '').trim().slice(0, 120) || null,
      json(valeurs.slugs),
      Number(valeurs.ordre) || 100,
    ],
  );
  viderCache();
}

/** Enregistre une question existante. La clé ne bouge pas : elle sert d'ancre HTML. */
export async function enregistrerQuestion(id, valeurs) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('questions')} SET tag = ?, texte = ?, cible = ?, slugs = ?, ordre = ? WHERE id = ?`,
    [
      String(valeurs.tag || 'Problème').trim().slice(0, 20),
      String(valeurs.texte || '').trim(),
      String(valeurs.cible || '').trim().slice(0, 120) || null,
      json(valeurs.slugs),
      Number(valeurs.ordre) || 100,
      Number(id),
    ],
  );
  viderCache();
}

/** Retire une question du questionnaire. */
export async function supprimerQuestion(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('questions')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

/** Les langues prévues, avec leur état de publication. */
export async function listerLangues() {
  const db = await connexion();
  const lignes = await db.requete(`SELECT * FROM ${table('langues')} ORDER BY ordre, code`);
  return lignes.map((l) => ({ ...l, rtl: Boolean(l.rtl), defaut: Boolean(l.defaut), publiee: Boolean(l.publiee) }));
}

/**
 * Publie ou retire une langue. La langue par défaut ne se dépublie pas : le
 * site n'aurait plus rien à servir.
 */
export async function basculerLangue(code, publiee) {
  const db = await connexion();
  const lignes = await db.requete(`SELECT defaut FROM ${table('langues')} WHERE code = ? LIMIT 1`, [String(code)]);
  if (lignes.length === 0) throw new Error(`Langue « ${code} » inconnue.`);
  if (Boolean(lignes[0].defaut) && !publiee) {
    throw new Error('La langue par défaut ne peut pas être retirée : le site n’aurait plus rien à servir.');
  }
  await db.executer(`UPDATE ${table('langues')} SET publiee = ? WHERE code = ?`, [vrai(publiee), String(code)]);
  viderCache();
}

// ---------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------

/** Les comptes de la console. L'empreinte n'en sort jamais. */
export async function listerUtilisateurs() {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT id, identifiant, nom, role, actif, cree_le, vu_le FROM ${table('utilisateurs')}
     ORDER BY role, identifiant`,
  );
  return lignes.map((l) => ({ ...l, actif: Boolean(l.actif) }));
}

/** Un compte par son identifiant, empreinte comprise — pour la connexion seule. */
export async function utilisateurParIdentifiant(identifiant) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('utilisateurs')} WHERE identifiant = ? LIMIT 1`,
    [String(identifiant || '').trim().toLowerCase()],
  );
  return lignes[0] || null;
}

/** Un compte par son identifiant numérique, sans son empreinte. */
export async function utilisateurParId(id) {
  if (!Number(id)) return null;
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT id, identifiant, nom, role, actif FROM ${table('utilisateurs')} WHERE id = ? LIMIT 1`,
    [Number(id)],
  );
  const u = lignes[0];
  return u ? { ...u, actif: Boolean(u.actif) } : null;
}

/**
 * Vérifie un couple identifiant / mot de passe.
 *
 * Le mot de passe est vérifié **même quand le compte est inconnu ou
 * désactivé** : sans ce calcul à vide, la réponse reviendrait instantanément
 * pour un identifiant qui n'existe pas et lentement pour un qui existe, ce
 * qui suffit à énumérer les comptes.
 */
export async function verifierIdentifiants(identifiant, motDePasse) {
  const compte = await utilisateurParIdentifiant(identifiant);
  const bon = empreinteValide(motDePasse, compte?.empreinte || EMPREINTE_LEURRE);
  if (!compte || !compte.actif || !bon) return null;

  const db = await connexion();
  await db.executer(`UPDATE ${table('utilisateurs')} SET vu_le = ? WHERE id = ?`, [new Date(), compte.id]);
  return { id: compte.id, identifiant: compte.identifiant, nom: compte.nom, role: compte.role };
}

/**
 * Une empreinte valide mais qui ne correspond à rien, pour que la
 * vérification coûte le même temps quand le compte n'existe pas.
 * Calculée une fois au démarrage.
 */
const EMPREINTE_LEURRE = hacher(`leurre-${Date.now()}-${Math.random()}`);

export async function ajouterUtilisateur({ identifiant, nom, motDePasse, role }) {
  const db = await connexion();
  const cle = String(identifiant || '').trim().toLowerCase();
  if (!cle) throw new Error('Un compte a besoin d’un identifiant.');
  if (!ROLES.includes(role)) throw new Error(`Rôle inconnu : ${role}.`);

  const dejaLa = await db.requete(
    `SELECT id FROM ${table('utilisateurs')} WHERE identifiant = ? LIMIT 1`,
    [cle],
  );
  if (dejaLa.length > 0) throw new Error(`Le compte « ${cle} » existe déjà.`);

  await db.executer(
    `INSERT INTO ${table('utilisateurs')} (identifiant, nom, empreinte, role, actif, cree_le)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [cle, String(nom || cle).slice(0, 160), hacher(motDePasse), role, vrai(true), new Date()],
  );
  viderCache();
  return cle;
}

export async function changerMotDePasse(id, motDePasse) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('utilisateurs')} SET empreinte = ? WHERE id = ?`,
    [hacher(motDePasse), Number(id)],
  );
  viderCache();
}

export async function changerRole(id, role) {
  if (!ROLES.includes(role)) throw new Error(`Rôle inconnu : ${role}.`);
  const db = await connexion();
  await refuserSiDernierAdmin(db, id, { role });
  await db.executer(`UPDATE ${table('utilisateurs')} SET role = ? WHERE id = ?`, [role, Number(id)]);
  viderCache();
}

export async function basculerUtilisateur(id, actif) {
  const db = await connexion();
  if (!actif) await refuserSiDernierAdmin(db, id, { actif: false });
  await db.executer(`UPDATE ${table('utilisateurs')} SET actif = ? WHERE id = ?`, [vrai(actif), Number(id)]);
  viderCache();
}

export async function supprimerUtilisateur(id) {
  const db = await connexion();
  await refuserSiDernierAdmin(db, id, { supprime: true });
  await db.executer(`DELETE FROM ${table('utilisateurs')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

/**
 * Empêche de retirer le dernier administrateur actif.
 *
 * La clé de secours rouvrirait la console, mais compter dessus signifierait
 * qu'on s'est enfermé dehors et qu'on doit aller lire un fichier en SSH pour
 * rentrer. Autant refuser le geste.
 */
async function refuserSiDernierAdmin(db, id, quoi) {
  const cible = await utilisateurParId(id);
  if (!cible || cible.role !== 'admin' || !cible.actif) return;
  const [{ total }] = await db.requete(
    `SELECT COUNT(*) AS total FROM ${table('utilisateurs')} WHERE role = 'admin' AND actif = ?`,
    [vrai(true)],
  );
  if (Number(total) > 1) return;
  const geste = quoi.supprime
    ? 'supprimer le'
    : quoi.actif === false
      ? 'désactiver le'
      : 'changer le rôle du';
  throw new Error(
    `Impossible de ${geste} dernier administrateur actif : la console n'aurait plus personne pour l'ouvrir. Créez d'abord un autre administrateur.`,
  );
}

// ---------------------------------------------------------------------------
// Tarification commerciale
// ---------------------------------------------------------------------------

/** Les tarifs, dans l'ordre de l'écran. */
export async function listerTarifs() {
  const db = await connexion();
  return db.requete(`SELECT * FROM ${table('tarifs')} ORDER BY ordre, cle`);
}

/**
 * Les tarifs en vigueur, prêts pour le calculateur.
 *
 * Ce sont ces valeurs qui sont **recopiées sur une offre** au moment de sa
 * création. Ensuite l'offre ne les relit plus : un tarif modifié ne doit pas
 * changer le montant d'une proposition déjà partie chez un client.
 */
export async function tarifsEnVigueur() {
  const lignes = await listerTarifs();
  const par = new Map(lignes.map((l) => [l.cle, l]));
  const nombre = (cle) => lireTarif(par.get(cle)) || 0;
  return {
    prix_par_vue_cents: nombre('prix_par_vue'),
    multiplicateur_achat: nombre('multiplicateur_achat'),
    taux_annuel: nombre('taux_annuel'),
    prix_jour_formation_cents: nombre('prix_jour_formation'),
    prix_poste_cents: nombre('prix_poste'),
    tva_defaut: nombre('tva_defaut'),
    validite_jours: nombre('validite_jours'),
    mention_autoliquidation: lireTarif(par.get('mention_autoliquidation')) || '',
    courriel_sujet: lireTarif(par.get('courriel_sujet')) || '',
    courriel_corps: lireTarif(par.get('courriel_corps')) || '',
  };
}

/**
 * Enregistre les tarifs modifiés.
 *
 * Deux passages : on convertit et on valide tout avant d'écrire quoi que ce
 * soit. Un taux mal tapé au milieu du formulaire ne doit pas laisser la
 * moitié des tarifs enregistrés et l'autre non — sur une grille tarifaire,
 * un état intermédiaire est pire qu'un refus.
 */
export async function enregistrerTarifs(formulaire) {
  const db = await connexion();
  const existants = new Map((await listerTarifs()).map((l) => [l.cle, l]));

  const cles = formulaire.getAll('cle');
  const valeurs = formulaire.getAll('valeur');
  const aEcrire = [];
  for (let i = 0; i < cles.length; i += 1) {
    const ligne = existants.get(String(cles[i]));
    if (!ligne) continue;
    const valeur = saisirTarif(ligne, valeurs[i]);
    if (valeur !== String(ligne.valeur ?? '')) aEcrire.push({ cle: ligne.cle, valeur });
  }

  for (const { cle, valeur } of aEcrire) {
    await db.executer(`UPDATE ${table('tarifs')} SET valeur = ? WHERE cle = ?`, [valeur, cle]);
  }
  viderCache();
  return aEcrire.length;
}

/** Les prestations d'onboarding vendables. */
export async function listerPrestations({ activesSeulement = false } = {}) {
  const db = await connexion();
  const sql = activesSeulement
    ? `SELECT * FROM ${table('prestations')} WHERE actif = ? ORDER BY ordre, nom`
    : `SELECT * FROM ${table('prestations')} ORDER BY ordre, nom`;
  const lignes = await db.requete(sql, activesSeulement ? [vrai(true)] : []);
  return lignes.map((l) => ({ ...l, actif: Boolean(l.actif) }));
}

export async function ajouterPrestation(valeurs) {
  const db = await connexion();
  const cle = normaliserCle(valeurs.cle || valeurs.nom);
  if (!cle) throw new Error('Une prestation a besoin d’un nom.');
  const dejaLa = await db.requete(`SELECT id FROM ${table('prestations')} WHERE cle = ? LIMIT 1`, [cle]);
  if (dejaLa.length > 0) throw new Error(`La prestation « ${cle} » existe déjà.`);

  await db.executer(
    `INSERT INTO ${table('prestations')} (cle, nom, description, prix_cents, actif, ordre)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      cle,
      String(valeurs.nom || cle).slice(0, 160),
      String(valeurs.description || '') || null,
      enCents(valeurs.prix, 'Prix'),
      vrai(true),
      Number(valeurs.ordre) || 100,
    ],
  );
  viderCache();
  return cle;
}

export async function enregistrerPrestation(id, valeurs) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('prestations')} SET nom = ?, description = ?, prix_cents = ?, ordre = ? WHERE id = ?`,
    [
      String(valeurs.nom || '').slice(0, 160),
      String(valeurs.description || '') || null,
      enCents(valeurs.prix, 'Prix'),
      Number(valeurs.ordre) || 100,
      Number(id),
    ],
  );
  viderCache();
}

export async function basculerPrestation(id, actif) {
  const db = await connexion();
  await db.executer(`UPDATE ${table('prestations')} SET actif = ? WHERE id = ?`, [vrai(actif), Number(id)]);
  viderCache();
}

/**
 * Supprime une prestation du catalogue.
 *
 * Les offres déjà faites ne bougent pas : leurs lignes portent une copie du
 * libellé et du prix, pas une référence. Une prestation retirée du catalogue
 * ne réécrit donc jamais une proposition partie chez un client — c'est tout
 * l'intérêt d'avoir copié plutôt que pointé.
 */
export async function supprimerPrestation(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('prestations')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

// ---------------------------------------------------------------------------
// Prospects et offres
// ---------------------------------------------------------------------------

/** Les statuts d'une offre, dans l'ordre du cycle de vie. */
export const STATUTS_OFFRE = ['brouillon', 'envoyee', 'acceptee', 'refusee', 'expiree'];

/**
 * Une offre partie chez un client ne se modifie plus.
 *
 * On en fait une nouvelle version plutôt que de réécrire celle qu'il a reçue :
 * sans quoi le document dans sa boîte et celui en base finiraient par dire
 * deux prix différents, et c'est nous qui aurions tort.
 */
export function offreFigee(offre) {
  return Boolean(offre) && offre.statut !== 'brouillon';
}

/** Décode les colonnes JSON d'une offre. */
function normaliserOffre(ligne) {
  return {
    ...ligne,
    tva_exoneree: Boolean(ligne.tva_exoneree),
    prestations: lireJson(ligne.prestations, []),
    vues: lireJson(ligne.vues, []),
  };
}

export async function listerProspects() {
  const db = await connexion();
  return db.requete(`SELECT * FROM ${table('prospects')} ORDER BY raison_sociale`);
}

export async function chargerProspect(id) {
  const db = await connexion();
  const lignes = await db.requete(`SELECT * FROM ${table('prospects')} WHERE id = ? LIMIT 1`, [Number(id)]);
  return lignes[0] || null;
}

/** Les champs du prospect, dans l'ordre du formulaire. */
export const CHAMPS_PROSPECT = [
  { nom: 'raison_sociale', libelle: 'Raison sociale', requis: true },
  { nom: 'tva', libelle: 'Numéro de TVA', exemple: 'BE0123456789' },
  { nom: 'adresse', libelle: 'Adresse', zone: true },
  { nom: 'pays', libelle: 'Pays', exemple: 'BE', taille: 2 },
  { nom: 'site_web', libelle: 'Site web' },
  { nom: 'contact_nom', libelle: 'Contact', requis: true },
  { nom: 'contact_role', libelle: 'Fonction' },
  { nom: 'contact_email', libelle: 'Courriel', requis: true, type: 'email' },
  { nom: 'contact_tel', libelle: 'Téléphone' },
];

/**
 * Contrôle de forme d'un numéro de TVA intracommunautaire.
 *
 * Deux lettres de pays puis huit à douze caractères. Ce n'est pas une
 * validation auprès de VIES — on n'appelle aucun service ici — seulement de
 * quoi arrêter une faute de frappe évidente. Un champ vide reste permis :
 * un prospect n'a pas toujours son numéro sous la main au premier rendez-vous.
 */
export function tvaMalFormee(valeur) {
  const brut = String(valeur || '').replace(/[\s.-]/g, '').toUpperCase();
  if (!brut) return null;
  return /^[A-Z]{2}[0-9A-Z]{8,12}$/.test(brut) ? null : brut;
}

/** Contrôle de forme d'une adresse de courriel. */
function courrielMalForme(valeur) {
  const brut = String(valeur || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(brut) ? null : brut;
}

function lireProspect(valeurs) {
  const propre = {};
  for (const champ of CHAMPS_PROSPECT) {
    const brut = String(valeurs[champ.nom] ?? '').trim();
    if (champ.requis && !brut) throw new Error(`« ${champ.libelle} » est obligatoire.`);
    propre[champ.nom] = brut || null;
  }
  if (courrielMalForme(propre.contact_email)) {
    throw new Error(`« ${propre.contact_email} » n'est pas une adresse de courriel.`);
  }
  const tva = tvaMalFormee(propre.tva);
  if (tva) throw new Error(`« ${tva} » ne ressemble pas à un numéro de TVA (deux lettres de pays puis 8 à 12 caractères).`);
  if (propre.tva) propre.tva = propre.tva.replace(/[\s.-]/g, '').toUpperCase();
  if (propre.pays) propre.pays = propre.pays.slice(0, 2).toUpperCase();
  return propre;
}

export async function ajouterProspect(valeurs, auteurId = 0) {
  const db = await connexion();
  const p = lireProspect(valeurs);
  const colonnes = CHAMPS_PROSPECT.map((c) => c.nom);
  const marqueurs = colonnes.map(() => '?').join(', ');
  const id = await insererEtRendreId(db,
    `INSERT INTO ${table('prospects')} (${colonnes.join(', ')}, lead_id, cree_par, cree_le)
     VALUES (${marqueurs}, ?, ?, ?)`,
    [...colonnes.map((c) => p[c]), Number(valeurs.lead_id) || null, Number(auteurId) || null, new Date()],
  );
  viderCache();
  return id;
}

export async function enregistrerProspect(id, valeurs) {
  const db = await connexion();
  const p = lireProspect(valeurs);
  const colonnes = CHAMPS_PROSPECT.map((c) => c.nom);
  await db.executer(
    `UPDATE ${table('prospects')} SET ${colonnes.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
    [...colonnes.map((c) => p[c]), Number(id)],
  );
  viderCache();
}

/**
 * La prochaine référence libre de l'année : `TFB-2026-0001`.
 *
 * Comptée depuis la base plutôt que tenue dans un compteur : deux commerciaux
 * qui créent une offre à la même seconde peuvent tomber sur le même numéro,
 * mais l'index unique (référence, version) le refuse et l'appelant réessaie.
 * Un compteur en base coûterait une table et un verrou pour un cas qui se
 * produit une fois par an.
 */
async function prochaineReference(db, annee) {
  const prefixe = `TFB-${annee}-`;
  const lignes = await db.requete(
    `SELECT reference FROM ${table('offres')} WHERE reference LIKE ? ORDER BY reference DESC LIMIT 1`,
    [`${prefixe}%`],
  );
  const dernier = lignes[0] ? Number(String(lignes[0].reference).slice(prefixe.length)) : 0;
  return `${prefixe}${String((Number.isFinite(dernier) ? dernier : 0) + 1).padStart(4, '0')}`;
}

/**
 * Crée une offre vide pour un prospect, aux tarifs du jour.
 *
 * Les tarifs sont recopiés sur la ligne : c'est ce qui garantit qu'une offre
 * envoyée garde son montant quand la grille change.
 */
export async function creerOffre({ prospectId, auteurId = 0, langue = 'fr' }) {
  const db = await connexion();
  const tarifs = await tarifsEnVigueur();
  const annee = new Date().getFullYear();

  const valideJusquAu = new Date();
  valideJusquAu.setDate(valideJusquAu.getDate() + (tarifs.validite_jours || 30));

  // Trois essais : la collision de référence est improbable et se résout au
  // premier réessai. Boucler indéfiniment masquerait une vraie panne.
  for (let essai = 0; essai < 3; essai += 1) {
    const reference = await prochaineReference(db, annee);
    try {
      const id = await insererEtRendreId(db,
        `INSERT INTO ${table('offres')}
         (prospect_id, reference, version, statut, langue, devise, cree_par, cree_le, valide_jusqu_au,
          remise_type, remise_valeur, tva_taux, tva_exoneree, option_app, jours_formation,
          prestations, vues, prix_par_vue_cents, multiplicateur_achat, taux_annuel,
          prix_jour_formation_cents, nombre_postes, prix_poste_cents)
         VALUES (?, ?, 1, 'brouillon', ?, 'EUR', ?, ?, ?, 'pourcent', 0, ?, ?, 'aucune', 0, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          Number(prospectId), reference, langue, Number(auteurId) || null, new Date(), valideJusquAu,
          tarifs.tva_defaut, vrai(false), json([]), json([]),
          tarifs.prix_par_vue_cents, tarifs.multiplicateur_achat,
          tarifs.taux_annuel, tarifs.prix_jour_formation_cents, tarifs.prix_poste_cents,
        ],
      );
      viderCache();
      return { id, reference };
    } catch (err) {
      if (essai === 2 || !/duplicate|unique/i.test(err.message)) throw err;
    }
  }
  throw new Error('Référence introuvable après trois essais.');
}

/** Une offre avec son prospect, son auteur et ses lignes. */
export async function chargerOffre(reference, version = null) {
  const db = await connexion();
  const lignes = version
    ? await db.requete(
        `SELECT * FROM ${table('offres')} WHERE reference = ? AND version = ? LIMIT 1`,
        [String(reference), Number(version)],
      )
    : await db.requete(
        `SELECT * FROM ${table('offres')} WHERE reference = ? ORDER BY version DESC LIMIT 1`,
        [String(reference)],
      );
  if (lignes.length === 0) return null;
  const offre = normaliserOffre(lignes[0]);

  offre.prospect = await chargerProspect(offre.prospect_id);
  offre.auteur = await utilisateurParId(offre.cree_par);
  offre.lignes = await db.requete(
    `SELECT * FROM ${table('offre_lignes')} WHERE offre_id = ? ORDER BY ordre, id`,
    [offre.id],
  );
  offre.versions = await db.requete(
    `SELECT version, statut, envoyee_le FROM ${table('offres')} WHERE reference = ? ORDER BY version`,
    [String(reference)],
  );
  return offre;
}

/** La configuration d'une offre, dans la forme que le calculateur attend. */
export function configDe(offre) {
  return {
    prestations: (offre.prestations || []).map((p) => ({
      nom: p.nom,
      description: p.description || null,
      prix_cents: p.prix_cents,
      quantite: p.quantite || 1,
    })),
    jours_formation: offre.jours_formation || 0,
    nombre_postes: offre.nombre_postes || 0,
    option_app: offre.option_app || 'aucune',
    vues: offre.vues || [],
    tarifs: {
      prix_par_vue_cents: offre.prix_par_vue_cents,
      multiplicateur_achat: offre.multiplicateur_achat,
      taux_annuel: offre.taux_annuel,
      prix_jour_formation_cents: offre.prix_jour_formation_cents,
      prix_poste_cents: offre.prix_poste_cents,
    },
    remise: { type: offre.remise_type, valeur: offre.remise_valeur },
    tva: { taux: offre.tva_taux, exoneree: offre.tva_exoneree },
  };
}

/**
 * Enregistre la configuration d'une offre et régénère ses lignes.
 *
 * Les lignes sont stockées plutôt que recalculées à l'affichage : une offre
 * envoyée doit garder ses montants même si le calculateur évolue. Elles ne
 * sont donc régénérées que tant que l'offre est un brouillon.
 */
export async function enregistrerOffre(id, config) {
  const db = await connexion();
  const [ligne] = await db.requete(`SELECT * FROM ${table('offres')} WHERE id = ? LIMIT 1`, [Number(id)]);
  if (!ligne) throw new Error('Offre introuvable.');
  const offre = normaliserOffre(ligne);
  if (offreFigee(offre)) {
    throw new Error(
      `Cette offre est ${offre.statut} : elle ne se modifie plus. Créez-en une nouvelle version.`,
    );
  }

  // Un tarif qui n'existait pas quand l'offre a été créée vaut 0 dans sa
  // copie. Le laisser tel quel facturerait douze postes à zéro euro sans que
  // rien ne le signale. Un brouillon adopte donc le tarif du jour la première
  // fois qu'il s'en sert — une offre envoyée, jamais : elle est figée avant
  // d'arriver ici.
  const manquants = {};
  if (config.nombre_postes > 0 && !offre.prix_poste_cents) {
    manquants.prix_poste_cents = (await tarifsEnVigueur()).prix_poste_cents;
  }
  if (Object.keys(manquants).length > 0) {
    const colonnes = Object.keys(manquants);
    await db.executer(
      `UPDATE ${table('offres')} SET ${colonnes.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...colonnes.map((c) => manquants[c]), Number(id)],
    );
    Object.assign(offre, manquants);
  }

  await db.executer(
    `UPDATE ${table('offres')} SET
       langue = ?, jours_formation = ?, nombre_postes = ?, option_app = ?, prestations = ?, vues = ?,
       remise_type = ?, remise_valeur = ?, tva_taux = ?, tva_exoneree = ?, tva_mention = ?,
       portee = ?, delai = ?, valide_jusqu_au = ?
     WHERE id = ?`,
    [
      config.langue, config.jours_formation, config.nombre_postes, config.option_app,
      json(config.prestations), json(config.vues),
      config.remise_type, config.remise_valeur,
      config.tva_taux, vrai(config.tva_exoneree), config.tva_mention || null,
      config.portee || null, config.delai || null, config.valide_jusqu_au || null,
      Number(id),
    ],
  );

  const lignes = lignesDe({
    prestations: config.prestations,
    jours_formation: config.jours_formation,
    nombre_postes: config.nombre_postes,
    option_app: config.option_app,
    vues: config.vues,
    tarifs: {
      prix_par_vue_cents: offre.prix_par_vue_cents,
      multiplicateur_achat: offre.multiplicateur_achat,
      taux_annuel: offre.taux_annuel,
      prix_jour_formation_cents: offre.prix_jour_formation_cents,
      prix_poste_cents: offre.prix_poste_cents,
    },
  });

  await db.executer(`DELETE FROM ${table('offre_lignes')} WHERE offre_id = ?`, [Number(id)]);
  for (const l of lignes) {
    await db.executer(
      `INSERT INTO ${table('offre_lignes')}
       (offre_id, type, libelle, note, quantite, prix_unitaire_cents, recurrence, ordre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [Number(id), l.type, l.libelle, l.note, l.quantite, l.prix_unitaire_cents, l.recurrence, l.ordre],
    );
  }
  viderCache();
}

/**
 * Duplique une offre en une version suivante, remise en brouillon.
 *
 * La nouvelle version repart des **tarifs d'aujourd'hui** : rouvrir une offre
 * de l'an dernier pour la renégocier au prix de l'an dernier n'aurait pas de
 * sens. C'est la différence entre une nouvelle version et une correction.
 */
export async function nouvelleVersion(reference) {
  const db = await connexion();
  const source = await chargerOffre(reference);
  if (!source) throw new Error('Offre introuvable.');

  const tarifs = await tarifsEnVigueur();
  const [{ total }] = await db.requete(
    `SELECT MAX(version) AS total FROM ${table('offres')} WHERE reference = ?`,
    [String(reference)],
  );
  const version = Number(total || 0) + 1;

  const valideJusquAu = new Date();
  valideJusquAu.setDate(valideJusquAu.getDate() + (tarifs.validite_jours || 30));

  const id = await insererEtRendreId(db,
    `INSERT INTO ${table('offres')}
     (prospect_id, reference, version, statut, langue, devise, cree_par, cree_le, valide_jusqu_au,
      remise_type, remise_valeur, tva_taux, tva_exoneree, tva_mention, option_app, jours_formation,
      prestations, vues, prix_par_vue_cents, multiplicateur_achat, taux_annuel, prix_jour_formation_cents,
      nombre_postes, prix_poste_cents, portee, delai)
     VALUES (?, ?, ?, 'brouillon', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      source.prospect_id, String(reference), version, source.langue, source.devise,
      source.cree_par, new Date(), valideJusquAu,
      source.remise_type, source.remise_valeur, source.tva_taux, vrai(source.tva_exoneree),
      source.tva_mention, source.option_app, source.jours_formation,
      json(source.prestations), json(source.vues),
      tarifs.prix_par_vue_cents, tarifs.multiplicateur_achat,
      tarifs.taux_annuel, tarifs.prix_jour_formation_cents,
      source.nombre_postes, tarifs.prix_poste_cents,
      source.portee, source.delai,
    ],
  );

  // Les lignes sont recalculées aux nouveaux tarifs, pas recopiées.
  const rechargee = await db.requete(`SELECT * FROM ${table('offres')} WHERE id = ?`, [id]);
  const neuve = normaliserOffre(rechargee[0]);
  const lignes = lignesDe(configDe(neuve));
  for (const l of lignes) {
    await db.executer(
      `INSERT INTO ${table('offre_lignes')}
       (offre_id, type, libelle, note, quantite, prix_unitaire_cents, recurrence, ordre)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, l.type, l.libelle, l.note, l.quantite, l.prix_unitaire_cents, l.recurrence, l.ordre],
    );
  }
  viderCache();
  return { id, reference: String(reference), version };
}

export async function changerStatutOffre(id, statut) {
  if (!STATUTS_OFFRE.includes(statut)) throw new Error(`Statut inconnu : ${statut}.`);
  const db = await connexion();
  const champs = statut === 'envoyee' ? ', envoyee_le = ?' : '';
  const params = statut === 'envoyee' ? [statut, new Date(), Number(id)] : [statut, Number(id)];
  await db.executer(`UPDATE ${table('offres')} SET statut = ?${champs} WHERE id = ?`, params);
  viderCache();
}

export async function supprimerOffre(id) {
  const db = await connexion();
  const [ligne] = await db.requete(`SELECT statut FROM ${table('offres')} WHERE id = ? LIMIT 1`, [Number(id)]);
  if (ligne && ligne.statut !== 'brouillon') {
    throw new Error("Seul un brouillon se supprime. Une offre partie chez un client reste au dossier.");
  }
  await db.executer(`DELETE FROM ${table('offre_lignes')} WHERE offre_id = ?`, [Number(id)]);
  await db.executer(`DELETE FROM ${table('offres')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

/**
 * Le chiffrage d'une offre, à partir de sa seule configuration.
 *
 * Sert la liste, qui a besoin des totaux sans charger les lignes de chaque
 * offre. Le résultat est identique à celui de la fiche : c'est le même
 * calculateur, sur les mêmes tarifs recopiés.
 */
export function calculerTotauxOffre(offre) {
  return calculerOffre(configDe(offre));
}

/**
 * La liste des offres, filtrable. Seule la dernière version de chaque
 * référence est montrée : les précédentes se lisent depuis la fiche.
 */
export async function listerOffres({ prospect = '', statut = '', auteur = '' } = {}) {
  const db = await connexion();
  const offres = await db.requete(
    `SELECT o.*, p.raison_sociale, p.contact_nom, u.nom AS auteur_nom
     FROM ${table('offres')} o
     LEFT JOIN ${table('prospects')} p ON p.id = o.prospect_id
     LEFT JOIN ${table('utilisateurs')} u ON u.id = o.cree_par
     ORDER BY o.reference DESC, o.version DESC`,
  );

  // On filtre **avant** de ne garder qu'une version par référence.
  //
  // L'inverse donnait un résultat faux : une offre envoyée puis rouverte en
  // brouillon disparaissait du filtre « envoyée », alors qu'elle a bel et bien
  // été envoyée. Ici, chercher « envoyée » montre la dernière version qui
  // porte ce statut.
  const cherche = String(prospect).trim().toLowerCase();
  const retenues = offres.filter((o) => {
    if (statut && o.statut !== statut) return false;
    if (auteur && String(o.cree_par) !== String(auteur)) return false;
    if (cherche && !String(o.raison_sociale || '').toLowerCase().includes(cherche)) return false;
    return true;
  });

  // `offres` arrive déjà triée par version décroissante : la première vue est
  // donc la plus récente.
  const derniere = new Map();
  for (const o of retenues) if (!derniere.has(o.reference)) derniere.set(o.reference, o);
  return [...derniere.values()].map(normaliserOffre);
}

// ---------------------------------------------------------------------------
// Traductions
// ---------------------------------------------------------------------------

/**
 * Ce qui se traduit, entité par entité.
 *
 * Le français reste dans la colonne d'origine et sert de référence autant que
 * de repli : `landing_traductions` ne porte que les surcharges. Une entrée
 * absente affiche donc le français, ce qui vaut mieux qu'un blanc.
 *
 * `json: true` marque les colonnes qui portent une liste sérialisée. On les
 * édite telles quelles, en JSON : la surcharge remplace la valeur brute de la
 * colonne, il n'y a pas d'adressage sous-champ dans ce modèle. Traduire un
 * seul élément de la liste n'est donc pas possible — c'est la liste entière.
 */
export const ENTITES_TRADUISIBLES = [
  {
    cle: 'site',
    nom: "Page d'accueil",
    table: 'site',
    // Une seule ligne : pas de libellé de ligne à afficher.
    libelle: () => "Page d'accueil",
    champs: [
      { nom: 'titre', libelle: 'Titre principal', lignes: 2 },
      { nom: 'sous_titre', libelle: 'Sous-titre', lignes: 2 },
      { nom: 'accroche', libelle: 'Accroche', lignes: 6 },
      { nom: 'cta_texte', libelle: 'Libellé du bouton' },
      { nom: 'meta_description', libelle: 'Description pour les moteurs', lignes: 3 },
      { nom: 'problemes', libelle: 'Les problèmes', lignes: 10, json: true },
      { nom: 'reponses', libelle: 'Les réponses', lignes: 10, json: true },
    ],
  },
  {
    cle: 'textes',
    nom: 'Textes éditoriaux',
    table: 'textes',
    libelle: (l) => l.cle,
    champs: [{ nom: 'valeur', libelle: 'Texte affiché', lignes: 2 }],
  },
  {
    cle: 'modules',
    nom: 'Fiches de module',
    table: 'modules',
    libelle: (l) => l.slug,
    champs: [
      { nom: 'nom', libelle: 'Nom' },
      { nom: 'accroche', libelle: 'Accroche', lignes: 2 },
      { nom: 'resume', libelle: 'Résumé', lignes: 4 },
      { nom: 'public_cible', libelle: 'Public visé' },
      { nom: 'onboarding', libelle: 'Phrase d’onboarding', lignes: 3 },
      { nom: 'description', libelle: 'Description longue', lignes: 12 },
      { nom: 'problemes', libelle: 'Les problèmes', lignes: 8, json: true },
      { nom: 'benefices', libelle: 'Les bénéfices', lignes: 8, json: true },
    ],
  },
  {
    cle: 'fonctions',
    nom: 'Composants',
    table: 'fonctions',
    libelle: (l) => l.cle,
    champs: [
      { nom: 'nom', libelle: 'Nom' },
      { nom: 'description', libelle: 'Description', lignes: 3 },
      { nom: 'benefice', libelle: 'Bénéfice', lignes: 2 },
    ],
  },
  {
    cle: 'questions',
    nom: 'Questionnaire',
    table: 'questions',
    libelle: (l) => l.cle,
    champs: [
      { nom: 'tag', libelle: 'Étiquette' },
      { nom: 'texte', libelle: 'La question', lignes: 2 },
      { nom: 'cible', libelle: 'Ce qu’elle vise' },
    ],
  },
  {
    cle: 'captures',
    nom: "Titres d'écran",
    table: 'captures',
    libelle: (l) => l.fichier,
    champs: [{ nom: 'titre', libelle: 'Titre affiché sous la capture', lignes: 2 }],
  },
];

/** L'entité par sa clé, ou la première. */
export function entiteTraduisible(cle) {
  return ENTITES_TRADUISIBLES.find((e) => e.cle === cle) || ENTITES_TRADUISIBLES[0];
}

/** L'ordre d'affichage des lignes de chaque entité. */
function ordreDe(cle) {
  if (cle === 'textes') return 'ordre, cle';
  if (cle === 'modules') return 'ordre, slug';
  if (cle === 'fonctions') return 'module_id, ordre';
  if (cle === 'questions') return 'ordre, id';
  if (cle === 'captures') return 'module_id, ordre';
  return 'id';
}

/** Les surcharges d'une langue, rangées par `entite:ligne_id:champ`. */
async function surcharges(langue, entite) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT ligne_id, champ, valeur, source FROM ${table('traductions')}
     WHERE langue = ? AND entite = ?`,
    [String(langue), String(entite)],
  );
  const par = new Map();
  for (const l of lignes) par.set(`${l.ligne_id}:${l.champ}`, l);
  return par;
}

/**
 * Le tableau de traduction d'une entité : une ligne par enregistrement, et
 * pour chaque champ le français, la traduction posée, et si elle est périmée.
 *
 * « Périmée » veut dire que le français a changé depuis la traduction : on
 * compare la colonne `source`, figée au moment où la traduction a été écrite,
 * au français d'aujourd'hui. C'est le seul moyen de repérer une traduction qui
 * ment sans la relire une par une.
 */
export async function listerTraductions(codeLangue, cleEntite) {
  const entite = entiteTraduisible(cleEntite);
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table(entite.table)} ORDER BY ${ordreDe(entite.cle)}`,
  );
  const posees = await surcharges(codeLangue, entite.cle);

  return lignes.map((ligne) => ({
    id: ligne.id,
    libelle: entite.libelle(ligne),
    champs: entite.champs.map((champ) => {
      const fr = ligne[champ.nom] == null ? '' : String(ligne[champ.nom]);
      const posee = posees.get(`${ligne.id}:${champ.nom}`);
      const valeur = posee?.valeur ?? '';
      return {
        ...champ,
        fr,
        valeur,
        // Une source vide (traduction saisie à la main dans la console avant
        // que le français n'ait bougé) ne se déclare pas périmée : on ne sait
        // pas, et crier au loup ferait ignorer l'alerte.
        perimee: Boolean(valeur) && Boolean(posee?.source) && posee.source !== fr,
      };
    }),
  }));
}

/** Combien de champs traduits, périmés et au total, par entité. */
export async function couvertureTraductions(codeLangue) {
  const resultat = [];
  for (const entite of ENTITES_TRADUISIBLES) {
    const lignes = await listerTraductions(codeLangue, entite.cle);
    let total = 0;
    let faits = 0;
    let perimes = 0;
    for (const ligne of lignes) {
      for (const champ of ligne.champs) {
        // Un champ français vide n'est pas à traduire : le compter ferait
        // stagner la couverture à jamais sous 100 %.
        if (!champ.fr) continue;
        total += 1;
        if (champ.valeur) faits += 1;
        if (champ.perimee) perimes += 1;
      }
    }
    resultat.push({ cle: entite.cle, nom: entite.nom, total, faits, perimes });
  }
  return resultat;
}

/**
 * Enregistre les traductions d'une entité pour une langue.
 *
 * Vider un champ supprime la surcharge : la page retombe sur le français.
 * C'est volontairement la même règle que pour les textes — une valeur vide
 * n'est jamais stockée, sans quoi le site afficherait un blanc.
 */
export async function enregistrerTraductions(codeLangue, cleEntite, formulaire) {
  const entite = entiteTraduisible(cleEntite);
  const db = await connexion();
  const langue = String(codeLangue);

  const lignes = await db.requete(`SELECT * FROM ${table(entite.table)}`);
  const parId = new Map(lignes.map((l) => [String(l.id), l]));
  const posees = await surcharges(langue, entite.cle);

  const cles = formulaire.getAll('cle');
  const valeurs = formulaire.getAll('valeur');

  // Premier passage : on ne touche à rien tant que tout n'est pas relu. Une
  // liste mal formée refusée à mi-parcours laisserait la moitié du formulaire
  // enregistrée et l'autre non, ce qui est pire que de tout refuser.
  const aEcrire = [];
  for (let i = 0; i < cles.length; i += 1) {
    const [ligneId, nomChamp] = String(cles[i]).split(':');
    const ligne = parId.get(ligneId);
    const champ = entite.champs.find((c) => c.nom === nomChamp);
    if (!ligne || !champ) continue;

    const valeur = String(valeurs[i] ?? '').trim();
    if (valeur && champ.json) {
      try {
        JSON.parse(valeur);
      } catch (err) {
        throw new Error(
          `« ${entite.libelle(ligne)} / ${champ.libelle} » : JSON invalide (${err.message}). Rien n'a été enregistré.`,
        );
      }
    }
    aEcrire.push({ ligne, ligneId, nomChamp, valeur });
  }

  let ecrits = 0;
  let vides = 0;
  for (const { ligne, ligneId, nomChamp, valeur } of aEcrire) {
    const posee = posees.get(`${ligneId}:${nomChamp}`);

    if (!valeur) {
      if (posee) {
        await db.executer(
          `DELETE FROM ${table('traductions')}
           WHERE langue = ? AND entite = ? AND ligne_id = ? AND champ = ?`,
          [langue, entite.cle, Number(ligneId), nomChamp],
        );
        vides += 1;
      }
      continue;
    }

    const source = ligne[nomChamp] == null ? null : String(ligne[nomChamp]);
    if (posee) {
      if (posee.valeur === valeur && posee.source === source) continue;
      await db.executer(
        `UPDATE ${table('traductions')} SET valeur = ?, source = ?
         WHERE langue = ? AND entite = ? AND ligne_id = ? AND champ = ?`,
        [valeur, source, langue, entite.cle, Number(ligneId), nomChamp],
      );
    } else {
      await db.executer(
        `INSERT INTO ${table('traductions')} (langue, entite, ligne_id, champ, valeur, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [langue, entite.cle, Number(ligneId), nomChamp, valeur, source],
      );
    }
    ecrits += 1;
  }

  viderCache();
  return { ecrits, vides };
}

/** Enregistre famille, icône, ordre et leviers d'un module, depuis la table. */
export async function enregistrerLigneModule(slug, valeurs) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('modules')} SET groupe = ?, icone = ?, ordre = ?, leviers = ? WHERE slug = ?`,
    [
      String(valeurs.groupe || '').trim() || null,
      String(valeurs.icone || '').trim() || null,
      Number(valeurs.ordre) || 100,
      json(valeurs.leviers),
      String(slug),
    ],
  );
  viderCache();
}

/** Les familles réellement utilisées, plus celles prévues par la maquette. */
export async function famillesConnues() {
  const db = await connexion();
  const lignes = await db.requete(`SELECT DISTINCT groupe FROM ${table('modules')} WHERE groupe IS NOT NULL`);
  const vues = lignes.map((l) => l.groupe).filter(Boolean);
  const attendues = ['Vente', 'Pilotage', 'Approvisionnement', 'Terrain', 'Développement'];
  return [...new Set([...attendues, ...vues])].sort();
}

// ---------------------------------------------------------------------------
// La validation : « nouveau » → relu → en ligne
// ---------------------------------------------------------------------------

/**
 * Valide un module et tous ses composants encore en attente.
 *
 * C'est le geste de relecture : ce que le pipeline a produit devient visible
 * sur le site. Le module est publié, ses composants passent en ligne.
 */
export async function validerModule(slug) {
  const db = await connexion();
  const lignes = await db.requete(`SELECT id FROM ${table('modules')} WHERE slug = ? LIMIT 1`, [String(slug)]);
  if (lignes.length === 0) throw new Error(`Module « ${slug} » introuvable.`);
  const id = lignes[0].id;

  await db.executer(
    `UPDATE ${table('modules')} SET statut = 'valide', actif = ? WHERE id = ?`,
    [vrai(true), id],
  );
  await db.executer(
    `UPDATE ${table('fonctions')} SET statut = 'valide', en_ligne = ? WHERE module_id = ? AND statut = 'nouveau'`,
    [vrai(true), id],
  );
  viderCache();
}

/** Valide un composant seul, et le met en ligne. */
export async function validerFonction(id) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('fonctions')} SET statut = 'valide', en_ligne = ? WHERE id = ?`,
    [vrai(true), Number(id)],
  );
  viderCache();
}

/**
 * Met un composant en ligne ou hors ligne.
 * Refusé tant qu'il est « nouveau » : la relecture passe avant la publication.
 */
export async function basculerFonction(id, enLigne) {
  const db = await connexion();
  const lignes = await db.requete(`SELECT statut FROM ${table('fonctions')} WHERE id = ? LIMIT 1`, [Number(id)]);
  if (lignes.length === 0) throw new Error('Composant introuvable.');
  if (lignes[0].statut === 'nouveau') {
    throw new Error('Ce composant doit d’abord être validé : la relecture passe avant la mise en ligne.');
  }
  await db.executer(`UPDATE ${table('fonctions')} SET en_ligne = ? WHERE id = ?`, [vrai(enLigne), Number(id)]);
  viderCache();
}

/** Tout ce qui attend une relecture, module par module. */
export async function enAttente() {
  const db = await connexion();
  const modules = await db.requete(
    `SELECT slug, nom FROM ${table('modules')} WHERE statut = 'nouveau' ORDER BY ordre`,
  );
  const fonctions = await db.requete(
    `SELECT f.id, f.cle, f.nom, m.slug AS module_slug, m.nom AS module_nom
       FROM ${table('fonctions')} f
       JOIN ${table('modules')} m ON m.id = f.module_id
      WHERE f.statut = 'nouveau'
      ORDER BY m.ordre, f.ordre`,
  );
  return { modules, fonctions };
}

// ---------------------------------------------------------------------------
// Sync GitHub et réglages
// ---------------------------------------------------------------------------

/**
 * L'état de synchronisation de chaque dépôt : ce que la base sait de sa
 * dernière génération, et ce que le module publie comme captures.
 */
export async function etatDepots() {
  const db = await connexion();
  const modules = await db.requete(
    `SELECT slug, nom, repo, ref, statut, actif, commit_sha, modele_ia, genere_le
       FROM ${table('modules')} ORDER BY ordre`,
  );
  const captures = await db.requete(
    `SELECT module_id, COUNT(*) AS total FROM ${table('captures')} GROUP BY module_id`,
  );
  const ids = await db.requete(`SELECT id, slug FROM ${table('modules')}`);
  const parSlug = new Map(ids.map((l) => [l.slug, l.id]));
  const compte = (slug) => Number(captures.find((c) => c.module_id === parSlug.get(slug))?.total ?? 0);

  return modules.map((m) => ({
    ...m,
    actif: Boolean(m.actif),
    nouveau: m.statut === 'nouveau',
    nb_captures: compte(m.slug),
  }));
}

/**
 * Ce que la configuration du serveur dit d'elle-même.
 *
 * Aucune valeur secrète n'est rendue : on dit si elle est renseignée, jamais
 * ce qu'elle contient. C'est le point de la page — voir ce qui manque sans
 * ouvrir un fichier en SSH.
 */
export function reglages() {
  const renseigne = (nom) => {
    const v = (process.env[nom] || '').trim();
    return { nom, present: v.length > 0, gabarit: /change-moi/i.test(v) };
  };
  return {
    base: {
      client: process.env.DB_CLIENT || 'mysql',
      hote: process.env.DB_HOST || '—',
      nom: process.env.DB_NAME || '—',
      prefixe: process.env.DB_PREFIX || 'landing_',
    },
    montage: {
      chemin: process.env.BASE_PATH || '/',
      domaine: process.env.SITE_DOMAIN || '—',
      port: process.env.PORT || process.env.HTTP_PORT || '—',
      cache: `${Number(process.env.CACHE_TTL_MS || 60000) / 1000} s`,
    },
    secrets: [
      renseigne('ADMIN_PASSWORD'),
      renseigne('ADMIN_SECRET'),
      renseigne('GH_INGEST_TOKEN'),
      renseigne('ANTHROPIC_API_KEY'),
    ],
    modele: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  };
}
