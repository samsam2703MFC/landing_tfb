/**
 * Les jetons d'accès aux endpoints, fabriqués par la console.
 *
 * Un jeton porte **une application et un client**, et ce couple est tout :
 * l'application dit quels endpoints il a le droit de lire, le client dit sur
 * quelle base ils s'exécutent. Ni l'un ni l'autre ne se lit dans la requête,
 * donc ni l'un ni l'autre ne se falsifie. Un `?client=` pris au mot est
 * exactement la façon dont une application finit par lire les données d'une
 * autre enseigne.
 *
 * POURQUOI SHA-256 ET NON SCRYPT, alors que les mots de passe de la console
 * sont en scrypt. Un mot de passe est court, choisi par un humain, et se
 * devine : il faut donc rendre chaque essai coûteux. Un jeton, lui, est
 * trente-deux octets tirés au hasard — il n'y a rien à deviner, et le
 * dictionnaire n'existe pas. Un hachage lent ne protégerait rien et coûterait
 * une centaine de millisecondes à **chaque appel** d'une application.
 *
 * Le jeton en clair n'est montré qu'une fois, à sa création. Seule l'empreinte
 * est stockée : un jeton perdu se remplace en trente secondes, un jeton qu'on
 * pourrait relire dans un dump serait à changer partout.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { connexion, table, viderCache } from '../db.mjs';

/** Le préfixe rend un jeton reconnaissable dans un journal ou un ticket. */
const PREFIXE = 'tfb_';

export function empreinteDe(jeton) {
  return createHash('sha256').update(String(jeton)).digest('hex');
}

/** Trente-deux octets tirés au hasard. Rien à deviner, rien à dériver. */
export function fabriquerJeton() {
  return `${PREFIXE}${randomBytes(32).toString('base64url')}`;
}

export function masque(quatre) {
  return `${PREFIXE}••••${String(quatre || '').slice(-4)}`;
}

export async function listerJetons() {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT j.id, j.libelle, j.quatre, j.actif, j.expire_le, j.cree_le, j.cree_par, j.vu_le, j.appels,
            j.application_id, j.prospect_id, a.nom AS application, p.raison_sociale AS client
       FROM ${table('jetons')} j
       LEFT JOIN ${table('applications')} a ON a.id = j.application_id
       LEFT JOIN ${table('prospects')} p ON p.id = j.prospect_id
      ORDER BY j.actif DESC, j.cree_le DESC`,
    [],
  );
  return lignes.map((l) => ({
    id: Number(l.id),
    libelle: l.libelle || '',
    masque: masque(l.quatre),
    actif: Boolean(Number(l.actif ?? 1)),
    expireLe: l.expire_le || null,
    creeLe: l.cree_le,
    creePar: l.cree_par,
    vuLe: l.vu_le || null,
    appels: Number(l.appels || 0),
    applicationId: Number(l.application_id),
    prospectId: Number(l.prospect_id),
    application: l.application || `Application ${l.application_id}`,
    client: l.client || `Prospect ${l.prospect_id}`,
  }));
}

/**
 * Fabrique un jeton et rend sa valeur en clair — **la seule fois**.
 *
 * L'appelant doit la montrer immédiatement : elle n'est nulle part ailleurs.
 */
export async function creerJetonAcces({ applicationId, prospectId, libelle, expireLe }, creePar = null) {
  if (!Number(applicationId)) return { ok: false, erreur: 'Choisissez l’application.' };
  if (!Number(prospectId)) return { ok: false, erreur: 'Choisissez le client — un jeton vaut pour une seule enseigne.' };

  const db = await connexion();
  const app = await db.requete(`SELECT id FROM ${table('applications')} WHERE id = ? AND actif = 1 LIMIT 1`, [Number(applicationId)]);
  if (!app[0]) return { ok: false, erreur: 'Application inconnue ou désactivée.' };
  // Sans base déclarée, le jeton ne pourrait rien lire — autant le dire tout
  // de suite plutôt qu'au premier appel, depuis l'application du client.
  const base = await db.requete(`SELECT id FROM ${table('bases')} WHERE prospect_id = ? LIMIT 1`, [Number(prospectId)]);
  if (!base[0]) return { ok: false, erreur: 'Ce client n’a pas de base déclarée : le jeton n’aurait rien à lire.' };

  const clair = fabriquerJeton();
  await db.executer(
    `INSERT INTO ${table('jetons')}
       (application_id, prospect_id, libelle, empreinte, quatre, actif, expire_le, cree_le, cree_par, appels)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, 0)`,
    [Number(applicationId), Number(prospectId), String(libelle || '').trim(),
      empreinteDe(clair), clair.slice(-4), String(expireLe || '').trim() || null,
      new Date().toISOString(), creePar],
  );
  viderCache();
  return { ok: true, clair };
}

export async function revoquerJeton(id) {
  const db = await connexion();
  // Révoqué, pas supprimé : la ligne garde le compte d'appels et la dernière
  // utilisation, qui disent si le jeton servait encore — donc ce qu'on casse.
  await db.executer(`UPDATE ${table('jetons')} SET actif = 0 WHERE id = ?`, [Number(id)]);
  viderCache();
}

export async function supprimerJeton(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('jetons')} WHERE id = ?`, [Number(id)]);
  viderCache();
}

