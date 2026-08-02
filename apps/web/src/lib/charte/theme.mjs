/**
 * La feuille de style complète d'un client, fabriquée depuis ses variables.
 *
 * Le design system est écrit contre des variables CSS : une charte n'est donc
 * qu'une liste de surcharges. Rien n'est compilé, livré ou dupliqué par client,
 * et changer une couleur ne demande aucun déploiement.
 *
 * POURQUOI PAS UN CHAMP « CSS LIBRE ». Ce serait plus simple et c'est un mauvais
 * échange : le CSS n'est pas inerte. Un sélecteur d'attribut avec
 * `background-image: url(...)` exfiltre ce qu'un utilisateur tape, et une règle
 * `content` réécrit ce qu'un client lit. Un jeu de jetons exprime toutes les
 * chartes légitimes et aucune de ces attaques — d'où la vérification finale
 * ci-dessous sur chaque valeur avant qu'elle n'entre dans une balise <style>.
 */

import { ENCRES, defauts } from './registre.mjs';

const HEXA = /^#[0-9a-fA-F]{6}$/;

/** Dernier filet avant l'interpolation dans une feuille de style. */
function couleur(valeur, repli) {
  return typeof valeur === 'string' && HEXA.test(valeur) ? valeur.toLowerCase() : repli;
}

function parmi(valeur, permises, repli) {
  return permises.includes(valeur) ? valeur : repli;
}

/** Rapproche une couleur du noir (négatif) ou du blanc (positif). */
function pousser(hexa, part) {
  const vers = part < 0 ? 0 : 255;
  const ratio = Math.abs(part);
  const canal = (i) => {
    const de = parseInt(hexa.slice(i, i + 2), 16);
    return Math.round(de + (vers - de) * ratio).toString(16).padStart(2, '0');
  };
  return `#${canal(1)}${canal(3)}${canal(5)}`;
}

/** La même couleur, transparente — pour les aplats discrets. */
function voile(hexa, a) {
  const c = (i) => parseInt(hexa.slice(i, i + 2), 16);
  return `rgba(${c(1)}, ${c(3)}, ${c(5)}, ${a})`;
}

const PILES = {
  manrope: '"Manrope", "IBM Plex Sans", system-ui, sans-serif',
  'plex-sans': '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
  systeme: 'system-ui, -apple-system, "Segoe UI", sans-serif',
};

/**
 * La pile d'un client qui a importé ses propres polices.
 *
 * Toujours suivie d'un repli : une police téléchargée peut manquer — réseau
 * coupé, cache vidé, format refusé par un vieux navigateur — et une caisse qui
 * n'affiche rien plutôt qu'une police approchante est une caisse à l'arrêt.
 */
function pileClient(polices, role, repli) {
  const famille = (polices || []).find((p) => p.role === role || p.role === 'les_deux')?.famille;
  return famille ? `"${famille}", ${PILES[repli]}` : PILES[repli];
}

/**
 * Les `@font-face` d'un client, fabriqués ici et non repris d'un fichier.
 *
 * Le fichier de police n'apporte aucune règle : famille, graisse et style
 * viennent de ce que la console déclare, et l'adresse est une route de ce site.
 * Il n'y a donc rien à assainir — rien du fichier n'entre dans la feuille.
 *
 * `font-display: swap` parce qu'un texte invisible pendant le téléchargement
 * est pire qu'un texte dans la mauvaise police : la caisse doit être lisible
 * tout de suite.
 */
export function facesCharte(polices, base = '') {
  return (polices || [])
    .filter((p) => p.famille && /^[A-Za-z0-9 _-]+$/.test(p.famille))
    .map((p) => [
      '@font-face {',
      `  font-family: "${p.famille}";`,
      `  src: url("${base}/polices/${Number(p.id)}") format("${p.format}");`,
      `  font-weight: ${/^[0-9]{3}$/.test(String(p.graisse)) ? p.graisse : 400};`,
      `  font-style: ${p.style === 'italic' ? 'italic' : 'normal'};`,
      '  font-display: swap;',
      '}',
    ].join('\n'))
    .join('\n');
}

const OMBRES = {
  aucune: { s: 'none', m: 'none', l: 'none' },
  douce: {
    s: '0 1px 3px rgba(12, 19, 41, .08), 0 1px 2px -1px rgba(12, 19, 41, .06)',
    m: '0 4px 12px -2px rgba(12, 19, 41, .1), 0 2px 4px -2px rgba(12, 19, 41, .06)',
    l: '0 12px 28px -6px rgba(12, 19, 41, .16), 0 4px 8px -4px rgba(12, 19, 41, .08)',
  },
  marquee: {
    s: '0 2px 6px rgba(12, 19, 41, .16)',
    m: '0 10px 24px -4px rgba(12, 19, 41, .22), 0 4px 8px -4px rgba(12, 19, 41, .12)',
    l: '0 24px 48px -10px rgba(12, 19, 41, .3), 0 8px 16px -8px rgba(12, 19, 41, .16)',
  },
};

/** Multiplicateur sur l'échelle de 4 px. Une caisse tactile n'est pas un bureau. */
const DENSITES = { compacte: 0.8, normale: 1, confortable: 1.25 };

/**
 * Toutes les variables CSS que le design system lit, résolues pour un client.
 * Rendu comme un bloc de déclarations, à poser dans un sélecteur.
 */
