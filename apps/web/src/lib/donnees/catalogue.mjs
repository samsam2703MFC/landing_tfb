/**
 * Ce qui contrôle une déclaration d'endpoint.
 *
 * La bibliothèque elle-même vit en base — voir `endpoints.mjs` — parce qu'on
 * veut la chercher, la relier à des applications et l'essayer depuis un écran.
 * Ce fichier garde ce qui ne se négocie pas : la forme d'un identifiant, ce
 * qu'une déclaration doit contenir pour être servie, et les garanties qu'on en
 * calcule. C'est la seule porte d'écriture, donc rien d'invalide n'atteint la
 * table.
 *
 * Une ressource est une **déclaration**, pas une URL. Elle nomme une vue, la
 * liste des colonnes qui peuvent sortir, les filtres acceptés et leur plafond de
 * lignes. Le SQL est fabriqué à partir de ça et de rien d'autre : la requête ne
 * peut nommer qu'un filtre déjà déclaré, et sa valeur part toujours en
 * paramètre lié. C'est tout l'argument de sécurité, et il ne dépend pas de
 * l'endroit où vit la déclaration : il dépend de ce contrôle-ci, qui s'applique
 * avant toute écriture.
 *
 * POURQUOI UNE VUE ET JAMAIS UNE TABLE. Exposer une table fait de ses noms de
 * colonnes votre contrat public : vous ne pourrez plus jamais en renommer une
 * sans casser l'application installée chez chaque client. `CREATE VIEW` ne
 * touche à aucune table — la contrainte « je ne change pas la structure de ma
 * base » tient toujours.
 *
 * CE QUI N'EST PAS ICI, ET POURQUOI. Les appels vers l'API d'un client ne
 * passent pas par les endpoints : cette application a déjà les connexions, les
 * manifests de connecteurs, le coffre à secrets et `verifierAdresse()` — avec
 * son contrôle du réattachement DNS. Redéclarer un hôte ici créerait un second
 * chemin pour joindre la caisse d'un client, avec ses propres garde-fous à
 * maintenir. Une ressource distante se déclare donc comme une connexion, dans
 * l'écran des connexions.
 */

/** Les opérateurs de comparaison qu'un filtre peut déclarer. Le reste est refusé. */
export const OPERATEURS = ['eq', 'in', 'gte', 'lte'];

/** Ce que chaque opérateur veut dire, pour l'écran. */
export const OPERATEURS_DITS = {
  eq: 'égal à',
  in: 'parmi',
  gte: 'à partir de',
  lte: "jusqu'à",
};

/**
 * Où vivent les données, et donc **ce qui isole un client d'un autre**.
 *
 *   · `base_client` — chaque client a sa base, de structure identique aux
 *     autres. L'isolation est la connexion : le SQL ne nomme jamais le client.
 *   · `colonne` — tout le monde partage une base, et l'isolation est un filtre
 *     injecté côté serveur.
 *
 * La portée est **déclarée**, jamais devinée. Les deux erreurs qui font fuiter
 * ne se ressemblent pas : en portée « colonne », c'est un filtre oublié, visible
 * dans le SQL et donc testable ; en portée « base_client », c'est une connexion
 * mal choisie, et le SQL a l'air parfaitement sain. Choisir un défaut aurait
 * fait de la seconde une conséquence d'un oubli de frappe.
 */
export const PORTEES = ['base_client', 'colonne'];

/**
 * La colonne qui porte le client dans une base partagée. Injectée côté serveur,
 * jamais lue depuis la requête : un `?prospect=` pris au mot est exactement la
 * façon dont un client finit par lire les lignes d'un autre.
 */
export const COLONNE_CLIENT = 'prospect_id';

/**
 * Un identifiant SQL nu. Tous les noms qui atteignent une requête sont vérifiés
 * ici, bien qu'ils viennent tous du catalogue et jamais de la requête : le jour
 * où quelqu'un ajoute une entrée à la main, ce contrôle est ce qui empêche une
 * faute de frappe de devenir une injection.
 */
const IDENTIFIANT = /^[a-z_][a-z0-9_]*$/;

export function estIdentifiant(valeur) {
  return typeof valeur === 'string' && IDENTIFIANT.test(valeur);
}

/** La clé d'une ressource part dans un chemin d'URL : « groupe.ressource ». */
const FORME_CLE = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

export function estCleRessource(valeur) {
  return typeof valeur === 'string' && FORME_CLE.test(valeur);
}

