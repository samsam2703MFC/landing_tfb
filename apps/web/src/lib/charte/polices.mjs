/**
 * Les polices importées d'un client.
 *
 * Un fichier de police est un binaire inerte : il ne s'exécute pas, il se
 * dessine. C'est ce qui le distingue d'une feuille de style, et c'est pourquoi
 * on l'accepte tel quel là où on refuse du CSS libre.
 *
 * Le format est reconnu aux **premiers octets**, jamais au type annoncé par le
 * navigateur ni à l'extension du nom : les deux se changent en une ligne, la
 * signature non. Même raisonnement que pour les images de ce dépôt, et pour la
 * même raison — un fichier téléversé qu'on sert sous son propre domaine hérite
 * des droits du site.
 *
 * Le `@font-face` est **fabriqué par nous** à partir de ce que l'écran déclare
 * (famille, graisse, style). Le fichier n'apporte aucune règle : il n'y a donc
 * rien à assainir, puisque rien de ce qu'il contient n'atteint une feuille de
 * style.
 */

import { connexion, table, viderCache } from '../db.mjs';

/** Ce qu'on accepte, avec la signature qui le prouve. */
const FORMATS = [
  { type: 'font/woff2', format: 'woff2', extension: 'woff2', signature: [0x77, 0x4f, 0x46, 0x32] }, // wOF2
  { type: 'font/woff', format: 'woff', extension: 'woff', signature: [0x77, 0x4f, 0x46, 0x46] }, // wOFF
  { type: 'font/otf', format: 'opentype', extension: 'otf', signature: [0x4f, 0x54, 0x54, 0x4f] }, // OTTO
  { type: 'font/ttf', format: 'truetype', extension: 'ttf', signature: [0x00, 0x01, 0x00, 0x00] },
];

export const TYPES_ACCEPTES = '.woff2,.woff,.otf,.ttf';

/**
 * Deux mégaoctets. Une woff2 latine complète pèse une trentaine de kilo-octets ;
 * au-delà de deux mégaoctets, c'est une police à jeux multiples que personne ne
 * veut faire télécharger à une caisse en 3G.
 */
export const TAILLE_MAX = 2 * 1024 * 1024;

/** Les rôles qu'une police peut tenir dans la charte. */
export const ROLES = [
  { valeur: 'titres', libelle: 'Titres' },
  { valeur: 'interface', libelle: 'Interface et texte courant' },
  { valeur: 'les_deux', libelle: 'Les deux' },
];

export const GRAISSES = ['300', '400', '500', '600', '700', '800'];
export const STYLES = [
  { valeur: 'normal', libelle: 'Normal' },
  { valeur: 'italic', libelle: 'Italique' },
];

/** Le format reconnu d'après les octets, ou `null`. */
export function reconnaitre(octets) {
  const vue = new Uint8Array(octets);
  return FORMATS.find((f) => f.signature.every((o, i) => vue[i] === o)) || null;
}

/**
 * Un nom de famille sûr à interpoler dans une feuille de style.
 *
 * Il finit entre guillemets dans `font-family` : une apostrophe ou une
 * accolade y refermerait la déclaration. Plutôt que d'échapper, on restreint —
 * un nom de police n'a besoin ni de ponctuation ni d'accolades.
 */
export function familleSaine(brut) {
  const nom = String(brut || '')
    .replace(/[^A-Za-z0-9 _-]/g, ' ')
    // Les caractères retirés laissaient leur espace : « a"; } body { » devenait
    // « a  body  » avec ses trous. Un nom de police n'a pas d'espaces doubles.
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
  return nom || null;
}

/**
 * Vérifie un fichier téléversé et rend de quoi le stocker.
 * @returns {Promise<{base64: string, type: string, format: string, octets: number}|null>}
 */
export async function lirePolice(fichier) {
  if (!fichier || typeof fichier === 'string' || !fichier.size) return null;
  if (fichier.size > TAILLE_MAX) {
    throw new Error(
      `Ce fichier fait ${Math.round(fichier.size / 1024)} ko, au-delà des ${TAILLE_MAX / 1024} ko admis. `
      + 'Une police woff2 restreinte au latin en pèse une trentaine.',
    );
  }
  const octets = Buffer.from(await fichier.arrayBuffer());
  const format = reconnaitre(octets);
  if (!format) {
    throw new Error(
      'Format non reconnu aux premiers octets. Attendu : woff2, woff, otf ou ttf. '
      + 'Renommer un fichier ne change pas son contenu — c’est le contenu qui est lu ici.',
    );
  }
  return { base64: octets.toString('base64'), type: format.type, format: format.format, octets: octets.length };
}

// ---------------------------------------------------------------------------
// Le magasin
// ---------------------------------------------------------------------------

export async function listerPolices(prospectId) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT id, famille, role, graisse, style, format, type_mime, octets, cree_le
       FROM ${table('charte_polices')} WHERE prospect_id = ? ORDER BY famille ASC, graisse ASC`,
    [Number(prospectId)],
  );
  return lignes.map((l) => ({
    id: Number(l.id),
    famille: l.famille,
    role: l.role || 'les_deux',
    graisse: String(l.graisse || '400'),
    style: l.style || 'normal',
    format: l.format,
    type: l.type_mime,
    octets: Number(l.octets || 0),
    creeLe: l.cree_le,
  }));
}

/** Le fichier lui-même, pour la route qui le sert. */
export async function chargerPolice(id) {
  const db = await connexion();
  const lignes = await db.requete(
    `SELECT fichier, type_mime FROM ${table('charte_polices')} WHERE id = ? LIMIT 1`,
    [Number(id)],
  );
  const l = lignes[0];
  if (!l?.fichier || !l.type_mime) return null;
  return { octets: Buffer.from(l.fichier, 'base64'), type: l.type_mime };
}

export async function ajouterPolice(prospectId, { famille, role, graisse, style }, fichier) {
  const nom = familleSaine(famille);
  if (!nom) return { ok: false, erreur: 'Nom de famille attendu — lettres, chiffres, espaces et tirets.' };
  if (!ROLES.some((r) => r.valeur === role)) return { ok: false, erreur: 'Rôle inconnu.' };
  if (!GRAISSES.includes(String(graisse))) return { ok: false, erreur: 'Graisse hors de la liste.' };
  if (!STYLES.some((s) => s.valeur === style)) return { ok: false, erreur: 'Style inconnu.' };

  let lu;
  try {
    lu = await lirePolice(fichier);
  } catch (err) {
    return { ok: false, erreur: err.message };
  }
  if (!lu) return { ok: false, erreur: 'Aucun fichier choisi.' };

  const db = await connexion();
  await db.executer(
    `INSERT INTO ${table('charte_polices')}
       (prospect_id, famille, role, graisse, style, format, type_mime, fichier, octets, cree_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(prospectId), nom, role, String(graisse), style, lu.format, lu.type, lu.base64, lu.octets,
      new Date().toISOString()],
  );
  viderCache();
  return { ok: true, famille: nom };
}

export async function supprimerPolice(id) {
  const db = await connexion();
  await db.executer(`DELETE FROM ${table('charte_polices')} WHERE id = ?`, [Number(id)]);
  viderCache();
}
