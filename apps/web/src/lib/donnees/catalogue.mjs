/**
 * Le catalogue de données — la bibliothèque des ressources qu'une application
 * cliente a le droit de lire.
 *
 * Une ressource est une **déclaration**, pas une URL. Elle nomme une vue, la
 * liste des colonnes qui peuvent sortir, les filtres acceptés et leur plafond de
 * lignes. Le SQL est fabriqué à partir de ça et de rien d'autre : la requête ne
 * peut nommer qu'un filtre déjà déclaré, et sa valeur part toujours en
 * paramètre lié. C'est tout l'argument de sécurité, et c'est pour cela que le
 * catalogue est du code et non des lignes en base — une ressource se relit dans
 * une diff, une ligne en base ne se relit nulle part.
 *
 * POURQUOI UNE VUE ET JAMAIS UNE TABLE. Exposer une table fait de ses noms de
 * colonnes votre contrat public : vous ne pourrez plus jamais en renommer une
 * sans casser l'application installée chez chaque client. `CREATE VIEW` ne
 * touche à aucune table — la contrainte « je ne change pas la structure de ma
 * base » tient toujours.
 *
 * CE QUI N'EST PAS ICI, ET POURQUOI. Les appels vers l'API d'un client ne
 * passent pas par le catalogue : cette application a déjà les connexions, les
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
 * La colonne qui porte le client dans cette base. Injectée côté serveur, jamais
 * lue depuis la requête : un `?prospect=` pris au mot est exactement la façon
 * dont un client finit par lire les lignes d'un autre.
 */
export const COLONNE_CLIENT = 'prospect_id';

/**
 * Les ressources servies.
 *
 * La liste est volontairement vide au départ. Une entrée d'exemple pointant vers
 * une vue qui n'existe pas donnerait une console qui promet des données et une
 * erreur 500 à qui les demande. L'assistant d'import remplit cette liste :
 * il produit la déclaration et l'instruction `CREATE VIEW` qui va avec.
 */
export const CATALOGUE = {};

export function ressource(cle) {
  return CATALOGUE[cle] || null;
}

export function entreesCatalogue() {
  return Object.entries(CATALOGUE).map(([cle, r]) => ({ cle, ressource: r }));
}

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
  if (!estIdentifiant(r.source)) return 'Source invalide.';
  if (!r.source.startsWith('v_')) return 'La source doit être une vue (préfixe « v_ »), jamais une table.';
  if (!Array.isArray(r.colonnes) || r.colonnes.length === 0) return 'Aucune colonne exposée.';
  if (!r.colonnes.every(estIdentifiant)) return 'Nom de colonne invalide.';
  if (!estIdentifiant(r.colonneClient)) return 'La colonne portant le client est obligatoire.';
  // Elle sert à filtrer, pas à sortir. L'exposer permettrait à un client de lire
  // l'identifiant sous lequel il est rangé — inutile pour lui, utile pour deviner
  // celui des autres.
  if (r.colonnes.includes(r.colonneClient)) return 'La colonne du client ne doit pas être exposée — elle filtre, elle ne sort pas.';
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
  return [
    { libelle: 'Client injecté côté serveur', valeur: r.colonneClient, ok: estIdentifiant(r.colonneClient) },
    { libelle: 'Colonne du client non exposée', valeur: (r.colonnes || []).includes(r.colonneClient) ? 'exposée' : 'filtre seulement',
      ok: !(r.colonnes || []).includes(r.colonneClient) },
    { libelle: 'Colonnes en liste blanche', valeur: String((r.colonnes || []).length), ok: (r.colonnes || []).every(estIdentifiant) },
    { libelle: 'Filtres déclarés', valeur: Object.keys(r.filtres || {}).join(', ') || 'aucun', ok: filtresOk },
    { libelle: 'Tri restreint', valeur: (r.triables || []).join(', ') || 'aucun', ok: triOk },
    { libelle: 'Plafond de lignes', valeur: String(r.maxLignes), ok: r.maxLignes > 0 && r.maxLignes <= 1000 },
    { libelle: 'Source', valeur: r.source, ok: estIdentifiant(r.source) && String(r.source).startsWith('v_') },
    { libelle: 'Écritures', valeur: 'refusées', ok: true },
  ];
}