export function cssCharte(valeurs, polices = []) {
  const v = { ...defauts(), ...valeurs };

  const primaire = couleur(v['theme.primaire'], '#7b4488');
  const accent = couleur(v['theme.accent'], '#f0912a');
  const page = couleur(v['theme.fond_page'], '#f5f6f9');
  const carte = couleur(v['theme.fond_carte'], '#ffffff');
  const texte = couleur(v['theme.texte'], '#0c1329');
  const doux = couleur(v['theme.texte_doux'], '#565d73');
  const bordure = couleur(v['theme.bordure'], '#dddfe8');
  const succes = couleur(v['etat.succes'], '#157f5a');
  const alerte = couleur(v['etat.alerte'], '#b77500');
  const erreur = couleur(v['etat.erreur'], '#c0304a');
  const info = couleur(v['etat.info'], '#2a5fd0');

  const encreP = ENCRES[parmi(v['theme.encre_primaire'], ['blanc', 'fonce'], 'blanc')];
  const encreA = ENCRES[parmi(v['theme.encre_accent'], ['blanc', 'fonce'], 'fonce')];
  const rayon = Number(parmi(v['theme.arrondi'], ['4', '8', '12', '16'], '12'));
  const ombre = OMBRES[parmi(v['theme.profondeur'], ['aucune', 'douce', 'marquee'], 'douce')];
  const echelle = DENSITES[parmi(v['theme.densite'], ['compacte', 'normale', 'confortable'], 'normale')];
  const choixTitres = parmi(v['theme.police_titres'], [...Object.keys(PILES), 'client'], 'manrope');
  const choixInterface = parmi(v['theme.police_interface'], [...Object.keys(PILES), 'client'], 'plex-sans');
  const titres = choixTitres === 'client' ? pileClient(polices, 'titres', 'manrope') : PILES[choixTitres];
  const interface_ = choixInterface === 'client' ? pileClient(polices, 'interface', 'plex-sans') : PILES[choixInterface];

  const espace = (n) => `${Math.round(n * echelle * 100) / 100}px`;

  return [
    `--brand: ${primaire};`,
    `--brand-hover: ${pousser(primaire, -0.12)};`,
    `--brand-press: ${pousser(primaire, -0.24)};`,
    `--brand-subtle: ${voile(primaire, 0.08)};`,
    `--brand-on: ${encreP};`,
    `--surface-brand: ${primaire};`,
    `--surface-brand-subtle: ${voile(primaire, 0.08)};`,
    `--text-brand: ${pousser(primaire, -0.12)};`,
    `--text-link: ${pousser(primaire, -0.12)};`,
    `--border-brand: ${voile(primaire, 0.45)};`,
    `--shadow-focus: 0 0 0 3px ${voile(primaire, 0.26)};`,

    `--cta-warm: ${accent};`,
    `--cta-warm-hover: ${pousser(accent, -0.1)};`,
    `--cta-warm-on: ${encreA};`,
    `--cta-warm-subtle: ${voile(accent, 0.1)};`,
    `--accent-new: ${accent};`,

    `--surface-page: ${page};`,
    `--surface-card: ${carte};`,
    `--surface-raised: ${carte};`,
    `--surface-sunken: ${pousser(page, -0.04)};`,
    `--surface-hover: ${pousser(page, -0.02)};`,
    `--surface-inverse: ${texte};`,

    `--text-primary: ${texte};`,
    `--text-secondary: ${doux};`,
    `--text-tertiary: ${pousser(doux, 0.28)};`,
    `--text-inverse: ${carte};`,

    `--border-subtle: ${pousser(bordure, 0.5)};`,
    `--border-default: ${bordure};`,
    `--border-strong: ${pousser(bordure, -0.18)};`,

    `--status-success: ${succes};`,
    `--status-warning: ${alerte};`,
    `--status-danger: ${erreur};`,
    `--status-info: ${info};`,
    `--text-success: ${pousser(succes, -0.2)};`,
    `--text-warning: ${pousser(alerte, -0.2)};`,
    `--text-danger: ${pousser(erreur, -0.2)};`,
    `--surface-success-subtle: ${voile(succes, 0.12)};`,
    `--surface-warning-subtle: ${voile(alerte, 0.14)};`,
    `--surface-danger-subtle: ${voile(erreur, 0.12)};`,
    `--surface-info-subtle: ${voile(info, 0.12)};`,

    `--font-display: ${titres};`,
    `--font-sans: ${interface_};`,

    `--radius-sm: ${Math.max(2, rayon - 6)}px;`,
    `--radius-md: ${Math.max(4, rayon - 4)}px;`,
    `--radius-lg: ${rayon}px;`,
    `--radius-xl: ${rayon + 4}px;`,
    `--radius-card: ${rayon}px;`,
    `--radius-control: ${Math.max(4, rayon - 4)}px;`,

    `--shadow-xs: ${ombre.s};`,
    `--shadow-sm: ${ombre.s};`,
    `--shadow-md: ${ombre.m};`,
    `--shadow-lg: ${ombre.l};`,

    `--space-1: ${espace(4)};`,
    `--space-2: ${espace(8)};`,
    `--space-3: ${espace(12)};`,
    `--space-4: ${espace(16)};`,
    `--space-5: ${espace(20)};`,
    `--space-6: ${espace(24)};`,
    `--space-8: ${espace(32)};`,
  ].join('\n  ');
}

/** Le logo, si c'en est un que ce site sert lui-même. */
export function logoCharte(valeurs) {
  const v = { ...defauts(), ...valeurs }['theme.logo'];
  return typeof v === 'string' && v.startsWith('/') && !v.includes('..') ? v : null;
}
