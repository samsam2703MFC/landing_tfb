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
import { enCents, enEntier, lireTarif, saisirTarif } from '../offres/montants.mjs';
import { calculerOffre, formater as formaterMontant, lignesDe } from '../offres/calcul.mjs';
import { recapTexte } from '../offres/courriel.mjs';
import { CHAMPS_DOSSIER, contexteContrat, dossierComplet, remplirGabarit } from '../contrats/gabarit.mjs';
import { serviceSignature } from '../contrats/signature.mjs';
import { randomInt } from 'node:crypto';
import { ROLES, codeTropSimple, empreinteValide, estCode, hacherCode } from './session.mjs';
import { lireImage } from './images.mjs';

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
  const [etapes] = await db.requete(`SELECT COUNT(*) AS total FROM ${table('etapes')} WHERE actif = ?`, [vrai(true)]);
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
  // Les contrats qui attendent quelque chose de nous : un brouillon à
  // envoyer, une signature qui n'est pas revenue.
  const [contrats] = await db.requete(
    `SELECT COUNT(*) AS total FROM ${table('contrats')} WHERE statut IN ('brouillon', 'envoye')`,
  );
  // L'onboarding : ce qui attend, et ce qui est branché.
  const [parcours] = await db.requete(
    `SELECT COUNT(*) AS total FROM ${table('parcours')} WHERE statut = 'en_cours'`,
  );
  const [connexions] = await db.requete(
    `SELECT COUNT(*) AS total FROM ${table('connexions')} WHERE statut = 'active'`,
  );
  const [connecteurs] = await db.requete(
    `SELECT COUNT(*) AS total FROM ${table('connecteurs')} WHERE actif = ?`, [vrai(true)],
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
    etapes: nombre(etapes),
    textes: nombre(textes),
    langues: nombre(langues),
    leads: nombre(leads),
    clients: nombre(clients),
    questions: nombre(questions),
    prestations: nombre(prestations),
    offres: nombre(offres),
    contrats: nombre(contrats),
    parcours: nombre(parcours),
    connexions: nombre(connexions),
    connecteurs: nombre(connecteurs),
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
/**
 * Les réseaux du bandeau.
 *
 * Le logo lui-même n'est pas chargé : une liste de dix clients tirerait dix
 * fois quelques dizaines de kilo-octets de base64 pour n'afficher qu'une
 * vignette servie par ailleurs. On ne rapporte que son type, qui suffit à
 * savoir s'il y en a un.
 */
export async function listerClients() {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT id, nom, note, actif, ordre, logo_type, tva, pays, adresse, site_web,
            tva_verifiee_le, tva_verifiee_ref, tva_verifiee_nom
     FROM ${table('clients')} ORDER BY ordre, nom`,
  );
  return lignes.map((c) => ({ ...c, actif: Boolean(c.actif) }));
}

/** Le logo d'un réseau, décodé — pour le seul point qui le sert. */
export async function chargerLogoClient(id) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT logo, logo_type FROM ${table('clients')} WHERE id = ? LIMIT 1`,
    [Number(id)],
  );
  const ligne = lignes[0];
  if (!ligne?.logo || !ligne.logo_type) return null;
  return { octets: Buffer.from(ligne.logo, 'base64'), type: ligne.logo_type };
}

/**
 * Remplace le logo d'un réseau. Un fichier absent ne change rien — c'est ce
 * qui permet d'enregistrer le nom d'une ligne sans avoir à redéposer l'image.
 */
export async function enregistrerLogoClient(id, fichier) {
  const image = await lireImage(fichier);
  if (!image) return false;
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('clients')} SET logo = ?, logo_type = ? WHERE id = ?`,
    [image.base64, image.type, Number(id)],
  );
  viderCache();
  return true;
}

export async function supprimerLogoClient(id) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('clients')} SET logo = NULL, logo_type = NULL WHERE id = ?`,
    [Number(id)],
  );
  viderCache();
}

