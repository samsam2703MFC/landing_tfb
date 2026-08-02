/**
 * Ce qui protège les appels sortants.
 *
 * Un client saisit lui-même l'adresse de son API. Sans garde-fou, il pourrait
 * — par erreur ou non — nous faire interroger un service interne : la base de
 * données, le service de métadonnées du fournisseur d'infrastructure, un autre
 * client. C'est la classe d'attaque dite SSRF, et elle se règle ici, à un
 * seul endroit, plutôt qu'à chaque appel.
 *
 * Le contrôle porte sur **l'adresse IP résolue**, pas sur le nom : un nom de
 * domaine public peut très bien pointer vers 127.0.0.1. Et il est refait
 * **après chaque redirection** — sans quoi il suffirait de rediriger vers une
 * adresse interne une fois le premier contrôle passé.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Levée quand une adresse est refusée. Le message part au client tel quel. */
export class AdresseRefusee extends Error {
  constructor(message, code = 'HOTE_INTERDIT') {
    super(message);
    this.code = code;
  }
}

/**
 * Une adresse IPv4 est-elle privée, locale, ou autrement interne ?
 *
 * La liste est celle des plages réservées, plus deux cas qu'on oublie souvent :
 * 169.254.0.0/16 (link-local, où vit le service de métadonnées d'AWS et de
 * Google) et 100.64.0.0/10 (CGNAT, utilisé par certains hébergeurs).
 */
export function ipInterne(ip) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    // Adresses locales uniques et lien-local IPv6.
    if (/^f[cd]/.test(v) || /^fe80:/.test(v)) return true;
    // IPv4 encapsulée : ::ffff:127.0.0.1 est bien du loopback.
    const encapsulee = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (encapsulee) return ipInterne(encapsulee[1]);
    return false;
  }
  const o = ip.split('.').map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = o;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

/**
 * Vérifie une adresse avant de l'appeler.
 *
 * `resoudre` est injectable pour que le contrôle se teste sans réseau — c'est
 * la seule façon de vérifier le cas « nom public qui pointe vers 127.0.0.1 »
 * sans dépendre d'un DNS complice.
 */
export async function verifierAdresse(url, { autoriserLocal = false, resoudre = lookup } = {}) {
  let u;
  try {
    u = new URL(String(url));
  } catch {
    throw new AdresseRefusee(`« ${url} » n'est pas une adresse valide.`, 'ADRESSE_INVALIDE');
  }

  if (u.protocol !== 'https:') {
    // Le HTTP simple ferait voyager la clé d'API en clair. Toléré seulement
    // en développement, jamais par défaut.
    if (!(autoriserLocal && u.protocol === 'http:')) {
      throw new AdresseRefusee(
        "L'adresse doit commencer par https:// — en http, votre clé d'API voyagerait en clair.",
        'HTTPS_REQUIS',
      );
    }
  }

  const hote = u.hostname.replace(/^\[|\]$/g, '');

  // Le drapeau de développement ouvre la boucle locale, et elle seule.
  //
  // Il ouvrait tout : le service de métadonnées de l'hébergeur, les plages
  // privées, le réseau interne. Un drapeau censé permettre d'essayer avec une
  // fausse caisse sur 127.0.0.1 n'a aucune raison d'ouvrir 169.254.169.254.
  if (autoriserLocal && (hote === 'localhost' || hote === '127.0.0.1' || hote === '::1')) return u;
  const adresses = isIP(hote)
    ? [{ address: hote }]
    : await resoudre(hote, { all: true }).catch(() => {
      throw new AdresseRefusee(`Le nom « ${hote} » ne se résout pas.`, 'HOTE_INTROUVABLE');
    });

  for (const { address } of adresses) {
    if (ipInterne(address)) {
      throw new AdresseRefusee(
        `« ${hote} » mène à une adresse interne (${address}). Nous n'appelons que des services publics.`,
      );
    }
  }
  return u;
}

/**
 * Une attente qui croît, avec du hasard.
 *
 * Le hasard n'est pas une coquetterie : sans lui, cinquante connexions
 * réveillées par la même panne réessaient toutes à la même seconde et
 * refont tomber le service qui vient de se relever.
 */
export function attente(essai, { base = 500, plafond = 30000 } = {}) {
  const brut = Math.min(plafond, base * 2 ** Math.max(0, essai - 1));
  return Math.round(brut / 2 + Math.random() * (brut / 2));
}

/** Faut-il réessayer après ce statut ? */
export function aReessayer(statut) {
  return statut === 429 || statut === 408 || (statut >= 500 && statut < 600);
}