/**
 * Contrôle complet d'une déclaration. Rendu comme un message ou `null`.
 *
 * Le même contrôle sert à l'assistant et au catalogue : une entrée écrite à la
 * main doit passer par où passe une entrée générée, sinon le seul chemin
 * vérifié est celui qu'on emprunte le moins.
 */
export function controlerRessource(cle, r) {
  if (!estCleRessource(cle)) return 'Clé attendue au format « groupe.ressource », en minuscules.';
  if (!r || typeof r !== 'object') return 'Déclaration absente.';
  if (!PORTEES.includes(r.portee)) return 'Portée manquante : « base_client » ou « colonne ».';
  if (!estIdentifiant(r.source)) return 'Source invalide.';
  if (!r.source.startsWith('v_')) return 'La source doit être une vue (préfixe « v_ »), jamais une table.';
  if (!Array.isArray(r.colonnes) || r.colonnes.length === 0) return 'Aucune colonne exposée.';
  if (!r.colonnes.every(estIdentifiant)) return 'Nom de colonne invalide.';

  if (r.portee === 'colonne') {
    if (!estIdentifiant(r.colonneClient)) return 'La colonne portant le client est obligatoire en base partagée.';
    // Elle sert à filtrer, pas à sortir. L'exposer permettrait à un client de
    // lire l'identifiant sous lequel il est rangé — inutile pour lui, utile
    // pour deviner celui des autres.
    if (r.colonnes.includes(r.colonneClient)) return 'La colonne du client ne doit pas être exposée — elle filtre, elle ne sort pas.';
  } else if (r.colonneClient) {
    // Une colonne de client dans une base qui n'appartient qu'à ce client
    // laisserait croire à un filtre là où il n'y en a aucun. Le jour où la
    // ressource passerait en base partagée, on croirait la protection déjà là.
    return 'En base par client, aucune colonne de client : l’isolation est la connexion.';
  }
  if (!Number.isInteger(r.maxLignes) || r.maxLignes < 1 || r.maxLignes > 1000) {
    return 'Le plafond de lignes doit être un entier entre 1 et 1000.';
  }
  for (const [colonne, ops] of Object.entries(r.filtres || {})) {
    if (!r.colonnes.includes(colonne)) return `Filtre sur une colonne non exposée : ${colonne}.`;
    if (!Array.isArray(ops) || ops.length === 0) return `Aucun opérateur déclaré pour ${colonne}.`;
    for (const op of ops) if (!OPERATEURS.includes(op)) return `Opérateur inconnu : ${op}.`;
  }
  for (const colonne of r.triables || []) {
    if (!r.colonnes.includes(colonne)) return `Tri sur une colonne non exposée : ${colonne}.`;
  }
  return null;
}

/**
 * Les garanties d'une ressource, **calculées** et non affirmées.
 *
 * Une console qui affiche « sécurisé ✓ » en dur ment le jour où la déclaration
 * change. Chaque ligne ci-dessous est relue depuis la déclaration elle-même, de
 * sorte qu'une entrée mal formée s'affiche en rouge au lieu de passer inaperçue.
 */
export function garanties(r) {
  const triOk = (r.triables || []).every((c) => (r.colonnes || []).includes(c));
  const filtresOk = Object.keys(r.filtres || {}).every((c) => (r.colonnes || []).includes(c));
  const isolation = r.portee === 'base_client'
    ? [{ libelle: 'Isolation', valeur: 'base propre au client', ok: true },
       { libelle: 'Connexion', valeur: 'jamais celle de la console', ok: !r.colonneClient }]
    : [{ libelle: 'Client injecté côté serveur', valeur: r.colonneClient, ok: estIdentifiant(r.colonneClient) },
       { libelle: 'Colonne du client non exposée', valeur: (r.colonnes || []).includes(r.colonneClient) ? 'exposée' : 'filtre seulement',
         ok: !(r.colonnes || []).includes(r.colonneClient) }];
  return [
    ...isolation,
    { libelle: 'Colonnes en liste blanche', valeur: String((r.colonnes || []).length), ok: (r.colonnes || []).every(estIdentifiant) },
    { libelle: 'Filtres déclarés', valeur: Object.keys(r.filtres || {}).join(', ') || 'aucun', ok: filtresOk },
    { libelle: 'Tri restreint', valeur: (r.triables || []).join(', ') || 'aucun', ok: triOk },
    { libelle: 'Plafond de lignes', valeur: String(r.maxLignes), ok: r.maxLignes > 0 && r.maxLignes <= 1000 },
    { libelle: 'Source', valeur: r.source, ok: estIdentifiant(r.source) && String(r.source).startsWith('v_') },
    { libelle: 'Écritures', valeur: 'refusées', ok: true },
  ];
}
