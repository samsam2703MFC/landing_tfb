/**
 * Les 6 leviers de gestion, avec leur identité visuelle.
 *
 * Les couleurs viennent de la maquette : chaque levier garde la sienne
 * partout — carte de module, entrée de menu, fiche — et c'est la **lettre**
 * qui fait l'identité, la couleur ne fait que la renforcer. Deux leviers
 * portent une encre sombre parce que leur fond est clair (contraste AA).
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
    fond: 'var(--ember-500)',
    encre: 'var(--navy-900)',
  },
  {
    cle: 'recurrence',
    lettre: 'R',
    nom: 'Récurrence',
    question: 'Combien reviennent ?',
    fond: 'var(--teal-700)',
    encre: '#fff',
  },
  {
    cle: 'xp',
    lettre: 'E',
    nom: 'Expérience',
    question: 'Que vivent-ils sur place ?',
    fond: 'var(--plum-500)',
    encre: '#fff',
  },
  {
    cle: 'food',
    lettre: 'F',
    nom: 'Food Cost',
    question: 'Que coûte ce qu’on sert ?',
    fond: 'var(--red-500)',
    encre: '#fff',
  },
  {
    cle: 'labour',
    lettre: 'L',
    nom: 'Labour',
    question: 'Que coûtent les heures ?',
    fond: 'var(--blue-500)',
    encre: '#fff',
  },
  {
    cle: 'overhead',
    lettre: 'O',
    nom: 'Overhead',
    question: 'Que coûte la structure ?',
    fond: 'var(--slate-700)',
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
