/**
 * Authentification de la console — CÔTÉ SERVEUR UNIQUEMENT.
 *
 * Un seul secret partagé, `ADMIN_PASSWORD`, comparé en temps constant. La
 * session tient dans un cookie signé HMAC-SHA256 : rien à stocker en base, et
 * le cookie ne contient qu'une date d'expiration — jamais le mot de passe.
 *
 * Tant qu'`ADMIN_PASSWORD` n'est pas renseigné, la console est fermée. C'est
 * volontaire : mieux vaut une console indisponible qu'une console ouverte.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

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

/** Fabrique un jeton de session : expiration + aléa, signés ensemble. */
export function creerJeton() {
  const charge = `${Date.now() + DUREE}.${randomBytes(9).toString('base64url')}`;
  return `${charge}.${signer(charge)}`;
}

/** Le cookie présenté est-il une session valide et non expirée ? */
export function jetonValide(jeton) {
  if (!jeton || !consoleActive()) return false;
  const morceaux = String(jeton).split('.');
  if (morceaux.length !== 3) return false;
  const [expiration, alea, signature] = morceaux;
  if (!memeChaine(signature, signer(`${expiration}.${alea}`))) return false;
  const limite = Number(expiration);
  return Number.isFinite(limite) && limite > Date.now();
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
