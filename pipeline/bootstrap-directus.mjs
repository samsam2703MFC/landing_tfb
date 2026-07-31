#!/usr/bin/env node
/**
 * Création du schéma Directus (collections, champs, relation).
 *
 * Idempotent : le script relit ce qui existe et ne crée que ce qui manque.
 * On peut donc le rejouer après chaque évolution du modèle sans rien casser.
 *
 * Usage : node bootstrap-directus.mjs
 */

import {
  appelDirectus,
  champsExistants,
  collectionExiste,
  creerChamp,
  creerCollection,
} from './lib/directus.mjs';

// ---------------------------------------------------------------------------
// Fabriques de définitions de champs (raccourcis lisibles)
// ---------------------------------------------------------------------------

const pk = () => ({
  field: 'id',
  type: 'integer',
  meta: { hidden: true, interface: 'input', readonly: true },
  schema: { is_primary_key: true, has_auto_increment: true },
});

const chaine = (field, { requis = false, unique = false, note = '' } = {}) => ({
  field,
  type: 'string',
  meta: { interface: 'input', required: requis, note },
  schema: { is_nullable: !requis, is_unique: unique },
});

const texte = (field, { note = '', markdown = false } = {}) => ({
  field,
  type: 'text',
  meta: { interface: markdown ? 'input-rich-text-md' : 'input-multiline', note },
  schema: { is_nullable: true },
});

const json = (field, { note = '' } = {}) => ({
  field,
  type: 'json',
  meta: { interface: 'input-code', options: { language: 'json' }, note },
  schema: { is_nullable: true },
});

const entier = (field, { defaut = null, note = '' } = {}) => ({
  field,
  type: 'integer',
  meta: { interface: 'input', note },
  schema: { is_nullable: true, default_value: defaut },
});

const booleen = (field, { defaut = true, note = '' } = {}) => ({
  field,
  type: 'boolean',
  meta: { interface: 'boolean', note },
  schema: { is_nullable: false, default_value: defaut },
});

const horodatage = (field, { note = '' } = {}) => ({
  field,
  type: 'timestamp',
  meta: { interface: 'datetime', note },
  schema: { is_nullable: true },
});

// ---------------------------------------------------------------------------
// Modèle de données
// ---------------------------------------------------------------------------

const COLLECTIONS = [
  {
    nom: 'modules',
    meta: {
      icon: 'widgets',
      note: "Un module = un dépôt GitHub. Contenu régénéré par le pipeline d'ingestion.",
      display_template: '{{nom}}',
      sort_field: 'ordre',
    },
    champs: [
      chaine('slug', { requis: true, unique: true, note: "Identifiant d'URL, stable dans le temps." }),
      chaine('repo', { note: 'Dépôt GitHub source, au format org/nom.' }),
      chaine('ref', { note: 'Branche lue lors de la dernière ingestion.' }),
      chaine('groupe', { note: 'Famille de modules affichée sur la landing.' }),
      entier('ordre', { defaut: 100, note: "Ordre d'affichage." }),
      booleen('actif', { defaut: true, note: 'Décoché = masqué sur la landing.' }),
      chaine('nom'),
      texte('accroche'),
      texte('resume'),
      texte('description', { markdown: true }),
      chaine('public_cible'),
      json('problemes', { note: '[{ titre, texte }]' }),
      json('benefices', { note: '[{ titre, texte }]' }),
      json('stack', { note: '["Astro", "MySQL", ...]' }),
      json('mots_cles', { note: '["...", ...]' }),
      texte('mermaid', { note: 'Diagramme du parcours principal, rendu côté navigateur.' }),
      chaine('commit_sha', { note: 'Commit ingéré — sert à sauter les dépôts inchangés.' }),
      chaine('modele_ia', { note: 'Modèle Anthropic ayant produit le contenu.' }),
      horodatage('genere_le'),
    ],
  },
  {
    nom: 'fonctions',
    meta: {
      icon: 'list',
      note: "Fonctions d'un module, déduites du code source.",
      display_template: '{{nom}}',
      sort_field: 'ordre',
    },
    champs: [
      entier('module', { note: 'Module parent.' }),
      chaine('cle', { requis: true, note: 'Clé stable — sert de clé de mise à jour.' }),
      chaine('nom'),
      texte('description'),
      texte('benefice'),
      chaine('icone', { note: "Nom d'icône Lucide." }),
      entier('ordre', { defaut: 100 }),
    ],
  },
  {
    nom: 'site',
    singleton: true,
    meta: {
      icon: 'home',
      singleton: true,
      note: "Contenu de la page d'accueil, régénéré à la fin de chaque ingestion complète.",
    },
    champs: [
      chaine('titre'),
      chaine('sous_titre'),
      texte('accroche'),
      json('problemes', { note: '[{ titre, texte }]' }),
      json('reponses', { note: '[{ titre, texte }]' }),
      texte('mermaid', { note: "Schéma d'ensemble de la plateforme." }),
      chaine('cta_texte'),
      chaine('cta_url'),
      texte('meta_description'),
      horodatage('genere_le'),
    ],
  },
];

