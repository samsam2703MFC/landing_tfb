/**
 * L'import d'une feuille de style client.
 *
 * Le fichier est **lu**, pas servi. On y cherche les variables qui décrivent
 * une marque — couleurs, arrondi, ombre — et on les reporte dans la charte.
 * Rien de son contenu n'atteint une balise `<style>`.
 *
 * POURQUOI PAS SERVIR LE FICHIER TEL QUEL. Ce serait plus court et c'est un
 * mauvais échange : le CSS n'est pas inerte. `background-image: url(...)` dans
 * un sélecteur d'attribut exfiltre ce qu'un utilisateur tape, caractère par
 * caractère ; une règle `content` réécrit ce qu'un client lit à l'écran sans
 * rien changer aux données. Un fichier fourni par un tiers et servi sous notre
 * domaine hérite de nos droits.
 *
 * Ce que l'import donne en échange : la charte est reprise en trente secondes
 * au lieu d'être ressaisie, et elle reste un jeu de valeurs contrôlées. Ce qui
 * n'a pas pu être repris est **affiché**, pas ignoré en silence — sans quoi on
 * croirait la charte complète alors qu'il manque la moitié.
 */

import { REGISTRE, controler } from './registre.mjs';

/**
 * Les noms de variables qu'on reconnaît, par clé du registre.
 *
 * Plusieurs conventions coexistent dans la nature : celle de ce design system,
 * celles de Tailwind, de Bootstrap, et le français de quelques agences. Les
 * lister toutes coûte une ligne chacune et évite un import qui ne trouve rien.
 */
const CORRESPONDANCES = {
  'theme.primaire': ['brand', 'primary', 'color-primary', 'couleur-primaire', 'primaire', 'brand-500', 'bs-primary'],
  'theme.accent': ['accent', 'cta-warm', 'color-accent', 'couleur-accent', 'secondary', 'bs-secondary'],
  'theme.fond_page': ['surface-page', 'background', 'bg', 'body-bg', 'fond', 'fond-page', 'bs-body-bg'],
  'theme.fond_carte': ['surface-card', 'card', 'card-bg', 'fond-carte', 'surface'],
  'theme.texte': ['text-primary', 'text', 'color-text', 'body-color', 'texte', 'foreground', 'bs-body-color'],
  'theme.texte_doux': ['text-secondary', 'muted', 'text-muted', 'texte-doux', 'secondary-text'],
  'theme.bordure': ['border-default', 'border', 'border-color', 'bordure', 'bs-border-color'],
  'etat.succes': ['status-success', 'success', 'green', 'succes', 'bs-success'],
  'etat.alerte': ['status-warning', 'warning', 'orange', 'alerte', 'bs-warning'],
  'etat.erreur': ['status-danger', 'danger', 'error', 'red', 'erreur', 'bs-danger'],
  'etat.info': ['status-info', 'info', 'blue', 'bs-info'],
  'theme.arrondi': ['radius-card', 'radius', 'border-radius', 'rounded', 'arrondi', 'bs-border-radius'],
};

/** Les arrondis que le registre déclare — on prend le plus proche. */
const ARRONDIS = [4, 8, 12, 16];

const HEXA6 = /^#[0-9a-f]{6}$/i;
const HEXA3 = /^#[0-9a-f]{3}$/i;

/**
 * Une couleur CSS ramenée à #RRGGBB, ou `null`.
 *
 * Trois écritures couvrent ce qu'on rencontre vraiment dans une charte livrée :
 * l'hexadécimal court, le long, et `rgb()`. Le reste — `hsl()`, `color-mix()`,
 * les noms — est laissé de côté et signalé, plutôt que converti de travers.
 */
