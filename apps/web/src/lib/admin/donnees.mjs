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

/** Vrai littéral du dialecte : MySQL n'a pas de type booléen. */
function vrai(valeur) {
  return estPostgres() ? Boolean(valeur) : valeur ? 1 : 0;
}

/** Sérialise une valeur destinée à une colonne JSON. */
function json(valeur) {
  return JSON.stringify(valeur ?? []);
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
