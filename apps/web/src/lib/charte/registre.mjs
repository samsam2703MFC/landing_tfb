/**
 * Le registre des variables de charte — la seule chose codée en dur.
 *
 * La console ne connaît aucune variable en particulier : elle lit ce registre et
 * fabrique son formulaire. Ajouter une variable, c'est une entrée ici, et zéro
 * ligne d'écran.
 *
 * Une variable paramètre un comportement existant. Elle n'en crée pas : le jour
 * où l'on veut y mettre une condition, c'est du code qu'il faut, pas une ligne
 * de plus en base.
 */

/** Les deux encres qu'on peut poser sur un aplat. */
export const ENCRES = { blanc: '#ffffff', fonce: '#12211f' };

/** Les familles réellement chargées par le site. Un champ libre ici ferait
 *  télécharger une police depuis un hôte que personne n'a vérifié. */
const POLICES = [
  { valeur: 'manrope', libelle: 'Manrope — titres' },
  { valeur: 'plex-sans', libelle: 'IBM Plex Sans — interface' },
  { valeur: 'systeme', libelle: 'Système — aucun téléchargement' },
  // « Les polices importées » plutôt qu'un nom de famille : le registre est
  // statique, et il ne peut pas connaître ce qu'un client déposera demain. La
  // famille est résolue au moment de fabriquer la feuille, avec un repli si
  // rien n'a été importé.
  { valeur: 'client', libelle: 'Les polices importées du client' },
];

export const REGISTRE = [
  { cle: 'theme.primaire', libelle: 'Couleur primaire', type: 'couleur', defaut: '#7b4488',
    aide: 'Appliquée en variable CSS — aucun style n’est compilé par client.' },
  { cle: 'theme.encre_primaire', libelle: 'Encre sur la primaire', type: 'liste', defaut: 'blanc',
    options: [{ valeur: 'blanc', libelle: 'Blanc' }, { valeur: 'fonce', libelle: 'Encre foncée' }],
    aide: 'Le contraste du couple est vérifié à la publication, pas à l’œil.' },
  { cle: 'theme.accent', libelle: 'Couleur d’accent', type: 'couleur', defaut: '#f0912a',
    aide: 'La couleur de conversion. Distincte de la primaire, qui structure l’écran.' },
  { cle: 'theme.encre_accent', libelle: 'Encre sur l’accent', type: 'liste', defaut: 'fonce',
    options: [{ valeur: 'blanc', libelle: 'Blanc' }, { valeur: 'fonce', libelle: 'Encre foncée' }] },
  { cle: 'theme.fond_page', libelle: 'Fond de page', type: 'couleur', defaut: '#f5f6f9' },
  { cle: 'theme.fond_carte', libelle: 'Fond des cartes', type: 'couleur', defaut: '#ffffff' },
  { cle: 'theme.texte', libelle: 'Texte principal', type: 'couleur', defaut: '#0c1329' },
  { cle: 'theme.texte_doux', libelle: 'Texte secondaire', type: 'couleur', defaut: '#565d73' },
  { cle: 'theme.bordure', libelle: 'Bordures', type: 'couleur', defaut: '#dddfe8' },
  { cle: 'theme.police_titres', libelle: 'Police des titres', type: 'liste', defaut: 'manrope', options: POLICES },
  { cle: 'theme.police_interface', libelle: 'Police de l’interface', type: 'liste', defaut: 'plex-sans', options: POLICES },
  { cle: 'theme.arrondi', libelle: 'Arrondi des cartes', type: 'liste', defaut: '12', options: [
    { valeur: '4', libelle: 'Net — 4 px' }, { valeur: '8', libelle: 'Modéré — 8 px' },
    { valeur: '12', libelle: 'Doux — 12 px' }, { valeur: '16', libelle: 'Très doux — 16 px' }] },
  { cle: 'theme.profondeur', libelle: 'Profondeur', type: 'liste', defaut: 'douce', options: [
    { valeur: 'aucune', libelle: 'Aucune — à plat' }, { valeur: 'douce', libelle: 'Douce' },
    { valeur: 'marquee', libelle: 'Marquée' }] },
  { cle: 'theme.densite', libelle: 'Densité', type: 'liste', defaut: 'normale', options: [
    { valeur: 'compacte', libelle: 'Compacte — terrain' }, { valeur: 'normale', libelle: 'Normale' },
    { valeur: 'confortable', libelle: 'Confortable — tablette' }],
    aide: 'Met l’échelle d’espacement à l’échelle. Une caisse tactile n’a pas les cibles d’un bureau.' },
  { cle: 'theme.logo', libelle: 'Logo de l’enseigne', type: 'fichier', defaut: null },
  { cle: 'etat.succes', libelle: 'Succès', type: 'couleur', defaut: '#157f5a' },
  { cle: 'etat.alerte', libelle: 'Avertissement', type: 'couleur', defaut: '#b77500' },
  { cle: 'etat.erreur', libelle: 'Erreur', type: 'couleur', defaut: '#c0304a' },
  { cle: 'etat.info', libelle: 'Information', type: 'couleur', defaut: '#2a5fd0' },
  { cle: 'app.nom', libelle: 'Nom affiché de l’application', type: 'texte', defaut: 'The Franchise Buddy', max: 60 },
  { cle: 'app.support', libelle: 'E-mail de support affiché', type: 'texte', defaut: 'support@franchisebuddy.eu', max: 150 },
];

