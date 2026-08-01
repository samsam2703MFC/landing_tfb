/**
 * Ce qui se traduit, table par table et colonne par colonne.
 *
 * Cette liste est la source de vérité du chantier de traduction : le script
 * `traduire.mjs` s'en sert pour savoir quoi envoyer au modèle, et la console
 * pour savoir quoi présenter au relecteur. Les deux doivent dire la même
 * chose — `apps/web/tests/traduisible.test.mjs` le vérifie, sans quoi un
 * champ traduit automatiquement resterait invisible dans la console, ou
 * l'inverse.
 *
 * `contexte` n'est pas décoratif : « Fait disparaître » traduit sans contexte
 * devient un verbe à l'infinitif au lieu d'un titre de colonne.
 */

export const ENTITES = [
  {
    cle: 'site',
    nom: "Page d'accueil",
    table: 'site',
    ordre: 'id',
    libelle: () => "Page d'accueil",
    champs: [
      { nom: 'titre', libelle: 'Titre principal', contexte: 'titre principal de la page d’accueil' },
      { nom: 'sous_titre', libelle: 'Sous-titre' },
      { nom: 'accroche', libelle: 'Accroche', contexte: 'deux paragraphes, sauts de ligne à conserver' },
      { nom: 'cta_texte', libelle: 'Libellé du bouton', contexte: 'texte d’un bouton, très court' },
      { nom: 'meta_description', libelle: 'Description pour les moteurs', contexte: '200 caractères au plus' },
      { nom: 'problemes', libelle: 'Les problèmes', json: true },
      { nom: 'reponses', libelle: 'Les réponses', json: true },
    ],
  },
  {
    cle: 'textes',
    nom: 'Textes éditoriaux',
    table: 'textes',
    ordre: 'ordre, cle',
    libelle: (l) => l.cle,
    champs: [{ nom: 'valeur', libelle: 'Texte affiché', contexte: 'libellé d’interface, souvent très court' }],
  },
  {
    cle: 'modules',
    nom: 'Fiches de module',
    table: 'modules',
    ordre: 'ordre, slug',
    libelle: (l) => l.slug,
    champs: [
      { nom: 'nom', libelle: 'Nom', contexte: 'nom commercial du module — à garder tel quel s’il est déjà anglais' },
      { nom: 'accroche', libelle: 'Accroche', contexte: 'une phrase, 15 mots au plus' },
      { nom: 'resume', libelle: 'Résumé' },
      { nom: 'public_cible', libelle: 'Public visé' },
      { nom: 'onboarding', libelle: 'Phrase d’onboarding' },
      { nom: 'description', libelle: 'Description longue', contexte: 'markdown, structure à conserver' },
      { nom: 'problemes', libelle: 'Les problèmes', json: true },
      { nom: 'benefices', libelle: 'Les bénéfices', json: true },
    ],
  },
  {
    cle: 'fonctions',
    nom: 'Composants',
    table: 'fonctions',
    ordre: 'module_id, ordre',
    libelle: (l) => l.cle,
    champs: [
      { nom: 'nom', libelle: 'Nom', contexte: 'entrée de menu, très court' },
      { nom: 'description', libelle: 'Description' },
      { nom: 'benefice', libelle: 'Bénéfice', contexte: 'ce que la personne cesse de faire à la main' },
    ],
  },
  {
    cle: 'questions',
    nom: 'Questionnaire',
    table: 'questions',
    ordre: 'ordre, id',
    libelle: (l) => l.cle,
    champs: [
      { nom: 'tag', libelle: 'Étiquette', contexte: 'un seul mot : Problème ou Besoin' },
      { nom: 'texte', libelle: 'La question', contexte: 'question fermée, se termine par un point d’interrogation' },
      { nom: 'cible', libelle: 'Ce qu’elle vise', contexte: 'nom du module visé' },
    ],
  },
  {
    cle: 'tarifs',
    nom: 'Mentions et courriel',
    table: 'tarifs',
    ordre: 'ordre, cle',
    libelle: (l) => l.libelle || l.cle,
    // Seules les lignes de type `texte` ont du contenu à traduire : un prix
    // ou un multiplicateur est le même dans toutes les langues.
    filtre: (l) => l.type === 'texte',
    champs: [
      { nom: 'valeur', libelle: 'Texte', contexte: 'gabarit — les jetons entre accolades restent tels quels' },
    ],
  },
  {
    cle: 'prestations',
    nom: 'Prestations vendues',
    table: 'prestations',
    ordre: 'ordre, nom',
    libelle: (l) => l.cle,
    champs: [
      { nom: 'nom', libelle: 'Nom', contexte: "intitulé qui figure sur l'offre" },
      { nom: 'description', libelle: 'Description' },
    ],
  },
  {
    cle: 'captures',
    nom: "Titres d'écran",
    table: 'captures',
    ordre: 'module_id, ordre',
    libelle: (l) => l.fichier,
    champs: [{ nom: 'titre', libelle: 'Titre affiché sous la capture' }],
  },
];

/** L'entité par sa clé, ou la première. */
export function entiteTraduisible(cle) {
  return ENTITES.find((e) => e.cle === cle) || ENTITES[0];
}

/** Le nombre de champs traduisibles, toutes entités confondues. */
export function nombreDeChamps() {
  return ENTITES.reduce((n, e) => n + e.champs.length, 0);
}
