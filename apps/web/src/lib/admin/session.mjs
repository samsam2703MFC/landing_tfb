/**
 * Authentification de la console — CÔTÉ SERVEUR UNIQUEMENT.
 *
 * Deux portes, et il en faut deux.
 *
 *   · **Les comptes** (`landing_utilisateurs`) : un identifiant par personne,
 *     un mot de passe haché en scrypt, un rôle. C'est ce qui permet à une
 *     offre de porter le nom de qui l'a faite — un mot de passe partagé ne
 *     saurait pas le dire.
 *   · **La clé de secours** (`ADMIN_PASSWORD`) : le secret d'environnement,
 *     qui ouvre toujours la console en administrateur. Sans elle, une base
 *     vide ou un compte supprimé par mégarde fermeraient la console à tout le
 *     monde, y compris à celui qui pourrait la rouvrir.
 *
 * La session tient dans un cookie signé HMAC-SHA256 : rien à stocker côté
 * serveur, et le cookie ne contient jamais de mot de passe — seulement une
 * expiration, un aléa, l'identifiant du compte et son rôle, le tout signé.
 * Modifier le rôle dans le cookie casse la signature.
 *
 * Tant qu'`ADMIN_PASSWORD` n'est pas renseigné, la console est fermée. C'est
 * volontaire : mieux vaut une console indisponible qu'une console ouverte.
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const NOM_COOKIE = 'tfb_console';

/** Durée d'une session, en millisecondes. */
const DUREE = Number(process.env.ADMIN_SESSION_MS || 12 * 3600 * 1000);

/** Longueur minimale exigée du mot de passe, pour écarter les valeurs de test. */
const LONGUEUR_MIN = 10;

/** Le mot de passe attendu, ou une chaîne vide s'il n'est pas configuré. */
function attendu() {
  return (process.env.ADMIN_PASSWORD || '').trim();
}

/**
 * La console est-elle utilisable ? Non tant qu'aucun mot de passe sérieux
 * n'est configuré, ou s'il reste la valeur du gabarit.
 */
export function consoleActive() {
  const mdp = attendu();
  return mdp.length >= LONGUEUR_MIN && !/change-moi/i.test(mdp);
}

/**
 * Clé de signature du cookie. `ADMIN_SECRET` si elle existe, sinon dérivée du
 * mot de passe : changer le mot de passe invalide alors toutes les sessions,
 * ce qui est le comportement souhaitable.
 */
function cle() {
  return process.env.ADMIN_SECRET || `console|${attendu()}|${process.env.DB_PASS || ''}`;
}

function signer(charge) {
  return createHmac('sha256', cle()).update(charge).digest('base64url');
}

/** Comparaison à durée constante, tolérante aux longueurs différentes. */
function memeChaine(a, b) {
  const ta = Buffer.from(String(a));
  const tb = Buffer.from(String(b));
  // On hache d'abord : timingSafeEqual exige deux tampons de même longueur, et
  // comparer les longueurs brutes divulguerait celle du mot de passe.
  const ha = createHmac('sha256', 'comparaison').update(ta).digest();
  const hb = createHmac('sha256', 'comparaison').update(tb).digest();
  return timingSafeEqual(ha, hb);
}

/** Le mot de passe fourni est-il le bon ? */
export function motDePasseValide(propose) {
  if (!consoleActive()) return false;
  return memeChaine(propose || '', attendu());
}

// ---------------------------------------------------------------------------
// Le lien d'annexe remis au client
// ---------------------------------------------------------------------------

/**
 * La clé qui ouvre l'annexe d'une offre à quelqu'un qui n'a pas de compte.
 *
 * Le client doit pouvoir lire son annexe depuis le courriel : la mettre
 * derrière la console la rendrait illisible pour son seul destinataire. Elle
 * est donc publique, mais **pas devinable** — signée par la même clé que les
 * sessions, et liée à la référence *et* à la version. Changer de version
 * change la clé : un lien envoyé en janvier n'ouvre pas la renégociation de
 * mars.
 *
 * Rien de secret ne transite : l'annexe décrit ce que le client a lui-même
 * reçu. La signature évite seulement qu'on parcoure les offres des autres en
 * changeant un numéro dans l'URL.
 */
export function cleAnnexe(reference, version) {
  return signer(`annexe:${reference}:${version}`).slice(0, 32);
}

/** La clé proposée ouvre-t-elle bien cette annexe-là ? */
export function cleAnnexeValide(reference, version, proposee) {
  if (!proposee) return false;
  return memeChaine(proposee, cleAnnexe(reference, version));
}

