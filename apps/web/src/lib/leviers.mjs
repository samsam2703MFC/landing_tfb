/**
 * Les 6 leviers de gestion, avec leur identité visuelle.
 *
 * Les couleurs viennent de la maquette : chaque levier garde la sienne
 * partout — carte de module, entrée de menu, fiche — et c'est la **lettre**
 * qui fait l'identité, la couleur ne fait que la renforcer. Deux leviers
 * portent une encre sombre parce que leur fond est clair (contraste AA).
 *
 * `question` dit ce que le levier mesure, `pourquoi` dit pourquoi il existe :
 * la première tient sur une pastille, la seconde s'imprime en annexe d'offre,
 * là où le client découvre le modèle et non l'outil.
 *
 * Chaque couleur porte sa valeur littérale en repli — `var(--plum-500,
 * #7b4488)`. Sans ce repli, une page qui ne charge pas les jetons du design
 * system, comme l'annexe imprimable d'une offre, affiche six pastilles
 * transparentes : le code couleur disparaît et la légende ne renvoie à rien.
 *
 * Ce fichier est la seule source : la page d'accueil, les fiches, l'onboarding
 * et la console lisent tous ces six entrées.
 */

export const LEVIERS = [
  {
    cle: 'trafic',
    lettre: 'T',
    nom: 'Trafic',
    question: 'Combien de clients entrent ?',
    pourquoi:
      "Sans clients qui poussent la porte, rien d'autre ne compte. C'est le seul levier qui se joue avant la vente, et le seul qu'un réseau peut actionner pour tous ses points de vente à la fois.",
    fond: 'var(--ember-500, #f0912a)',
    encre: 'var(--navy-900, #0c1329)',
  },
  {
    cle: 'recurrence',
    lettre: 'R',
    nom: 'Récurrence',
    question: 'Combien reviennent ?',
    pourquoi:
      "Un client qui revient coûte moins cher qu'un client à conquérir. C'est le levier qui transforme un bon mois en une rente, et celui qu'on oublie parce qu'il ne se voit pas dans le chiffre du jour.",
    fond: 'var(--teal-700, #0c6a66)',
    encre: '#fff',
  },
  {
    cle: 'xp',
    lettre: 'E',
    nom: 'Expérience',
    question: 'Que vivent-ils sur place ?',
    pourquoi:
      "Ce qui se passe entre la porte et l'addition décide du retour. C'est le levier que le franchisé tient seul, et celui que le réseau ne peut que rendre possible — jamais imposer.",
    fond: 'var(--plum-500, #7b4488)',
    encre: '#fff',
  },
  {
    cle: 'food',
    lettre: 'F',
    nom: 'Food Cost',
    question: 'Que coûte ce qu’on sert ?',
    pourquoi:
      "La matière est le premier poste de coût variable, et le plus sensible : un gramme de dérive par portion se compte en dizaines de milliers d'euros à l'échelle d'un réseau.",
    fond: 'var(--red-500, #c0304a)',
    encre: '#fff',
  },
  {
    cle: 'labour',
    lettre: 'L',
    nom: 'Labour',
    question: 'Que coûtent les heures ?',
    pourquoi:
      "Les heures sont le second poste variable, et le seul qui se pilote au quart d'heure. Trop peu, l'expérience tombe ; trop, la marge part — c'est un arbitrage, pas une économie.",
    fond: 'var(--blue-500, #2a5fd0)',
    encre: '#fff',
  },
  {
    cle: 'overhead',
    lettre: 'O',
    nom: 'Overhead',
    question: 'Que coûte la structure ?',
    pourquoi:
      "Loyers, licences, siège : ce qui ne bouge pas avec le chiffre. C'est le levier le plus lent à corriger, donc celui qu'il faut décider juste au départ.",
    fond: 'var(--slate-700, #3f4558)',
    encre: '#fff',
  },
];

/** Un levier par sa clé, ou `null` si la clé est inconnue. */
export function levier(cle) {
  return LEVIERS.find((l) => l.cle === cle) || null;
}

/** Les leviers d'une liste de clés, dans l'ordre canonique, sans les inconnues. */
export function leviersDe(cles) {
  const voulus = new Set(cles || []);
  return LEVIERS.filter((l) => voulus.has(l.cle));
}

/** Le titre au survol d'une pastille : « Trafic — Combien de clients entrent ? ». */
export function titreLevier(l) {
  return `${l.nom} — ${l.question}`;
}