export function couleurNormalisee(brut) {
  const v = String(brut || '').trim().toLowerCase().replace(/\s*!important$/, '');
  if (HEXA6.test(v)) return v;
  if (HEXA3.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  const rgb = /^rgba?\(\s*([0-9]{1,3})[\s,]+([0-9]{1,3})[\s,]+([0-9]{1,3})/.exec(v);
  if (rgb) {
    const canal = (n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
    return `#${canal(rgb[1])}${canal(rgb[2])}${canal(rgb[3])}`;
  }
  return null;
}

/**
 * Un arrondi en pixels ramené à la valeur déclarée la plus proche.
 *
 * À égalité — 14 px est à deux pixels de 12 comme de 16 — on prend la **plus
 * petite**. Ce n'est pas indifférent : l'écart se voit surtout sur les petits
 * éléments, et arrondir vers le haut donne des boutons plus ronds que la charte
 * d'origine. La règle est écrite ici plutôt que laissée à l'ordre du tableau.
 */
export function arrondiNormalise(brut) {
  const px = /^([0-9]+(?:\.[0-9]+)?)\s*(px|rem|em)?$/.exec(String(brut || '').trim());
  if (!px) return null;
  const valeur = Number(px[1]) * (px[2] === 'rem' || px[2] === 'em' ? 16 : 1);
  if (!Number.isFinite(valeur)) return null;
  const proche = ARRONDIS.reduce((a, b) => (Math.abs(b - valeur) < Math.abs(a - valeur) ? b : a));
  return String(proche);
}

/**
 * Les propriétés personnalisées d'une feuille, sans la parser complètement.
 *
 * On ne cherche que `--nom: valeur;`. Un vrai analyseur CSS serait plus juste
 * et n'apporterait rien ici : ce qui nous intéresse est déclaratif par nature,
 * et tout ce qu'on ne comprend pas doit de toute façon finir dans la liste de
 * ce qui n'a pas été repris.
 */
export function variablesCss(texte) {
  const trouvees = new Map();
  // Les commentaires d'abord : une variable commentée n'est pas une variable.
  const propre = String(texte || '').replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (const m of propre.matchAll(/--([A-Za-z0-9_-]+)\s*:\s*([^;{}]+)[;}]/g)) {
    // La dernière écrite l'emporte, comme dans une cascade.
    trouvees.set(m[1].toLowerCase(), m[2].trim());
  }
  return trouvees;
}

/**
 * Lit une feuille et rend ce qu'on en tire.
 *
 * @returns {{valeurs: Object, repris: Array, ignores: Array}}
 *   `repris` dit d'où vient chaque valeur — sans quoi on ne saurait pas
 *   pourquoi la primaire a changé. `ignores` liste ce qui a été vu et laissé.
 */
export function lireFeuille(texte) {
  const variables = variablesCss(texte);
  const valeurs = {};
  const repris = [];
  const utilisees = new Set();

  for (const [cle, noms] of Object.entries(CORRESPONDANCES)) {
    const variable = REGISTRE.find((v) => v.cle === cle);
    for (const nom of noms) {
      if (!variables.has(nom)) continue;
      const brut = variables.get(nom);
      const valeur = variable.type === 'liste' && cle === 'theme.arrondi'
        ? arrondiNormalise(brut)
        : couleurNormalisee(brut);
      if (valeur === null) continue;
      // Le contrôle du registre a le dernier mot : une valeur importée passe
      // exactement par où passe une valeur saisie à la main.
      if (controler(cle, valeur)) continue;
      valeurs[cle] = valeur;
      repris.push({ cle, libelle: variable.libelle, depuis: `--${nom}`, brut, valeur });
      utilisees.add(nom);
      break; // le premier nom reconnu gagne, dans l'ordre de la liste
    }
  }

  const ignores = [...variables.entries()]
    .filter(([nom]) => !utilisees.has(nom))
    .map(([nom, valeur]) => ({ nom: `--${nom}`, valeur: valeur.slice(0, 60) }))
    .slice(0, 200);

  return { valeurs, repris, ignores };
}

/** Le nombre de règles de la feuille, pour dire ce qu'on n'a pas lu. */
export function tailleFeuille(texte) {
  const propre = String(texte || '').replace(/\/\*[\s\S]*?\*\//g, ' ');
  return {
    octets: Buffer.byteLength(String(texte || '')),
    blocs: (propre.match(/\{/g) || []).length,
    // Signalé à part : ces deux-là feraient charger quelque chose depuis un
    // hôte que personne n'a vérifié, et ne sont donc jamais repris.
    imports: (propre.match(/@import\b/g) || []).length,
    fontFaces: (propre.match(/@font-face\b/g) || []).length,
  };
}