// ---------------------------------------------------------------------------
// Mots de passe des comptes
// ---------------------------------------------------------------------------

/**
 * Paramètres scrypt. N = 16384 coûte une centaine de millisecondes par essai :
 * insensible à la connexion, prohibitif pour qui tenterait un dictionnaire.
 */
const SCRYPT = { N: 16384, r: 8, p: 1 };
const LONGUEUR_CLE = 64;

/** Longueur minimale d'un mot de passe de compte. */
export const LONGUEUR_MOT_DE_PASSE = 10;

/**
 * Hache un mot de passe avec un sel tiré au hasard.
 * Format : `scrypt$<sel>$<empreinte>`, tout en base64url.
 */
export function hacher(motDePasse) {
  const clair = String(motDePasse ?? '');
  if (clair.length < LONGUEUR_MOT_DE_PASSE) {
    throw new Error(`Le mot de passe doit faire au moins ${LONGUEUR_MOT_DE_PASSE} caractères.`);
  }
  const sel = randomBytes(16);
  const derive = scryptSync(clair, sel, LONGUEUR_CLE, SCRYPT);
  return `scrypt$${sel.toString('base64url')}$${derive.toString('base64url')}`;
}

/** Le mot de passe correspond-il à l'empreinte stockée ? */
export function empreinteValide(motDePasse, empreinte) {
  const morceaux = String(empreinte || '').split('$');
  if (morceaux.length !== 3 || morceaux[0] !== 'scrypt') return false;
  try {
    const sel = Buffer.from(morceaux[1], 'base64url');
    const attendu = Buffer.from(morceaux[2], 'base64url');
    if (attendu.length !== LONGUEUR_CLE) return false;
    const derive = scryptSync(String(motDePasse ?? ''), sel, LONGUEUR_CLE, SCRYPT);
    return timingSafeEqual(attendu, derive);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Jeton de session
// ---------------------------------------------------------------------------

/** Les rôles, du plus large au plus étroit. */
export const ROLES = ['admin', 'commercial', 'technique'];

/** Ce que chaque rôle fait, dit en une phrase pour l'écran des comptes. */
export const ROLES_DITS = {
  admin: { nom: 'Administrateur', quoi: 'Tout.' },
  commercial: {
    nom: 'Commercial',
    quoi: 'Offres, contrats, demandes, son portefeuille.',
    pas: 'Les connexions techniques, les manifests, les clés.',
  },
  technique: {
    nom: 'Technique',
    quoi: 'Brancher les caisses : connexions, tests, mapping, imports, journaux.',
    pas: 'Les prix. Ni offres, ni contrats, ni tarifs. Il branche, il ne vend pas.',
  },
};

/**
 * Fabrique un jeton : expiration, aléa, identifiant du compte et rôle, signés
 * ensemble. Le rôle voyage dans le cookie parce qu'aucune requête ne doit
 * dépendre d'un aller-retour en base pour savoir ce qu'elle a le droit de
 * faire — et le modifier casse la signature.
 *
 * `0` en identifiant désigne la clé de secours : aucun compte derrière.
 */
export function creerJeton({ id = 0, role = 'admin' } = {}) {
  const propre = ROLES.includes(role) ? role : 'commercial';
  const charge = `${Date.now() + DUREE}.${randomBytes(9).toString('base64url')}.${Number(id) || 0}.${propre}`;
  return `${charge}.${signer(charge)}`;
}

/**
 * Lit un jeton et rend la session qu'il porte, ou `null`.
 * @returns {{id: number, role: string, secours: boolean}|null}
 */
export function lireJeton(jeton) {
  if (!jeton || !consoleActive()) return null;
  const morceaux = String(jeton).split('.');
  if (morceaux.length !== 5) return null;
  const [expiration, alea, id, role, signature] = morceaux;
  if (!memeChaine(signature, signer(`${expiration}.${alea}.${id}.${role}`))) return null;
  const limite = Number(expiration);
  if (!Number.isFinite(limite) || limite <= Date.now()) return null;
  if (!ROLES.includes(role)) return null;
  return { id: Number(id) || 0, role, secours: Number(id) === 0 };
}

/** Le cookie présenté est-il une session valide et non expirée ? */
export function jetonValide(jeton) {
  return lireJeton(jeton) !== null;
}

// ---------------------------------------------------------------------------
// Droits
// ---------------------------------------------------------------------------

/**
 * Ce qu'un commercial a le droit d'ouvrir. Tout le reste est réservé à
 * l'administrateur.
 *
 * La liste dit ce qui est **permis**, jamais ce qui est interdit : un écran
 * ajouté demain est fermé au commercial tant que personne ne l'a ouvert
 * explicitement. L'inverse — lister les interdits — laisserait chaque
 * nouveauté ouverte par oubli, et c'est la grille tarifaire qui serait
 * modifiable par tout le monde.
 */
/** Ce que tout compte connecté peut ouvrir, quel que soit son rôle. */
const COMMUN = [
  // `/admin` est le tableau de bord, et **lui seul** : le déclarer comme un
  // sous-arbre ouvrirait toute la console d'un coup, tarifs compris.
  { chemin: '/admin', arbre: false },
  { chemin: '/admin/deconnexion', arbre: false },
  { chemin: '/admin/motdepasse', arbre: false },
];

const OUVERT_AU_COMMERCIAL = [
  ...COMMUN,
  { chemin: '/admin/leads', arbre: true },
  { chemin: '/admin/offres', arbre: true },
  { chemin: '/admin/prospects', arbre: true },
  { chemin: '/admin/contrats', arbre: true },
  { chemin: '/admin/pieces', arbre: true },
  // `/admin/societe` n'y est pas, et ce n'est pas un oubli : l'écran porte
  // l'IBAN sur lequel les clients virent, et le compte Stripe qui encaisse.
  // Un commercial les lit sur chaque document qu'il édite ; il n'a pas à
  // pouvoir les changer. Le rail masque l'entrée de lui-même.
];

/**
 * Ce qu'un profil technique peut ouvrir.
 *
 * Il branche des caisses ; il ne vend pas. La ligne de partage est le prix :
 * ni offres, ni contrats, ni tarifs, ni marges. Sans ce troisième rôle, poser
 * une connexion demanderait un compte administrateur — donc l'accès à toute la
 * grille tarifaire et à tous les contrats, pour quelqu'un dont le métier est
 * de configurer une API.
 *
 * Il ouvre en revanche **n'importe quel client**, parce qu'il dépanne : lui
 * demander d'être affecté à un portefeuille l'empêcherait de faire son travail
 * le jour où une synchro tombe chez quelqu'un d'autre.
 */
const OUVERT_AU_TECHNIQUE = [
  ...COMMUN,
  { chemin: '/admin/onboarding', arbre: true },
  { chemin: '/admin/connexions', arbre: true },
  { chemin: '/admin/connecteurs', arbre: true },
  { chemin: '/admin/boutiques', arbre: true },
  // La fiche d'un client, pour lire ses coordonnées et ses boutiques. Les
  // offres et les contrats vivent ailleurs et lui restent fermés.
  { chemin: '/admin/prospects', arbre: true },
];

const PAR_ROLE = { commercial: OUVERT_AU_COMMERCIAL, technique: OUVERT_AU_TECHNIQUE };

/** Le rôle a-t-il le droit d'ouvrir ce chemin ? */
export function cheminAutorise(chemin, role) {
  if (role === 'admin') return true;
  const nu = String(chemin || '').split('?')[0].replace(/\/+$/, '') || '/admin';
  const permis = PAR_ROLE[role];
  // Un rôle inconnu n'ouvre rien : c'est la même règle que la liste blanche,
  // appliquée aux rôles eux-mêmes.
  if (!permis) return false;
  return permis.some(
    ({ chemin: p, arbre }) => nu === p || (arbre && nu.startsWith(`${p}/`)),
  );
}

/** Le chemin du cookie : celui du montage, pour ne pas déborder sur les
 *  applications voisines servies sous d'autres chemins du même hôte. */
export function cheminCookie() {
  return (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';
}

/**
 * La requête vient-elle d'une connexion chiffrée ? Apache termine le TLS et
 * parle en clair au serveur Node : l'URL vue ici est en http:// même quand le
 * navigateur est en https://. Seul X-Forwarded-Proto le dit.
 */
function chiffre(requete, url) {
  const annonce = requete?.headers?.get('x-forwarded-proto');
  if (annonce) return annonce.split(',')[0].trim() === 'https';
  return url?.protocol === 'https:';
}

/** Options du cookie de session. */
export function optionsCookie(requete, url) {
  return {
    path: cheminCookie(),
    httpOnly: true,
    sameSite: 'lax',
    secure: chiffre(requete, url),
    maxAge: Math.floor(DUREE / 1000),
  };
}
