/**
 * Le coffre : les clés d'API des clients, chiffrées.
 *
 * Une clé de caisse donne accès au chiffre d'affaires d'un réseau entier. Elle
 * ne se stocke pas en clair, elle ne se relit jamais — on la remplace — et
 * elle n'apparaît nulle part dans un journal.
 *
 * **AES-256-GCM**, et pas AES-CBC : le mode GCM authentifie ce qu'il chiffre.
 * Un octet modifié en base fait échouer le déchiffrement au lieu de rendre
 * silencieusement n'importe quoi.
 *
 * La clé maître vit en **variable d'environnement**, jamais en base — sans
 * quoi un dump de la base suffirait à tout lire :
 *
 *   SECRETS_CLE_1   la clé de version 1, 32 octets en base64
 *   SECRETS_CLE_2   celle de version 2, quand on tourne
 *   SECRETS_VERSION la version avec laquelle on chiffre aujourd'hui
 *
 * On chiffre toujours avec la version active ; on déchiffre avec celle qui est
 * écrite sur la ligne. C'est ce qui permet de tourner la clé sans interruption :
 * les anciennes lignes restent lisibles pendant qu'on les rechiffre une à une.
 *
 * Fabriquer une clé :  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/** Levée quand le coffre n'est pas utilisable. Toujours explicite. */
export class CoffreFerme extends Error {}

/** La version avec laquelle on chiffre. Un défaut, pour ne pas exiger la variable. */
export function versionActive(env = process.env) {
  const n = Number(env.SECRETS_VERSION || 1);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

/**
 * La clé d'une version, en octets.
 *
 * Refuse une clé qui n'a pas exactement 32 octets plutôt que de la compléter
 * ou de la tronquer : une clé de seize octets « qui marche » donnerait un
 * chiffrement deux fois plus faible sans que personne ne s'en aperçoive.
 */
function cle(version, env = process.env) {
  const brut = String(env[`SECRETS_CLE_${version}`] || '');
  if (!brut) {
    throw new CoffreFerme(
      `Aucune clé de chiffrement en version ${version} : posez SECRETS_CLE_${version} sur le serveur.`,
    );
  }
  const octets = Buffer.from(brut, 'base64');
  if (octets.length !== 32) {
    throw new CoffreFerme(
      `SECRETS_CLE_${version} fait ${octets.length} octets au lieu de 32. `
      + 'Fabriquez-la avec randomBytes(32).toString("base64").',
    );
  }
  return octets;
}

/** Le coffre est-il utilisable ? De quoi le dire à l'écran plutôt que de planter. */
export function coffreOuvert(env = process.env) {
  try {
    cle(versionActive(env), env);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chiffre une valeur.
 *
 * Rend aussi les quatre derniers caractères en clair : c'est le seul affichage
 * autorisé — « ••••4f2a » — et il suffit à ce qu'un client reconnaisse la clé
 * qu'il a saisie sans qu'on la lui remontre.
 */
export function chiffrer(valeur, env = process.env) {
  const clair = String(valeur ?? '');
  if (!clair) throw new CoffreFerme('Rien à chiffrer.');
  const version = versionActive(env);
  // Douze octets : la taille recommandée pour GCM. Tiré au sort à chaque
  // écriture — réutiliser un vecteur d'initialisation avec la même clé casse
  // la confidentialité du mode.
  const iv = randomBytes(12);
  const chiffreur = createCipheriv('aes-256-gcm', cle(version, env), iv);
  const chiffre = Buffer.concat([chiffreur.update(clair, 'utf8'), chiffreur.final()]);
  return {
    chiffre,
    iv,
    sceau: chiffreur.getAuthTag(),
    version,
    quatre: clair.slice(-4),
  };
}

/**
 * Déchiffre, avec la version écrite sur la ligne.
 *
 * N'est appelée que par ce qui parle réellement à la caisse. Aucune route de
 * la console n'y touche : un secret enregistré ne revient jamais à l'écran.
 */
export function dechiffrer({ chiffre, iv, sceau, version }, env = process.env) {
  const dechiffreur = createDecipheriv('aes-256-gcm', cle(version || 1, env), Buffer.from(iv));
  dechiffreur.setAuthTag(Buffer.from(sceau));
  try {
    return Buffer.concat([dechiffreur.update(Buffer.from(chiffre)), dechiffreur.final()]).toString('utf8');
  } catch {
    // Le sceau ne correspond pas : la ligne a été modifiée, ou la clé n'est
    // pas la bonne. Dans les deux cas on ne rend rien plutôt que du bruit.
    throw new CoffreFerme(
      `Ce secret ne se déchiffre pas avec la clé de version ${version || 1}. `
      + 'La ligne a été modifiée, ou la clé a changé sans rotation.',
    );
  }
}

/** L'affichage masqué d'un secret enregistré. */
export function masque(quatre) {
  const fin = String(quatre || '').slice(-4);
  return fin ? `••••${fin}` : '••••';
}

/**
 * Nettoie ce qui part au journal.
 *
 * Appelée sur **toute** trace de requête sortante. Deux passes, parce qu'un
 * secret voyage de deux façons : dans un en-tête d'authentification, et
 * parfois dans l'adresse elle-même — certaines caisses veulent la clé en
 * paramètre de requête, et l'adresse complète finirait sinon dans les logs.
 *
 * Le remplacement est fait sur les valeurs connues plutôt que sur une liste
 * de noms d'en-têtes : c'est ce qui attrape aussi la clé recopiée dans un
 * champ qu'on n'avait pas prévu.
 */
export function nettoyerPourJournal(texte, secrets = []) {
  let sortie = String(texte ?? '');
  for (const s of secrets) {
    const v = String(s ?? '');
    // Sous huit caractères, remplacer ferait plus de dégâts que de bien : on
    // masquerait des morceaux de mots au hasard dans toute la trace.
    if (v.length < 8) continue;
    sortie = sortie.split(v).join('••••••••');
  }
  // Et par sécurité, les en-têtes d'authentification, même si leur valeur
  // n'était pas dans la liste — un jeton de rafraîchissement, par exemple.
  //
  // Le mot de schéma (« Bearer », « Basic ») est gardé : sans lui, on
  // masquerait « Bearer » et laisserait le jeton en clair juste derrière.
  sortie = sortie.replace(
    /(authorization|x-api-key|api-key|token)(["']?\s*[:=]\s*["']?)(bearer\s+|basic\s+)?([^\s"',}]+)/gi,
    (tout, nom, milieu, schema) => `${nom}${milieu}${schema || ''}••••••••`,
  );
  return sortie;
}

/** Comparaison à temps constant, pour les jetons de reprise et de délégation. */
export function memeJeton(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}