const PAR_CLE = new Map(REGISTRE.map((v) => [v.cle, v]));

export function variable(cle) {
  return PAR_CLE.get(cle) || null;
}

/** Le groupe d'une variable : le premier segment de sa clé. */
export function groupe(cle) {
  return String(cle).split('.')[0] || '';
}

export function groupes() {
  const paquets = new Map();
  for (const v of REGISTRE) {
    const g = groupe(v.cle);
    if (paquets.has(g)) paquets.get(g).push(v);
    else paquets.set(g, [v]);
  }
  return [...paquets.entries()].map(([nom, variables]) => ({ nom, variables }));
}

/** Tous les défauts déclarés — le socle de la résolution. */
export function defauts() {
  const sortie = {};
  for (const v of REGISTRE) sortie[v.cle] = v.defaut;
  return sortie;
}

const HEXA = /^#[0-9a-fA-F]{6}$/;

/**
 * Contrôle d'une valeur contre sa déclaration. Il a lieu à l'écriture, dans la
 * console — jamais à la lecture. Une couleur invalide doit être refusée devant
 * celui qui la saisit, pas découverte par le client sur son écran.
 */
export function controler(cle, valeur) {
  const v = variable(cle);
  if (!v) return `Variable absente du registre : ${cle}.`;
  if (valeur === null || valeur === undefined) {
    return v.type === 'fichier' ? null : 'Valeur vide — retirez la surcharge pour hériter.';
  }

  switch (v.type) {
    case 'couleur':
      // Forme seulement : la lisibilité est une propriété de couple, contrôlée
      // par controlerCharte() une fois l'ensemble résolu.
      return HEXA.test(String(valeur)) ? null : 'Attendu : #RRGGBB.';
    case 'texte': {
      const s = String(valeur);
      if (v.max && s.length > v.max) return `${s.length} caractères — maximum ${v.max}.`;
      return null;
    }
    case 'liste':
      return v.options.some((o) => o.valeur === valeur) ? null : 'Valeur hors de la liste déclarée.';
    case 'fichier':
      // Uniquement ce que le site sert lui-même : une URL absolue ici ferait
      // pointer le logo d'un client vers l'hôte de quelqu'un d'autre.
      return String(valeur).startsWith('/') && !String(valeur).includes('..')
        ? null : 'Attendu : un chemin servi par le site.';
    default:
      return `Type inconnu : ${v.type}.`;
  }
}