/**
 * Reconnaît un jeton présenté et rend ce qu'il autorise, ou `null`.
 *
 * La comparaison finale est à durée constante. C'est une précaution de
 * principe ici — on cherche par empreinte indexée, donc la base a déjà fait le
 * travail — mais elle ne coûte rien et évite d'avoir à raisonner sur ce que le
 * moteur laisse fuir en temps de réponse.
 */
export async function reconnaitreJeton(presente) {
  const brut = String(presente || '').trim();
  if (!brut.startsWith(PREFIXE) || brut.length < 20) return null;

  const db = await connexion();
  const lignes = await db.requete(
    `SELECT j.id, j.empreinte, j.application_id, j.prospect_id, j.actif, j.expire_le
       FROM ${table('jetons')} j WHERE j.empreinte = ? LIMIT 1`,
    [empreinteDe(brut)],
  );
  const l = lignes[0];
  if (!l) return null;

  const a = Buffer.from(String(l.empreinte));
  const b = Buffer.from(empreinteDe(brut));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (!Number(l.actif)) return null;
  if (l.expire_le && new Date(l.expire_le).getTime() < Date.now()) return null;

  return { id: Number(l.id), applicationId: Number(l.application_id), prospectId: Number(l.prospect_id) };
}

/**
 * Note l'usage d'un jeton. Volontairement sans `await` chez l'appelant : une
 * écriture de statistique n'a pas à retarder la réponse d'une caisse, ni à la
 * faire échouer.
 */
export async function noterUsage(id) {
  try {
    const db = await connexion();
    await db.executer(
      `UPDATE ${table('jetons')} SET vu_le = ?, appels = appels + 1 WHERE id = ?`,
      [new Date().toISOString(), Number(id)],
    );
  } catch { /* la mesure n'est pas la fonction */ }
}

/** Cet endpoint est-il déclaré pour cette application ? */
export async function endpointAutorise(endpointId, applicationId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT 1 FROM ${table('endpoint_applications')} WHERE endpoint_id = ? AND application_id = ? LIMIT 1`,
    [Number(endpointId), Number(applicationId)],
  );
  return lignes.length > 0;
}

// ---------------------------------------------------------------------------
// Le débit
// ---------------------------------------------------------------------------

const FENETRE_MS = 60_000;
const MAX_PAR_FENETRE = 120;
const compteurs = new Map();

/**
 * Un plafond par jeton et par minute.
 *
 * En mémoire, donc par processus : ce n'est pas une protection contre un
 * attaquant distribué, et ce n'est pas ce qu'on cherche. C'est le garde-fou
 * contre une application qui boucle — le cas réel, celui qui met une base
 * cliente à genoux un dimanche soir sans que personne ne soit malveillant.
 */
export function debitDepasse(jetonId) {
  const maintenant = Date.now();
  const e = compteurs.get(jetonId);
  if (!e || maintenant - e.debut > FENETRE_MS) {
    compteurs.set(jetonId, { debut: maintenant, n: 1 });
    // Un ménage paresseux : sans lui, la carte grossit avec chaque jeton vu.
    if (compteurs.size > 5000) {
      for (const [k, v] of compteurs) if (maintenant - v.debut > FENETRE_MS) compteurs.delete(k);
    }
    return false;
  }
  e.n += 1;
  return e.n > MAX_PAR_FENETRE;
}

export const PLAFOND_DEBIT = { parMinute: MAX_PAR_FENETRE };
