/**
 * Le découpage d'un guide en sections.
 *
 * Le guide d'appel est du texte libre, écrit dans la console par l'équipe. Un
 * seul bloc de quarante lignes ne se lit pas au moment où l'on décroche : on
 * le découpe sur ses titres pour en faire des fiches qu'on parcourt du regard.
 *
 * Un titre est une ligne en capitales. C'est la convention du texte semé, et
 * elle a l'avantage de rester lisible si personne ne la connaît : quelqu'un
 * qui réécrit le guide sans titres obtient une seule fiche, pas une page
 * cassée.
 */

/**
 * Vrai si la ligne se lit comme un titre : en capitales, courte, et sans
 * ponctuation de phrase. « CE QU'ON NE FAIT PAS AU PREMIER APPEL » en est un ;
 * « Lire sa demande : le nom du réseau. » non.
 */
function estUnTitre(ligne) {
  const l = ligne.trim();
  if (l.length < 4 || l.length > 80) return false;
  if (/[.?!:]$/.test(l)) return false;
  // « AVANT DE DÉCROCHER — deux minutes » est un titre : la précision qui
  // suit le tiret cadratin s'écrit en minuscules, et se lit mieux ainsi qu'en
  // capitales hurlantes. On juge donc ce qui précède le tiret.
  const tete = l.split(/\s+—\s+/)[0];
  const lettres = tete.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (lettres.length < 3) return false;
  return lettres === lettres.toUpperCase();
}

/**
 * Découpe le guide en `{ titre, corps }`.
 *
 * Ce qui précède le premier titre garde un titre vide : un guide qui commence
 * par une phrase ne doit pas la perdre.
 */
export function sectionsDuGuide(texte) {
  const lignes = String(texte || '').split(/\r?\n/);
  const sections = [];
  let courante = null;

  for (const ligne of lignes) {
    if (estUnTitre(ligne)) {
      if (courante) sections.push(courante);
      courante = { titre: ligne.trim(), corps: [] };
      continue;
    }
    if (!courante) courante = { titre: '', corps: [] };
    courante.corps.push(ligne);
  }
  if (courante) sections.push(courante);

  return sections
    .map((s) => ({ titre: s.titre, corps: s.corps.join('\n').replace(/^\n+|\n+$/g, '') }))
    // Une section sans titre ni corps est un reliquat de lignes vides.
    .filter((s) => s.titre || s.corps.trim());
}