/** Luminance relative WCAG 2.1. */
function luminance(hexa) {
  const canal = (paire) => {
    const c = parseInt(paire, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(hexa.slice(1, 3)) + 0.7152 * canal(hexa.slice(3, 5)) + 0.0722 * canal(hexa.slice(5, 7));
}

/** Rapport de contraste entre deux couleurs #RRGGBB. */
export function contraste(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function hexa(valeurs, cle, repli) {
  const v = valeurs[cle];
  return typeof v === 'string' && HEXA.test(v) ? v : repli;
}

/**
 * Les contrôles qui portent sur des couples : une couleur n'est pas lisible
 * toute seule.
 *
 * Indicatifs pendant l'édition — il faut pouvoir poser une primaire claire
 * *puis* changer son encre — et bloquants à la publication, dernier moment où
 * refuser ne coûte rien.
 */
export function controlerCharte(valeurs) {
  const resolu = { ...defauts(), ...valeurs };
  const erreurs = {};

  const couples = [
    { cle: 'theme.primaire', avant: ENCRES[resolu['theme.encre_primaire'] === 'fonce' ? 'fonce' : 'blanc'],
      arriere: hexa(resolu, 'theme.primaire', '#7b4488'), quoi: 'l’encre choisie sur la primaire', min: 4.5 },
    { cle: 'theme.accent', avant: ENCRES[resolu['theme.encre_accent'] === 'fonce' ? 'fonce' : 'blanc'],
      arriere: hexa(resolu, 'theme.accent', '#f0912a'), quoi: 'l’encre choisie sur l’accent', min: 4.5 },
    { cle: 'theme.texte', avant: hexa(resolu, 'theme.texte', '#0c1329'),
      arriere: hexa(resolu, 'theme.fond_carte', '#ffffff'), quoi: 'le texte principal sur les cartes', min: 4.5 },
    // Le texte secondaire ne porte jamais seul une information : AA large suffit.
    { cle: 'theme.texte_doux', avant: hexa(resolu, 'theme.texte_doux', '#565d73'),
      arriere: hexa(resolu, 'theme.fond_carte', '#ffffff'), quoi: 'le texte secondaire sur les cartes', min: 3 },
  ];

  for (const c of couples) {
    const r = contraste(c.avant, c.arriere);
    if (r < c.min) erreurs[c.cle] = `Contraste ${r.toFixed(1)}:1 pour ${c.quoi} — sous ${c.min}:1.`;
  }
  return erreurs;
}

/**
 * Résolution d'une clé : surcharge du client, puis défaut maison, puis registre.
 * Une entrée absente vaut héritage — jamais une valeur vide.
 */
export function resoudre(cle, client = {}, maison = {}) {
  const socle = defauts();
  const chaine = [
    { couche: 'client', valeur: cle in client ? client[cle] : null },
    { couche: 'maison', valeur: cle in maison ? maison[cle] : null },
    { couche: 'registre', valeur: cle in socle ? socle[cle] : null },
  ];
  if (cle in client) return { cle, valeur: client[cle], depuis: 'client', chaine };
  if (cle in maison) return { cle, valeur: maison[cle], depuis: 'maison', chaine };
  return { cle, valeur: socle[cle] ?? null, depuis: 'registre', chaine };
}

export function resoudreTout(client = {}, maison = {}) {
  return REGISTRE.map((v) => resoudre(v.cle, client, maison));
}

/** Le jeu complet, aplati — ce que consomme le générateur de CSS. */
export function valeursResolues(client = {}, maison = {}, marque = {}) {
  // Du plus général au plus précis : les défauts du registre, la maison,
  // l'enseigne, puis le client. Une marque habille tous ses clients — un
  // réseau de franchise a une identité, pas trente — et un franchisé qui
  // surcharge une couleur ne surcharge que celle-là.
  return { ...defauts(), ...maison, ...marque, ...client };
}