/** Relation fonctions.module → modules.id, avec le champ inverse côté modules. */
const RELATION = {
  collection: 'fonctions',
  field: 'module',
  related_collection: 'modules',
  meta: { one_field: 'fonctions', sort_field: 'ordre', one_deselect_action: 'delete' },
  schema: { on_delete: 'CASCADE' },
};

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

async function assurerCollection(definition) {
  if (await collectionExiste(definition.nom)) {
    console.log(`• collection ${definition.nom} : déjà présente`);
    const presents = await champsExistants(definition.nom);
    for (const champ of definition.champs) {
      if (presents.has(champ.field)) continue;
      await creerChamp(definition.nom, champ);
      console.log(`  + champ ${definition.nom}.${champ.field}`);
    }
    return;
  }

  await creerCollection({
    collection: definition.nom,
    meta: definition.meta,
    schema: { name: definition.nom },
    fields: [pk(), ...definition.champs],
  });
  console.log(`✓ collection ${definition.nom} créée (${definition.champs.length + 1} champs)`);
}

async function assurerRelation() {
  try {
    await appelDirectus(`/relations/${RELATION.collection}/${RELATION.field}`);
    console.log('• relation fonctions.module : déjà présente');
    return;
  } catch (err) {
    if (err.statut !== 403 && err.statut !== 404) throw err;
  }

  // Le champ inverse (alias o2m) doit exister côté modules avant la relation.
  const champsModules = await champsExistants('modules');
  if (!champsModules.has('fonctions')) {
    await creerChamp('modules', {
      field: 'fonctions',
      type: 'alias',
      meta: { interface: 'list-o2m', special: ['o2m'], note: 'Fonctions rattachées.' },
    });
    console.log('  + champ modules.fonctions (alias o2m)');
  }

  await appelDirectus('/relations', { methode: 'POST', body: RELATION });
  console.log('✓ relation fonctions.module → modules.id créée');
}

/** Valeurs par défaut du singleton, écrites une seule fois. */
async function amorcerSite() {
  const actuel = await appelDirectus('/items/site').catch(() => null);
  if (actuel && actuel.titre) return;
  await appelDirectus('/items/site', {
    methode: 'PATCH',
    body: { cta_texte: 'Demander une démonstration', cta_url: '#contact' },
  });
  console.log('✓ singleton site initialisé');
}

async function principal() {
  console.log(`→ Directus : ${process.env.DIRECTUS_URL}`);

  for (const definition of COLLECTIONS) {
    await assurerCollection(definition);
  }
  await assurerRelation();
  await amorcerSite();

  console.log('\nSchéma prêt. Lancer ensuite : npm run ingest:all');
}

principal().catch((err) => {
  console.error(`\n✗ Bootstrap interrompu : ${err.message}`);
  process.exit(1);
});