/** Ajoute un réseau au bandeau. */
export async function ajouterClient(valeurs) {
  const nom = String(valeurs.nom || '').trim();
  if (!nom) throw new Error('Le nom du réseau est obligatoire.');
  // Le logo est relu **avant** la moindre écriture : un fichier refusé ne doit
  // pas laisser derrière lui un réseau à demi créé, que personne ne pense à
  // aller supprimer.
  const image = await lireImage(valeurs.logo);

  const identite = identiteClient(valeurs);

  const db = await connexion();
  const id = await insererEtRendreId(
    db,
    `INSERT INTO ${table('clients')} (nom, note, logo, logo_type, actif, ordre, tva, pays, adresse, site_web)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      nom.slice(0, 160),
      String(valeurs.note || '').trim().slice(0, 255) || null,
      image?.base64 || null,
      image?.type || null,
      vrai(true),
      Number(valeurs.ordre) || 100,
      identite.tva, identite.pays, identite.adresse, identite.site_web,
    ],
  );
  viderCache();
  return { id, avecLogo: Boolean(image) };
}

/**
 * L'identité réelle derrière le nom d'enseigne d'un réseau.
 *
 * Le bandeau affiche une marque ; ce qui signe et ce qui paie est une société
 * avec un numéro. Les mêmes contrôles que sur un prospect, parce que c'est la
 * même chose : un numéro de TVA mal formé reste mal formé, quel que soit
 * l'écran où on l'a tapé.
 */
function identiteClient(valeurs) {
  const tva = String(valeurs.tva || '').replace(/[\s.-]/g, '').toUpperCase();
  const mauvais = tvaMalFormee(tva);
  if (mauvais) {
    throw new Error(`« ${mauvais} » ne ressemble pas à un numéro de TVA (deux lettres de pays puis 8 à 12 caractères).`);
  }
  return {
    tva: tva || null,
    pays: String(valeurs.pays || '').trim().slice(0, 2).toUpperCase() || null,
    adresse: String(valeurs.adresse || '').trim() || null,
    site_web: String(valeurs.site_web || '').trim().slice(0, 255) || null,
  };
}

/** Enregistre un réseau existant. */
export async function enregistrerClient(id, valeurs) {
  const db = await connexion();
  const identite = identiteClient(valeurs);
  const sets = ['nom = ?', 'note = ?', 'actif = ?', 'ordre = ?', 'tva = ?', 'pays = ?', 'adresse = ?', 'site_web = ?'];
  const params = [
    String(valeurs.nom || '').trim().slice(0, 160),
    String(valeurs.note || '').trim().slice(0, 255) || null,
    vrai(valeurs.actif),
    Number(valeurs.ordre) || 100,
    identite.tva, identite.pays, identite.adresse, identite.site_web,
  ];
  const avant = (await db.requete(`SELECT tva FROM ${table('clients')} WHERE id = ? LIMIT 1`, [Number(id)]))[0];
  if (avant && (avant.tva || null) !== identite.tva) {
    sets.push('tva_verifiee_le = ?', 'tva_verifiee_ref = ?', 'tva_verifiee_nom = ?');
    params.push(null, null, null);
  }
  params.push(Number(id));
  await db.executer(`UPDATE ${table('clients')} SET ${sets.join(', ')} WHERE id = ?`, params);
  viderCache();
}

/**
 * Applique une vérification VIES à un réseau.
 *
 * Le nom n'est **jamais** recopié ici, contrairement au prospect : le bandeau
 * de la page d'accueil affiche une enseigne — « L'Atelier By » — et non la
 * raison sociale du registre. Remplacer l'une par l'autre défigurerait la
 * page d'accueil pour une bonne intention. Le nom légal se garde à part.
 */
export async function appliquerViesClient(id, resultat) {
  if (!resultat?.ok) throw new Error('Rien à appliquer : la vérification n’a pas abouti.');
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('clients')}
     SET tva = ?, pays = ?, adresse = COALESCE(?, adresse),
         tva_verifiee_le = ?, tva_verifiee_ref = ?, tva_verifiee_nom = ?
     WHERE id = ?`,
    [
      resultat.tva,
      resultat.pays === 'EL' ? 'GR' : resultat.pays || null,
      resultat.adresse || null,
      new Date(),
      String(resultat.reference || '').slice(0, 60) || null,
      String(resultat.nom || '').slice(0, 255) || null,
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

/**
 * Les langues dans lesquelles une offre peut sortir.
 *
 * Ce sont celles du site, publiées : proposer au commercial une langue que la
 * landing ne sert pas produirait une offre dans une langue qu'on ne sait pas
 * tenir par ailleurs. Le français est toujours là, même si quelqu'un le
 * dépubliait par erreur — une offre a toujours une langue.
 */
export async function languesOffre() {
  const langues = (await listerLangues()).filter((l) => l.publiee || l.defaut);
  return langues.length > 0 ? langues : [{ code: 'fr', nom: 'Français', defaut: true }];
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
    `SELECT id, identifiant, nom, role, actif, cree_le, vu_le,
            CASE WHEN code IS NULL OR code = '' THEN 0 ELSE 1 END AS a_code
       FROM ${table('utilisateurs')}
      ORDER BY role, identifiant`,
  );
  // `a_code` et jamais le code : la console dit qui peut se connecter, elle ne
  // remontre pas comment. Un code réaffiché finit copié dans un ticket.
  return lignes.map((l) => ({ ...l, actif: Boolean(l.actif), aCode: Boolean(Number(l.a_code)) }));
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
 * Crée un compte, et lui donne son code du même geste.
 *
 * Un compte sans code ne peut pas se connecter — la console n'a plus qu'une
 * porte, et c'est le code qui l'ouvre. Créer d'abord puis attribuer ensuite
 * laisserait derrière chaque oubli un compte qui existe et n'entre pas.
 *
 * Le code retourné est **la seule fois où il est lisible** : la base n'en garde
 * qu'une empreinte scrypt.
 */
export async function ajouterUtilisateur({ identifiant, nom, code, role }) {
  const db = await connexion();
  const cle = String(identifiant || '').trim().toLowerCase();
  if (!cle) throw new Error('Un compte a besoin d’un identifiant.');
  if (!ROLES.includes(role)) throw new Error(`Rôle inconnu : ${role}.`);

  const demande = String(code || '').trim() || codeAuHasard();
  const souci = codeTropSimple(demande);
  if (souci) throw new Error(souci);

  const dejaLa = await db.requete(
    `SELECT id FROM ${table('utilisateurs')} WHERE identifiant = ? LIMIT 1`,
    [cle],
  );
  if (dejaLa.length > 0) throw new Error(`Le compte « ${cle} » existe déjà.`);

  // L'unicité du code se vérifie avant l'insertion, pas après : un doublon
  // inséré, et deux personnes se connectent sous le même nom en attendant
  // qu'on s'en aperçoive.
  if (await utilisateurParCode(demande)) {
    throw new Error('Ce code est déjà celui d’un autre compte. Laissez le champ vide pour en tirer un au hasard.');
  }

  await db.executer(
    `INSERT INTO ${table('utilisateurs')} (identifiant, nom, code, role, actif, cree_le)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [cle, String(nom || cle).slice(0, 160), hacherCode(demande), role, vrai(true), new Date()],
  );
  viderCache();
  return { cle, code: demande };
}

/**
 * Le compte qui porte ce code, ou `null`.
 *
 * Le code identifie **et** authentifie : c'est ce qui permet un formulaire à un
 * seul champ sans perdre l'attribution. Il faut donc l'essayer contre chaque
 * compte, ce qui coûte un scrypt par compte — quelques centaines de
 * millisecondes pour une équipe, et un coût que le verrou d'essais rend sans
 * intérêt pour qui cherche à forcer.
 *
 * Le parcours est **complet** : on ne s'arrête pas au premier compte reconnu.
 * Sortir plus tôt rendrait le temps de réponse dépendant de la position du
 * compte dans la liste, ce qui dit quelque chose à qui mesure.
 */
export async function utilisateurParCode(code) {
  if (!estCode(code)) return null;
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT id, identifiant, nom, code, role, actif FROM ${table('utilisateurs')}
      WHERE actif = 1 AND code IS NOT NULL AND code <> '' ORDER BY id ASC`,
    [],
  );
  let trouve = null;
  for (const l of lignes) {
    if (empreinteValide(code, l.code) && !trouve) trouve = l;
  }
  if (!trouve) return null;

  await db.executer(`UPDATE ${table('utilisateurs')} SET vu_le = ? WHERE id = ?`, [new Date(), trouve.id]);
  return { id: Number(trouve.id), identifiant: trouve.identifiant, nom: trouve.nom, role: trouve.role };
}

/**
 * Attribue un code à un compte. `null` le retire ; une chaîne vide en tire un
 * au hasard. Le code retenu revient en clair — c'est la dernière fois qu'il
 * est lisible.
 *
 * L'unicité est vérifiée en essayant le code contre les autres comptes : deux
 * personnes avec le même code, c'est la seconde qui se connecte sous le nom de
 * la première, et rien ne le signale.
 */
export async function changerCode(id, code) {
  const db = await connexion();
  if (code === null || code === undefined) {
    await db.executer(`UPDATE ${table('utilisateurs')} SET code = NULL WHERE id = ?`, [Number(id)]);
    viderCache();
    return { ok: true, code: null };
  }

  const demande = String(code).trim() || codeAuHasard();
  const souci = codeTropSimple(demande);
  if (souci) return { ok: false, erreur: souci };

  const dejaPris = await utilisateurParCode(demande);
  if (dejaPris && Number(dejaPris.id) !== Number(id)) {
    return { ok: false, erreur: 'Ce code est déjà celui d’un autre compte. Deux comptes de même code, et l’un se connecte sous le nom de l’autre.' };
  }

  await db.executer(`UPDATE ${table('utilisateurs')} SET code = ? WHERE id = ?`, [hacherCode(demande), Number(id)]);
  viderCache();
  return { ok: true, code: demande };
}

/** Un code tiré au hasard, qui passe les contrôles. */
export function codeAuHasard() {
  for (let n = 0; n < 200; n += 1) {
    const c = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!codeTropSimple(c)) return c;
  }
  return null;
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
    // Les deux tarifs que les packs remplacent. Absents de la grille, donc à
    // zéro pour une offre neuve : seules les offres d'avant les portent. Le
    // prix d'un pack vit sur le pack, pas ici.
    prix_poste_cents: nombre('prix_poste'),
    prix_poste_franchiseur_cents: nombre('prix_poste_franchiseur'),
    prix_onboarding_poste_cents: nombre('prix_onboarding_poste'),
    prix_module_cents: nombre('prix_module'),
    tva_defaut: nombre('tva_defaut'),
    validite_jours: nombre('validite_jours'),
    mention_autoliquidation: lireTarif(par.get('mention_autoliquidation')) || '',
    courriel_sujet: lireTarif(par.get('courriel_sujet')) || '',
    courriel_corps: lireTarif(par.get('courriel_corps')) || '',
    courriel_css: lireTarif(par.get('courriel_css')) || '',
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

  // Les cases à cocher voyagent sous leur propre nom.
  //
  // Une case décochée n'envoie rien : glissée dans le tableau `valeur`, elle
  // en décalerait tout le reste et l'on enregistrerait le préavis dans la
  // durée. Le formulaire déclare donc ses cases dans `cases`, et celles qui
  // sont cochées reviennent dans `case`.
  const declarees = formulaire.getAll('cases').map(String);
  const cochees = new Set(formulaire.getAll('case').map(String));
  for (const cle of declarees) {
    const ligne = existants.get(cle);
    if (!ligne || ligne.type !== 'booleen') continue;
    const valeur = cochees.has(cle) ? '1' : '0';
    if (valeur !== String(ligne.valeur ?? '')) aEcrire.push({ cle, valeur });
  }

  for (const { cle, valeur } of aEcrire) {
    await db.executer(`UPDATE ${table('tarifs')} SET valeur = ? WHERE cle = ?`, [valeur, cle]);
  }
  viderCache();
  return aEcrire.length;
}

/**
 * Les modules de l'ERP tels qu'un commercial les vend.
 *
 * Le prix vient du module s'il en porte un, du tarif général sinon : on ne
 * recopie pas 49 € treize fois pour devoir les changer treize fois. Le
 * « pourquoi » et le « ce que ça rapporte » ne sont pas inventés ici — ce
 * sont l'accroche et le premier bénéfice de la fiche, déjà rédigés et déjà
 * traduits.
 */
export async function modulesVendables() {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT id, slug, nom, accroche, benefices, prix_cents, groupe, pack
     FROM ${table('modules')} WHERE actif = ? ORDER BY ordre, nom`,
    [vrai(true)],
  );
  const defaut = (await tarifsEnVigueur()).prix_module_cents;
  return lignes.map((m) => {
    const benefices = lireJson(m.benefices, []);
    return {
      id: m.id,
      slug: m.slug,
      nom: m.nom || m.slug,
      groupe: m.groupe,
      pourquoi: m.accroche || null,
      apporte: benefices[0]?.titre || null,
      detail: benefices[0]?.texte || null,
      prix_cents: Number(m.prix_cents) || defaut,
      prix_propre: Number(m.prix_cents) > 0,
      // Vide si le module se vend seul ; sinon la clé de son pack — celui-là
      // ne se facture pas à l'unité, le prix du pack le couvre.
      pack: m.pack || null,
    };
  });
}

/**
 * La copie d'un pack telle qu'elle part sur une offre.
 *
 * Le prix et l'unité sont recopiés, pas référencés : une grille qui bouge le
 * mois prochain ne doit pas changer le montant d'une offre déjà chiffrée. La
 * composition suit, parce qu'elle figure sur le document — le client doit
 * pouvoir relire ce qu'il a acheté même si le pack a changé depuis.
 */
export function instantanePacks(packs) {
  return packs.map((p) => ({
    cle: p.cle,
    nom: p.nom,
    prix_cents: p.prix_cents,
    unite: p.unite,
    base: Boolean(p.base),
    avec_caisse: Boolean(p.avec_caisse),
    modules: (p.modules || []).map((m) => ({ slug: m.slug, nom: m.nom })),
  }));
}

// ---------------------------------------------------------------------------
// Le suivi commercial : les étapes, et le journal d'une offre
// ---------------------------------------------------------------------------

/**
 * Le statut qu'une étape entraîne — obligatoire depuis la fusion.
 *
 * L'étape est la seule commande : c'est elle qui dit où en est l'offre, et le
 * statut n'en est plus que la conséquence technique — modifiable ou figée,
 * comptée ou non dans les relances. Une étape sans statut laisserait ces
 * questions sans réponse pour les offres qui y passent.
 */
function statutDEtape(valeur, quoi) {
  const s = String(valeur || '').trim();
  if (!STATUTS_OFFRE.includes(s)) {
    throw new Error(
      `L'étape « ${quoi} » doit dire dans quel état elle met l'offre : ${STATUTS_OFFRE.join(', ')}.`,
    );
  }
  return s;
}

/** Les étapes du pipeline, dans leur ordre. */
export async function listerEtapes({ activesSeulement = false } = {}) {
  const db = await connexion();
  const sql = activesSeulement
    ? `SELECT * FROM ${table('etapes')} WHERE actif = ? ORDER BY ordre, nom`
    : `SELECT * FROM ${table('etapes')} ORDER BY ordre, nom`;
  const lignes = await db.requete(sql, activesSeulement ? [vrai(true)] : []);
  return lignes.map((e) => ({
    ...e,
    actif: Boolean(e.actif),
    statut: STATUTS_OFFRE.includes(e.statut) ? e.statut : '',
    gabarit_actif: Boolean(e.gabarit_actif),
    relance_active: Boolean(e.relance_active),
    relance_jours: Number(e.relance_jours) || 0,
  }));
}

/**
 * L'étape qui va avec un statut : la première active qui l'entraîne.
 *
 * « La première » parce que plusieurs étapes peuvent mener au même statut —
 * discussion et attente de décision supposent l'une comme l'autre une offre
 * envoyée. C'est l'ordre du pipeline qui tranche, et c'est le réglage de la
 * console qui fixe cet ordre.
 */
export async function etapePourStatut(statut) {
  if (!statut) return null;
  const etapes = await listerEtapes({ activesSeulement: true });
  return etapes.find((e) => e.statut === statut) || null;
}

/** Une étape par sa clé, ou `null`. */
export async function etapeParCle(cle) {
  if (!cle) return null;
  return (await listerEtapes()).find((e) => e.cle === String(cle)) || null;
}

export async function ajouterEtape(valeurs) {
  const db = await connexion();
  const cle = normaliserCle(valeurs.cle || valeurs.nom);
  if (!cle) throw new Error('Une étape a besoin d’un nom.');
  const dejaLa = await db.requete(`SELECT id FROM ${table('etapes')} WHERE cle = ? LIMIT 1`, [cle]);
  if (dejaLa.length > 0) throw new Error(`L'étape « ${cle} » existe déjà.`);
  await db.executer(
    `INSERT INTO ${table('etapes')}
     (cle, nom, description, ordre, actif, statut, gabarit_actif, relance_active, relance_jours)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cle,
      String(valeurs.nom || '').trim() || cle,
      String(valeurs.description || '').trim() || null,
      Number(valeurs.ordre) || 100,
      vrai(true),
      statutDEtape(valeurs.statut, valeurs.nom || cle),
      vrai(false), vrai(false), 0,
    ],
  );
  viderCache();
  return cle;
}

export async function enregistrerEtape(cle, valeurs) {
  const db = await connexion();
  const jours = String(valeurs.relance_jours ?? '').trim();
  await db.executer(
    `UPDATE ${table('etapes')}
     SET nom = ?, description = ?, ordre = ?, statut = ?,
         gabarit_actif = ?, gabarit_sujet = ?, gabarit_corps = ?,
         relance_active = ?, relance_jours = ?
     WHERE cle = ?`,
    [
      String(valeurs.nom || '').trim() || String(cle),
      String(valeurs.description || '').trim() || null,
      Number(valeurs.ordre) || 100,
      statutDEtape(valeurs.statut, valeurs.nom || cle),
      vrai(valeurs.gabarit_actif === '1' || valeurs.gabarit_actif === true),
      String(valeurs.gabarit_sujet || '').trim() || null,
      String(valeurs.gabarit_corps || '').trim() || null,
      vrai(valeurs.relance_active === '1' || valeurs.relance_active === true),
      jours ? enEntier(jours, `Délai de relance de ${cle}`) : 0,
      String(cle),
    ],
  );
  viderCache();
}

export async function basculerEtape(cle, actif) {
  const db = await connexion();
  await db.executer(`UPDATE ${table('etapes')} SET actif = ? WHERE cle = ?`, [vrai(actif), String(cle)]);
  viderCache();
}

/**
 * Supprime une étape. Les offres qui y étaient n'en ont plus : elles
 * réapparaissent sans étape dans la liste, ce qui se voit — plutôt que de
 * pointer vers une étape disparue, ce qui ne se voit pas.
 */
export async function supprimerEtape(cle) {
  const db = await connexion();
  await db.executer(`UPDATE ${table('offres')} SET etape = NULL WHERE etape = ?`, [String(cle)]);
  await db.executer(`DELETE FROM ${table('etapes')} WHERE cle = ?`, [String(cle)]);
  viderCache();
}

/**
 * Écrit une ligne au journal d'une offre.
 *
 * Jamais modifiée ensuite : c'est ce qui en fait un journal et non un champ
 * « dernière action », lequel efface l'avant-dernière.
 */
export async function journaliser(offreId, { type, texte, utilisateurId = null }) {
  const db = await connexion();
  await db.executer(
    `INSERT INTO ${table('suivi')} (offre_id, quand, utilisateur_id, type, texte)
     VALUES (?, ?, ?, ?, ?)`,
    [Number(offreId), new Date(), Number(utilisateurId) || null, String(type), String(texte || '')],
  );
}

/** Le journal d'une offre, du plus récent au plus ancien. */
export async function listerSuivi(offreId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT s.*, u.nom AS auteur_nom, u.identifiant AS auteur_identifiant
     FROM ${table('suivi')} s
     LEFT JOIN ${table('utilisateurs')} u ON u.id = s.utilisateur_id
     WHERE s.offre_id = ? ORDER BY s.id DESC`,
    [Number(offreId)],
  );
  return lignes;
}

/**
 * Déplace une offre dans le pipeline.
 *
 * Le compteur de silence repart à zéro, et la relance déjà partie est oubliée
 * — il s'est passé quelque chose, la prochaine relance se mérite à nouveau.
 */
export async function changerEtapeOffre(id, cle, utilisateurId = null) {
  const db = await connexion();
  const etape = await etapeParCle(cle);
  if (cle && !etape) throw new Error(`L'étape « ${cle} » n'existe pas.`);
  await db.executer(
    `UPDATE ${table('offres')} SET etape = ?, etape_le = ?, relance_le = NULL WHERE id = ?`,
    [etape ? etape.cle : null, new Date(), Number(id)],
  );
  await journaliser(id, {
    type: 'etape',
    texte: etape ? `Étape : ${etape.nom}` : 'Sortie du pipeline',
    utilisateurId,
  });
  // Le statut suit l'étape. Déplacer une offre dans « Gagnée » sans qu'elle
  // devienne acceptée laisserait la console dire deux choses à la fois.
  if (etape && etape.statut) await ecrireStatut(db, id, etape.statut, utilisateurId);
  viderCache();
}

/**
 * Écrit le statut d'une offre, et lui seul.
 *
 * Le cœur commun des deux mouvements — l'étape qui entraîne le statut, le
 * statut qui entraîne l'étape. Les faire s'appeler l'un l'autre tournerait en
 * rond ; ils appellent tous deux ceci, qui n'appelle rien.
 */
/**
 * Le contrat qui s'édite tout seul, si la case des réglages le demande.
 *
 * Ne lève jamais. Un dossier incomplet est la règle plutôt que l'exception au
 * moment où l'on marque une offre acceptée — refuser le changement de statut
 * pour cette raison empêcherait de noter une bonne nouvelle. Le manque est
 * journalisé, la fiche le répète, et le contrat s'édite d'un bouton quand le
 * dossier est prêt.
 */
async function contratAutomatique(offreId, utilisateurId) {
  const tarifs = new Map((await listerTarifs()).map((l) => [l.cle, l]));
  if (String(lireTarif(tarifs.get('contrat_auto')) || 0) !== '1') return;
  try {
    const { reference } = await genererContrat(offreId, utilisateurId);
    console.log(`✓ contrat ${reference} édité automatiquement`);
  } catch (err) {
    await journaliser(offreId, {
      type: 'contrat',
      texte: `Contrat non édité : ${err.message}`,
      utilisateurId,
    });
  }
}

async function ecrireStatut(db, id, statut, utilisateurId) {
  const [avant] = await db.requete(
    `SELECT statut, envoyee_le FROM ${table('offres')} WHERE id = ? LIMIT 1`,
    [Number(id)],
  );
  if (avant && avant.statut === statut) return false;

  // Une offre partie ne redevient pas un brouillon.
  //
  // C'est la règle qui rend la fusion possible : puisque l'étape commande
  // désormais le statut, ramener une offre à « À qualifier » la rouvrirait à
  // la modification, et l'on réécrirait un document que le client a dans sa
  // boîte. L'étape bouge, le statut reste, et le journal dit pourquoi —
  // plutôt qu'un refus qui empêcherait de ranger son portefeuille.
  if (statut === 'brouillon' && avant && avant.statut !== 'brouillon') {
    await journaliser(id, {
      type: 'statut',
      texte: `Statut inchangé (${avant.statut}) : une offre partie chez un client ne redevient pas un brouillon.`,
      utilisateurId,
    });
    return false;
  }
  // La date d'envoi est celle du premier envoi : repasser par « envoyée »
  // après une discussion ne réécrit pas l'histoire.
  const dater = statut === 'envoyee' && !(avant && avant.envoyee_le);
  await db.executer(
    `UPDATE ${table('offres')} SET statut = ?${dater ? ', envoyee_le = ?' : ''} WHERE id = ?`,
    dater ? [statut, new Date(), Number(id)] : [statut, Number(id)],
  );
  // Le journal garde la trace : « qui a marqué cette offre refusée, et
  // quand » est exactement la question qu'on se pose trois mois plus tard.
  await journaliser(id, { type: 'statut', texte: `Statut : ${statut}`, utilisateurId });
  if (statut === 'acceptee') await contratAutomatique(id, utilisateurId);
  return true;
}

/** Note la date à laquelle une relance est partie, pour ne pas la répéter. */
export async function marquerRelancee(id) {
  const db = await connexion();
  await db.executer(`UPDATE ${table('offres')} SET relance_le = ? WHERE id = ?`, [new Date(), Number(id)]);
  viderCache();
}

/**
 * Les offres vivantes avec leur étape et leur commercial : la matière du
 * script de relance, et du tableau de suivi.
 */
export async function offresEnCours() {
  const db = await connexion();
  return db.requete(
    `SELECT o.*, p.raison_sociale, p.contact_nom, p.contact_email,
            u.nom AS auteur_nom, u.identifiant AS auteur_identifiant
     FROM ${table('offres')} o
     LEFT JOIN ${table('prospects')} p ON p.id = o.prospect_id
     LEFT JOIN ${table('utilisateurs')} u ON u.id = o.cree_par
     WHERE o.statut NOT IN ('acceptee', 'refusee')
       AND o.version = (
         SELECT MAX(v.version) FROM ${table('offres')} v WHERE v.reference = o.reference
       )
     ORDER BY o.etape_le, o.id`,
  );
}

/** Les packs, dans l'ordre où ils se présentent. */
export async function listerPacks({ actifsSeulement = false } = {}) {
  const db = await connexion();
  const sql = actifsSeulement
    ? `SELECT * FROM ${table('packs')} WHERE actif = ? ORDER BY ordre, nom`
    : `SELECT * FROM ${table('packs')} ORDER BY ordre, nom`;
  const lignes = await db.requete(sql, actifsSeulement ? [vrai(true)] : []);
  return lignes.map((p) => ({ ...p, actif: Boolean(p.actif), base: Boolean(p.base) }));
}

/**
 * Les packs vendables, chacun avec les modules qu'il comprend.
 *
 * `avec_caisse` dit si le pack contient une caisse : c'est ce qui fait
 * apparaître le choix « notre caisse ou l'intégration de la vôtre » sur
 * l'offre, plutôt que de le montrer partout.
 */
export async function packsVendables() {
  const [packs, modules] = [await listerPacks({ actifsSeulement: true }), await modulesVendables()];
  return packs.map((p) => {
    const dedans = modules.filter((m) => m.pack === p.cle);
    return { ...p, modules: dedans, avec_caisse: dedans.some((m) => m.slug === 'pos') };
  });
}

/**
 * Le dossier d'annexe d'une offre : ce que le client a retenu, en clair.
 *
 * On repart des **copies** posées sur l'offre — packs et modules — et non du
 * catalogue : une offre partie doit rester lisible telle qu'elle a été
 * signée, même si un pack a changé de composition depuis. Seuls le texte des
 * fiches et les captures viennent du catalogue, parce qu'ils décrivent le
 * produit et non le prix.
 *
 * La caisse est un cas à part : quand le réseau garde la sienne, le module de
 * caisse n'est pas livré, et l'annexe ne doit pas le montrer.
 */
export async function dossierAnnexe(offre) {
  const db = await connexion();
  const parApi = offre.socle_pos === 'api';

  const retenus = [];
  for (const p of offre.packs || []) {
    for (const m of p.modules || []) {
      if (parApi && m.slug === 'pos') continue;
      retenus.push({ slug: m.slug, pack: p.nom });
    }
  }
  for (const m of offre.modules || []) retenus.push({ slug: m.slug, pack: null });
  if (retenus.length === 0) return [];

  const trous = retenus.map(() => '?').join(', ');
  const fiches = await db.requete(
    `SELECT id, slug, nom, accroche, problemes, benefices, leviers, groupe
     FROM ${table('modules')} WHERE slug IN (${trous})`,
    retenus.map((r) => r.slug),
  );
  const captures = fiches.length > 0
    ? await db.requete(
        `SELECT module_id, fichier, titre FROM ${table('captures')}
         WHERE module_id IN (${fiches.map(() => '?').join(', ')}) ORDER BY module_id, ordre`,
        fiches.map((f) => f.id),
      )
    : [];

  const parSlug = new Map(fiches.map((f) => [f.slug, f]));
  return retenus
    .map(({ slug, pack }) => {
      const f = parSlug.get(slug);
      if (!f) return null;
      return {
        slug,
        pack,
        nom: f.nom || slug,
        groupe: f.groupe,
        accroche: f.accroche,
        // Les trois premiers de chaque côté : au-delà, la page se lit comme
        // un catalogue et non comme une proposition.
        problemes: lireJson(f.problemes, []).slice(0, 3),
        benefices: lireJson(f.benefices, []).slice(0, 3),
        leviers: lireJson(f.leviers, []),
        captures: captures.filter((c) => c.module_id === f.id),
      };
    })
    .filter(Boolean);
}

/** Les modules vendus à l'unité : tout ce qui n'est dans aucun pack. */
export async function modulesOptionnels() {
  return (await modulesVendables()).filter((m) => !m.pack);
}

/** Les unités de facturation d'un pack, telles qu'elles s'affichent. */
export const UNITES_PACK = [
  { cle: 'mois', libelle: 'par mois', aide: 'Une seule ligne pour tout le réseau.' },
  { cle: 'poste_mois', libelle: 'par mois et par point de vente', aide: 'Multiplié par le nombre de points de vente de l’offre.' },
];

export async function ajouterPack(valeurs) {
  const db = await connexion();
  const cle = normaliserCle(valeurs.cle || valeurs.nom);
  if (!cle) throw new Error('Un pack a besoin d’un nom.');
  const dejaLa = await db.requete(`SELECT id FROM ${table('packs')} WHERE cle = ? LIMIT 1`, [cle]);
  if (dejaLa.length > 0) throw new Error(`Le pack « ${cle} » existe déjà.`);
  await db.executer(
    `INSERT INTO ${table('packs')} (cle, nom, description, prix_cents, unite, base, actif, ordre)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      cle,
      String(valeurs.nom || '').trim() || cle,
      String(valeurs.description || '').trim() || null,
      enCents(valeurs.prix || '0', `Prix du pack ${cle}`),
      UNITES_PACK.some((u) => u.cle === valeurs.unite) ? String(valeurs.unite) : 'mois',
      vrai(valeurs.base === '1' || valeurs.base === true),
      vrai(true),
      Number(valeurs.ordre) || 100,
    ],
  );
  viderCache();
  return cle;
}

export async function enregistrerPack(cle, valeurs) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('packs')}
     SET nom = ?, description = ?, prix_cents = ?, unite = ?, base = ?, ordre = ?
     WHERE cle = ?`,
    [
      String(valeurs.nom || '').trim() || String(cle),
      String(valeurs.description || '').trim() || null,
      enCents(valeurs.prix || '0', `Prix du pack ${cle}`),
      UNITES_PACK.some((u) => u.cle === valeurs.unite) ? String(valeurs.unite) : 'mois',
      vrai(valeurs.base === '1' || valeurs.base === true),
      Number(valeurs.ordre) || 100,
      String(cle),
    ],
  );
  viderCache();
}

export async function basculerPack(cle, actif) {
  const db = await connexion();
  await db.executer(`UPDATE ${table('packs')} SET actif = ? WHERE cle = ?`, [vrai(actif), String(cle)]);
  viderCache();
}

/**
 * Supprime un pack. Les modules qu'il contenait redeviennent des options,
 * facturées à l'unité — les laisser pointer vers un pack disparu les ferait
 * disparaître de l'offre sans que personne ne le voie.
 */
export async function supprimerPack(cle) {
  const db = await connexion();
  await db.executer(`UPDATE ${table('modules')} SET pack = NULL WHERE pack = ?`, [String(cle)]);
  await db.executer(`DELETE FROM ${table('packs')} WHERE cle = ?`, [String(cle)]);
  viderCache();
}

/** Fixe le prix propre d'un module. Zéro le remet au tarif général. */
export async function enregistrerPrixModule(slug, prix) {
  const db = await connexion();
  const cents = String(prix || '').trim() ? enCents(prix, `Prix de ${slug}`) : 0;
  await db.executer(`UPDATE ${table('modules')} SET prix_cents = ? WHERE slug = ?`, [cents, String(slug)]);
  viderCache();
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
    packs: lireJson(ligne.packs, []),
    prestations: lireJson(ligne.prestations, []),
    modules: lireJson(ligne.modules, []),
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
  const sets = colonnes.map((c) => `${c} = ?`);
  const params = colonnes.map((c) => p[c]);

  // Changer le numéro de TVA périme la vérification. Garder la date d'une
  // vérification faite sur un autre numéro serait le genre de preuve qui se
  // retourne contre soi le jour d'un contrôle.
  const avant = (await db.requete(`SELECT tva FROM ${table('prospects')} WHERE id = ? LIMIT 1`, [Number(id)]))[0];
  if (avant && (avant.tva || null) !== (p.tva || null)) {
    sets.push('tva_verifiee_le = ?', 'tva_verifiee_ref = ?', 'tva_verifiee_nom = ?');
    params.push(null, null, null);
  }
  params.push(Number(id));
  await db.executer(`UPDATE ${table('prospects')} SET ${sets.join(', ')} WHERE id = ?`, params);
  viderCache();
}

/**
 * Applique le résultat d'une vérification VIES à un client démarché.
 *
 * `champs` dit ce qu'on accepte de recopier. Par défaut, tout : c'est le
 * registre qui a raison sur l'orthographe d'une raison sociale étrangère, et
 * une adresse recopiée à la main d'un écran de VIES contient une faute une
 * fois sur trois. Mais un commercial doit pouvoir garder le nom d'usage —
 * « Le Pain Quotidien » plutôt que « LPQ HOLDING SA » — et la case existe.
 *
 * La trace, elle, s'écrit toujours : c'est elle qui prouve la vérification,
 * et elle n'a rien à voir avec ce qu'on a choisi de recopier.
 */
export async function appliquerViesProspect(id, resultat, champs = {}) {
  if (!resultat?.ok) throw new Error('Rien à appliquer : la vérification n’a pas abouti.');
  const db = await connexion();
  const sets = ['tva_verifiee_le = ?', 'tva_verifiee_ref = ?', 'tva_verifiee_nom = ?', 'tva = ?'];
  const params = [
    new Date(),
    String(resultat.reference || '').slice(0, 60) || null,
    String(resultat.nom || '').slice(0, 255) || null,
    resultat.tva,
  ];
  if (champs.nom !== false && resultat.nom) {
    sets.push('raison_sociale = ?');
    params.push(resultat.nom.slice(0, 200));
  }
  if (champs.adresse !== false && resultat.adresse) {
    sets.push('adresse = ?');
    params.push(resultat.adresse);
  }
  if (resultat.pays) {
    sets.push('pays = ?');
    // VIES connaît la Grèce sous « EL » ; le reste du monde l'écrit « GR ».
    // On range le code ISO, parce que c'est celui qui sert à tout le reste.
    params.push(resultat.pays === 'EL' ? 'GR' : resultat.pays);
  }
  params.push(Number(id));
  await db.executer(`UPDATE ${table('prospects')} SET ${sets.join(', ')} WHERE id = ?`, params);
  viderCache();
}

/** Note une vérification qui a abouti sans qu'on recopie quoi que ce soit. */
export async function noterViesProspect(id, resultat) {
  const db = await connexion();
  await db.executer(
    `UPDATE ${table('prospects')} SET tva_verifiee_le = ?, tva_verifiee_ref = ?, tva_verifiee_nom = ? WHERE id = ?`,
    [
      new Date(),
      String(resultat.reference || '').slice(0, 60) || null,
      String(resultat.nom || '').slice(0, 255) || null,
      Number(id),
    ],
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
          prestations, modules, vues, prix_par_vue_cents, multiplicateur_achat, taux_annuel,
          prix_jour_formation_cents, nombre_postes, prix_poste_cents,
          postes_franchiseur, prix_poste_franchiseur_cents,
          postes_onboardes, prix_onboarding_poste_cents, mois_offerts, prix_module_cents,
          packs, socle_pos)
         VALUES (?, ?, 1, 'brouillon', ?, 'EUR', ?, ?, ?, 'pourcent', 0, ?, ?, 'aucune', 0, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 0, ?, 0, ?, ?, 'pos')`,
        [
          Number(prospectId), reference, langue, Number(auteurId) || null, new Date(), valideJusquAu,
          tarifs.tva_defaut, vrai(false), json([]), json([]), json([]),
          tarifs.prix_par_vue_cents, tarifs.multiplicateur_achat,
          tarifs.taux_annuel, tarifs.prix_jour_formation_cents, tarifs.prix_poste_cents,
          tarifs.prix_poste_franchiseur_cents, tarifs.prix_onboarding_poste_cents,
          tarifs.prix_module_cents,
          // Le modèle de base est retenu d'avance : c'est ce qu'on vend à
          // tout le monde, et le décocher est le geste rare. Les packs
          // optionnels, eux, se cochent.
          json(instantanePacks((await packsVendables()).filter((p) => p.base))),
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
      // Sert au repérage des lignes incomplètes : seule une ligne libre peut
      // se retrouver sans intitulé, et on la numérote parmi les siennes.
      libre: Boolean(p.libre),
    })),
    modules: offre.modules || [],
    packs: offre.packs || [],
    socle_pos: offre.socle_pos || 'pos',
    jours_formation: offre.jours_formation || 0,
    nombre_postes: offre.nombre_postes || 0,
    postes_franchiseur: offre.postes_franchiseur || 0,
    postes_onboardes: offre.postes_onboardes || 0,
    mois_offerts: offre.mois_offerts || 0,
    option_app: offre.option_app || 'aucune',
    vues: offre.vues || [],
    tarifs: {
      prix_par_vue_cents: offre.prix_par_vue_cents,
      multiplicateur_achat: offre.multiplicateur_achat,
      taux_annuel: offre.taux_annuel,
      prix_jour_formation_cents: offre.prix_jour_formation_cents,
      prix_poste_cents: offre.prix_poste_cents,
      prix_poste_franchiseur_cents: offre.prix_poste_franchiseur_cents,
      prix_onboarding_poste_cents: offre.prix_onboarding_poste_cents,
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
  const aRattraper = [['postes_onboardes', 'prix_onboarding_poste_cents']];
  if (aRattraper.some(([q, p]) => config[q] > 0 && !offre[p])) {
    const vigueur = await tarifsEnVigueur();
    for (const [quantite, prix] of aRattraper) {
      if (config[quantite] > 0 && !offre[prix]) manquants[prix] = vigueur[prix];
    }
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
       langue = ?, jours_formation = ?, nombre_postes = ?, postes_franchiseur = ?,
       postes_onboardes = ?, mois_offerts = ?, option_app = ?, prestations = ?, modules = ?, vues = ?,
       packs = ?, socle_pos = ?,
       remise_type = ?, remise_valeur = ?, tva_taux = ?, tva_exoneree = ?, tva_mention = ?,
       portee = ?, delai = ?, valide_jusqu_au = ?
     WHERE id = ?`,
    [
      config.langue, config.jours_formation, config.nombre_postes, config.postes_franchiseur,
      config.postes_onboardes, config.mois_offerts, config.option_app,
      json(config.prestations), json(config.modules), json(config.vues),
      json(config.packs || []), config.socle_pos || 'pos',
      config.remise_type, config.remise_valeur,
      config.tva_taux, vrai(config.tva_exoneree), config.tva_mention || null,
      config.portee || null, config.delai || null, config.valide_jusqu_au || null,
      Number(id),
    ],
  );

  const lignes = lignesDe({
    prestations: config.prestations,
    modules: config.modules,
    packs: config.packs,
    socle_pos: config.socle_pos,
    jours_formation: config.jours_formation,
    nombre_postes: config.nombre_postes,
    postes_franchiseur: config.postes_franchiseur,
    postes_onboardes: config.postes_onboardes,
    option_app: config.option_app,
    vues: config.vues,
    tarifs: {
      prix_par_vue_cents: offre.prix_par_vue_cents,
      multiplicateur_achat: offre.multiplicateur_achat,
      taux_annuel: offre.taux_annuel,
      prix_jour_formation_cents: offre.prix_jour_formation_cents,
      prix_poste_cents: offre.prix_poste_cents,
      prix_poste_franchiseur_cents: offre.prix_poste_franchiseur_cents,
      prix_onboarding_poste_cents: offre.prix_onboarding_poste_cents,
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
      prestations, modules, vues, prix_par_vue_cents, multiplicateur_achat, taux_annuel, prix_jour_formation_cents,
      nombre_postes, prix_poste_cents, postes_franchiseur, prix_poste_franchiseur_cents,
      postes_onboardes, prix_onboarding_poste_cents, mois_offerts, prix_module_cents, portee, delai,
      packs, socle_pos)
     VALUES (?, ?, ?, 'brouillon', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      source.prospect_id, String(reference), version, source.langue, source.devise,
      source.cree_par, new Date(), valideJusquAu,
      source.remise_type, source.remise_valeur, source.tva_taux, vrai(source.tva_exoneree),
      source.tva_mention, source.option_app, source.jours_formation,
      json(source.prestations), json(source.modules), json(source.vues),
      tarifs.prix_par_vue_cents, tarifs.multiplicateur_achat,
      tarifs.taux_annuel, tarifs.prix_jour_formation_cents,
      source.nombre_postes, tarifs.prix_poste_cents,
      source.postes_franchiseur, tarifs.prix_poste_franchiseur_cents,
      source.postes_onboardes, tarifs.prix_onboarding_poste_cents,
      source.mois_offerts, tarifs.prix_module_cents,
      source.portee, source.delai,
      // Les mêmes packs, mais aux prix d'aujourd'hui : c'est tout l'objet
      // d'une nouvelle version. Un pack disparu du catalogue disparaît.
      json(instantanePacks(
        (await packsVendables()).filter((p) => (source.packs || []).some((q) => q.cle === p.cle)),
      )),
      source.socle_pos || 'pos',
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

export async function changerStatutOffre(id, statut, utilisateurId = null) {
  if (!STATUTS_OFFRE.includes(statut)) throw new Error(`Statut inconnu : ${statut}.`);
  const db = await connexion();
  await ecrireStatut(db, id, statut, utilisateurId);

  // Et l'étape suit le statut, en sens inverse.
  //
  // Sauf si l'offre est déjà dans une étape qui entraîne ce statut : sans
  // cette réserve, marquer « envoyée » une offre en attente de décision la
  // ramènerait à « Offre envoyée », c'est-à-dire la ferait reculer dans le
  // pipeline pour avoir confirmé ce qu'on savait déjà.
  const [offre] = await db.requete(`SELECT etape FROM ${table('offres')} WHERE id = ? LIMIT 1`, [Number(id)]);
  const actuelle = offre ? await etapeParCle(offre.etape) : null;
  if (!actuelle || actuelle.statut !== statut) {
    const cible = await etapePourStatut(statut);
    if (cible && (!actuelle || cible.cle !== actuelle.cle)) {
      await db.executer(
        `UPDATE ${table('offres')} SET etape = ?, etape_le = ?, relance_le = NULL WHERE id = ?`,
        [cible.cle, new Date(), Number(id)],
      );
      await journaliser(id, { type: 'etape', texte: `Étape : ${cible.nom}`, utilisateurId });
    }
  }
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
export async function listerOffres({ prospect = '', statut = '', etape = '', auteur = '' } = {}) {
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
    // « hors » n'est pas une étape mais son absence : une offre qu'on n'a pas
    // encore rangée dans le pipeline, et c'est précisément ce qu'on cherche
    // quand on la cherche.
    if (etape === 'hors' && o.etape) return false;
    if (etape && etape !== 'hors' && o.etape !== etape) return false;
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
    cle: 'tarifs',
    nom: 'Mentions et courriel',
    table: 'tarifs',
    libelle: (l) => l.libelle || l.cle,
    filtre: (l) => l.type === 'texte',
    champs: [{ nom: 'valeur', libelle: 'Texte' }],
  },
  {
    cle: 'prestations',
    nom: 'Prestations vendues',
    table: 'prestations',
    libelle: (l) => l.cle,
    champs: [
      { nom: 'nom', libelle: 'Nom' },
      { nom: 'description', libelle: 'Description' },
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
  if (cle === 'tarifs') return 'ordre, cle';
  if (cle === 'prestations') return 'ordre, nom';
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
  const toutes = await db.requete(
    `SELECT * FROM ${table(entite.table)} ORDER BY ${ordreDe(entite.cle)}`,
  );
  // Certaines entités ne traduisent qu'une partie de leurs lignes : un tarif
  // chiffré n'a rien à traduire, seul son intitulé de texte en a.
  const lignes = entite.filtre ? toutes.filter(entite.filtre) : toutes;
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
  // Un prix vide remet le module au tarif général : c'est le seul moyen de
  // revenir en arrière sans deviner quelle était la valeur d'avant.
  if (valeurs.prix !== undefined) {
    const brut = String(valeurs.prix ?? '').trim();
    await db.executer(
      `UPDATE ${table('modules')} SET prix_cents = ? WHERE slug = ?`,
      [brut ? enCents(brut, `Prix de ${slug}`) : 0, String(slug)],
    );
  }
  // Le pack auquel le module appartient. Vide = il se vend seul ; sinon il
  // vient avec son pack et le prix du pack le couvre. Une clé inconnue est
  // refusée plutôt que posée : un module rattaché à un pack inexistant
  // disparaîtrait de l'offre sans que rien ne le signale.
  let pack = String(valeurs.pack || '').trim() || null;
  if (pack) {
    const connu = await db.requete(`SELECT id FROM ${table('packs')} WHERE cle = ? LIMIT 1`, [pack]);
    if (connu.length === 0) throw new Error(`Le pack « ${pack} » n'existe pas.`);
  }
  await db.executer(
    `UPDATE ${table('modules')} SET groupe = ?, icone = ?, ordre = ?, leviers = ?, pack = ? WHERE slug = ?`,
    [
      String(valeurs.groupe || '').trim() || null,
      String(valeurs.icone || '').trim() || null,
      Number(valeurs.ordre) || 100,
      json(valeurs.leviers),
      pack,
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
// Le dossier client, les pièces, et le contrat
// ---------------------------------------------------------------------------

/**
 * Enregistre le dossier d'un prospect.
 *
 * Séparé de `enregistrerProspect` à dessein : la fiche de premier contact
 * exige trois champs, le dossier en exige dix de plus. Les mélanger
 * obligerait à tout remplir pour corriger un numéro de téléphone.
 */
export async function enregistrerDossier(id, valeurs) {
  const db = await connexion();
  const colonnes = CHAMPS_DOSSIER.map((c) => c.nom);
  const lire = (champ) => {
    const brut = String(valeurs[champ.nom] ?? '').trim();
    if (champ.case) return vrai(brut === '1' || brut === 'on');
    if (champ.nombre) return brut ? enEntier(brut, champ.libelle) : 0;
    return brut || null;
  };
  await db.executer(
    `UPDATE ${table('prospects')} SET ${colonnes.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
    [...CHAMPS_DOSSIER.map(lire), Number(id)],
  );
  viderCache();
}

/** Les pièces d'un prospect, la plus récente d'abord. */
export async function listerPieces(prospectId) {
  const db = await connexion();
  // Sans `contenu` : une liste de dix pièces chargerait dix fichiers en
  // mémoire pour n'afficher que leurs noms.
  return db.requete(
    `SELECT id, prospect_id, contrat_id, type, nom, type_mime, taille, depose_le, depose_par
     FROM ${table('pieces')} WHERE prospect_id = ? ORDER BY id DESC`,
    [Number(prospectId)],
  );
}

/** Une pièce avec son contenu, pour le téléchargement. */
export async function chargerPiece(id) {
  const db = await connexion();
  const lignes = await db.requete(`SELECT * FROM ${table('pieces')} WHERE id = ? LIMIT 1`, [Number(id)]);
  return lignes[0] || null;
}

/** Ce qu'on accepte de recevoir, et jusqu'à quel poids. */
const PIECE_TAILLE_MAX = 8 * 1024 * 1024;
const PIECE_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

export async function ajouterPiece(prospectId, { type, fichier, contratId = null, deposePar = null }) {
  if (!fichier || typeof fichier === 'string' || !fichier.size) {
    throw new Error('Aucun fichier reçu.');
  }
  if (fichier.size > PIECE_TAILLE_MAX) {
    throw new Error(
      `Le fichier fait ${Math.round(fichier.size / 1024 / 1024)} Mo, le maximum est ${PIECE_TAILLE_MAX / 1024 / 1024} Mo.`,
    );
  }
  const mime = String(fichier.type || '');
  if (!PIECE_TYPES.has(mime)) {
    throw new Error(
      `Format refusé (${mime || 'inconnu'}). Un PDF, un PNG, un JPEG ou un WebP — un scan de carte d'identité ou d'extrait de registre est toujours l'un des quatre.`,
    );
  }
  const octets = Buffer.from(new Uint8Array(await fichier.arrayBuffer()));
  const db = await connexion();
  await db.executer(
    `INSERT INTO ${table('pieces')}
     (prospect_id, contrat_id, type, nom, type_mime, taille, contenu, depose_le, depose_par)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(prospectId), Number(contratId) || null, String(type || 'autre'),
      String(fichier.name || 'piece').slice(0, 255), mime, octets.length,
      octets.toString('base64'), new Date(), Number(deposePar) || null,
    ],
  );
  viderCache();
}

export async function supprimerPiece(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('pieces')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

/** Les contrats, du plus récent au plus ancien. */
export async function listerContrats({ statut = '' } = {}) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT c.*, p.raison_sociale, p.signataire_nom, p.signataire_email,
            o.reference AS offre_reference, o.version AS offre_version,
            u.nom AS auteur_nom
     FROM ${table('contrats')} c
     LEFT JOIN ${table('prospects')} p ON p.id = c.prospect_id
     LEFT JOIN ${table('offres')} o ON o.id = c.offre_id
     LEFT JOIN ${table('utilisateurs')} u ON u.id = c.cree_par
     ORDER BY c.id DESC`,
  );
  return statut ? lignes.filter((c) => c.statut === statut) : lignes;
}

export async function chargerContrat(reference) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT c.*, p.raison_sociale, p.signataire_nom, p.signataire_email,
            o.reference AS offre_reference, o.version AS offre_version
     FROM ${table('contrats')} c
     LEFT JOIN ${table('prospects')} p ON p.id = c.prospect_id
     LEFT JOIN ${table('offres')} o ON o.id = c.offre_id
     WHERE c.reference = ? LIMIT 1`,
    [String(reference)],
  );
  return lignes[0] || null;
}

/** Le contrat d'une offre, s'il en existe un. */
export async function contratDeLOffre(offreId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT * FROM ${table('contrats')} WHERE offre_id = ? ORDER BY id DESC LIMIT 1`,
    [Number(offreId)],
  );
  return lignes[0] || null;
}

/**
 * Édite le contrat d'une offre acceptée.
 *
 * Trois refus, dans cet ordre, parce que le premier rend les autres inutiles :
 * pas de contrat sans offre, pas de contrat sur un dossier incomplet, pas de
 * contrat sur un gabarit vide. Chacun dit ce qui manque — un « impossible »
 * sans raison fait rouvrir cinq écrans pour trouver le champ coupable.
 *
 * Régénérer un contrat déjà parti en signature est refusé : le signataire a
 * le premier texte sous les yeux.
 */
export async function genererContrat(offreId, utilisateurId = null) {
  const db = await connexion();
  const [offreBrute] = await db.requete(`SELECT * FROM ${table('offres')} WHERE id = ? LIMIT 1`, [Number(offreId)]);
  if (!offreBrute) throw new Error("Cette offre n'existe pas.");
  const offre = normaliserOffre(offreBrute);
  const prospect = await chargerProspect(offre.prospect_id);
  if (!prospect) throw new Error("Cette offre n'a pas de client.");

  const existant = await contratDeLOffre(offre.id);
  if (existant && existant.statut !== 'brouillon') {
    throw new Error(
      `Le contrat ${existant.reference} est déjà ${existant.statut} : son texte ne se réécrit plus. Créez une nouvelle offre si les conditions ont changé.`,
    );
  }

  const pieces = await listerPieces(prospect.id);
  const { complet, manque } = dossierComplet(prospect, { pieces });
  if (!complet) {
    throw new Error(
      `Le dossier de ${prospect.raison_sociale} est incomplet : ${manque.map((m) => m.libelle).join(', ')}.`,
    );
  }

  const tarifs = new Map((await listerTarifs()).map((l) => [l.cle, l]));
  const gabarit = lireTarif(tarifs.get('contrat_gabarit')) || '';
  if (!gabarit.trim()) throw new Error("Le gabarit de contrat est vide — il se règle sur l'écran Tarifs.");

  const conditions = {
    date_effet: new Date(),
    duree_mois: lireTarif(tarifs.get('contrat_duree_mois')) || 0,
    preavis_jours: lireTarif(tarifs.get('contrat_preavis_jours')) || 0,
    reconduction: lireTarif(tarifs.get('contrat_reconduction')) || '',
  };

  // Le récapitulatif est celui du courriel : une seule source, sinon le
  // contrat et la lettre finissent par annoncer deux prix.
  const resultat = calculerOffre(configDe(offre));
  const recapitulatif = recapTexte(offre, resultat, (c) => formaterMontant(c, offre.langue, offre.devise));

  const { texte, inconnus, vides } = remplirGabarit(
    gabarit,
    contexteContrat({ offre, prospect, conditions, recapitulatif }),
  );
  if (inconnus.length > 0) {
    throw new Error(
      `Le gabarit utilise des jetons qui n'existent pas : ${inconnus.map((j) => `{${j}}`).join(', ')}. Corrigez-le sur l'écran Tarifs.`,
    );
  }
  if (vides.length > 0) {
    throw new Error(
      `Ces jetons du gabarit n'ont rien à écrire : ${vides.map((j) => `{${j}}`).join(', ')}. Complétez le dossier ou retirez-les du gabarit.`,
    );
  }

  const reference = existant ? existant.reference : `${offre.reference}-C`;
  if (existant) {
    await db.executer(
      `UPDATE ${table('contrats')}
       SET corps = ?, genere_le = ?, date_effet = ?, duree_mois = ?, preavis_jours = ?, reconduction = ?
       WHERE id = ?`,
      [texte, new Date(), conditions.date_effet, conditions.duree_mois,
        conditions.preavis_jours, conditions.reconduction, existant.id],
    );
  } else {
    await db.executer(
      `INSERT INTO ${table('contrats')}
       (reference, offre_id, prospect_id, statut, corps, genere_le,
        date_effet, duree_mois, preavis_jours, reconduction, cree_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [reference, offre.id, prospect.id, 'brouillon', texte, new Date(),
        conditions.date_effet, conditions.duree_mois, conditions.preavis_jours,
        conditions.reconduction, Number(utilisateurId) || null],
    );
  }
  await journaliser(offre.id, {
    type: 'contrat',
    texte: existant ? `Contrat ${reference} régénéré` : `Contrat ${reference} édité`,
    utilisateurId,
  });
  viderCache();
  return { reference, regenere: Boolean(existant) };
}

/**
 * Envoie un contrat en signature.
 *
 * Sans service configuré, rien ne part et le contrat reste `brouillon` : un
 * contrat marqué « envoyé » qui dort dans un journal ferait attendre un
 * commercial pour un courriel que personne n'a reçu.
 */
export async function envoyerEnSignature(reference, utilisateurId = null) {
  const db = await connexion();
  const contrat = await chargerContrat(reference);
  if (!contrat) throw new Error(`Le contrat ${reference} n'existe pas.`);
  if (contrat.statut === 'signe') throw new Error('Ce contrat est déjà signé.');

  const service = serviceSignature();
  const { enveloppe, statut } = await service.envoyer({
    reference: contrat.reference,
    signataire_nom: contrat.signataire_nom,
    signataire_email: contrat.signataire_email,
    corps: contrat.corps,
  });

  await db.executer(
    `UPDATE ${table('contrats')}
     SET statut = ?, envoye_le = ?, signature_service = ?, signature_enveloppe = ?,
         signature_statut = ?, signature_maj_le = ?
     WHERE id = ?`,
    [statut, service.signe ? new Date() : null, service.nom, enveloppe || null,
      statut, new Date(), contrat.id],
  );
  await journaliser(contrat.offre_id, {
    type: 'contrat',
    texte: service.signe
      ? `Contrat ${reference} envoyé en signature par ${service.nom}`
      : `Contrat ${reference} : aucun service de signature configuré, rien n'est parti`,
    utilisateurId,
  });
  viderCache();
  return { expedie: service.signe, service: service.nom };
}

/**
 * Demande au prestataire où en est la signature.
 *
 * Interrogé à la demande plutôt que par un rappel automatique : un contrat
 * se relève une fois par jour au plus, et un abonnement à des rappels
 * exigerait une adresse publique que ce serveur n'a pas.
 */
export async function rafraichirSignature(reference, utilisateurId = null) {
  const db = await connexion();
  const contrat = await chargerContrat(reference);
  if (!contrat) throw new Error(`Le contrat ${reference} n'existe pas.`);
  if (!contrat.signature_enveloppe) {
    throw new Error("Ce contrat n'a pas d'enveloppe chez un prestataire : il n'y a rien à interroger.");
  }
  const service = serviceSignature();
  const { statut } = await service.etat(contrat.signature_enveloppe);
  const change = statut !== contrat.statut;
  await db.executer(
    `UPDATE ${table('contrats')}
     SET statut = ?, signature_statut = ?, signature_maj_le = ?${statut === 'signe' ? ', signe_le = ?' : ''}
     WHERE id = ?`,
    statut === 'signe'
      ? [statut, statut, new Date(), new Date(), contrat.id]
      : [statut, statut, new Date(), contrat.id],
  );
  if (change) {
    await journaliser(contrat.offre_id, {
      type: 'contrat',
      texte: `Contrat ${reference} : ${statut}`,
      utilisateurId,
    });
  }
  viderCache();
  return { statut, change };
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
