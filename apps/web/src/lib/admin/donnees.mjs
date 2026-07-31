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
  { nom: 'mermaid', libelle: 'Schéma Mermaid', type: 'code', lignes: 10, aide: 'Rendu dans le navigateur. Sans accents dans les libellés de nœuds.' },
];

/** Les colonnes de la page d’accueil éditables depuis la console. */
export const CHAMPS_SITE = [
  { nom: 'titre', libelle: 'Titre principal', type: 'zone', lignes: 2 },
  { nom: 'sous_titre', libelle: 'Sous-titre', type: 'zone', lignes: 2 },
  { nom: 'accroche', libelle: 'Accroche', type: 'zone', lignes: 6 },
  { nom: 'cta_texte', libelle: 'Libellé du bouton', type: 'ligne' },
  { nom: 'cta_url', libelle: 'Cible du bouton', type: 'ligne' },
  { nom: 'meta_description', libelle: 'Description pour les moteurs', type: 'zone', lignes: 3 },
  { nom: 'mermaid', libelle: 'Schéma d’ensemble', type: 'code', lignes: 12 },
];

/** Décode les colonnes JSON d’un module. */
function normaliser(ligne) {
  return {
    ...ligne,
    actif: Boolean(ligne.actif),
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
  const nombre = (ligne) => Number(ligne?.total ?? ligne?.TOTAL ?? 0);
  return {
    modules: nombre(modules),
    actifs: nombre(actifs),
    fonctions: nombre(fonctions),
    captures: nombre(captures),
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
  return lignes.map((l) => ({
    ...normaliser(l),
    nb_fonctions: compte(fonctions, l.id),
    nb_captures: compte(captures, l.id),
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
  module.fonctions = fonctions.map((f) => ({ ...f, leviers: lireJson(f.leviers, []) }));

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
