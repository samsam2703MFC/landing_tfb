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

/**
 * Les lignes d'une section, chacune avec ce qu'elle est.
 *
 * Le corps d'une fiche n'est pas de la prose continue : il mêle des questions
 * numérotées, la précision qui suit chacune derrière une flèche, une réplique
 * entre guillemets, et des phrases ordinaires. Rendu en bloc préformaté,
 * tout cela a la même voix — or c'est justement la hiérarchie qu'on cherche
 * du regard pendant qu'on tient un téléphone.
 *
 * Quatre formes reconnues, et une cinquième qui ramasse le reste : un guide
 * réécrit librement reste lisible, en paragraphes.
 */
export function lignesDeSection(corps) {
  const sortie = [];
  let paragraphe = [];

  const viderParagraphe = () => {
    if (paragraphe.length > 0) {
      sortie.push({ type: 'paragraphe', texte: paragraphe.join(' ') });
      paragraphe = [];
    }
  };

  for (const brute of String(corps || '').split(/\r?\n/)) {
    const l = brute.trim();
    // Une ligne vide referme tout, y compris une réplique dont personne n'a
    // écrit le guillemet fermant : sans cela elle avalerait la suite.
    if (!l) {
      viderParagraphe();
      const ouvert = sortie[sortie.length - 1];
      if (ouvert && ouvert.ouverte) ouvert.ouverte = false;
      continue;
    }

    // « 1. Combien de points de vente ? »
    const numerotee = l.match(/^(\d+)\.\s+(.*)$/);
    if (numerotee) {
      viderParagraphe();
      sortie.push({ type: 'question', rang: Number(numerotee[1]), texte: numerotee[2] });
      continue;
    }

    // « → C'est le nombre qui chiffre l'offre. » — la précision qui suit.
    const flechee = l.match(/^[→>]\s*(.*)$/);
    if (flechee) {
      viderParagraphe();
      sortie.push({ type: 'note', texte: flechee[1] });
      continue;
    }

    const dernier = sortie[sortie.length - 1];

    // Une réplique : ce qu'on dit au téléphone, mot pour mot. Elle court
    // jusqu'au guillemet fermant, quelle que soit l'indentation de ses lignes
    // suivantes — une citation coupée en deux au milieu d'une phrase se lit
    // comme si le commercial avait été interrompu.
    if (l.startsWith('«')) {
      viderParagraphe();
      sortie.push({ type: 'citation', texte: l, ouverte: !l.endsWith('»') });
      continue;
    }
    if (dernier && dernier.type === 'citation' && dernier.ouverte && paragraphe.length === 0) {
      dernier.texte = `${dernier.texte} ${l}`;
      if (l.endsWith('»')) dernier.ouverte = false;
      continue;
    }

    // La suite d'une note ou d'une question, indentée sous elle.
    if (paragraphe.length === 0 && /^\s{2,}/.test(brute) && dernier
        && (dernier.type === 'note' || dernier.type === 'question')) {
      dernier.texte = `${dernier.texte} ${l}`;
      continue;
    }

    paragraphe.push(l);
  }
  viderParagraphe();
  return sortie.map(({ ouverte, ...ligne }) => ligne);
}
