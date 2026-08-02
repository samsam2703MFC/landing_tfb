/**
 * Contrôle des images téléversées depuis la console.
 *
 * Un fichier arrivant d'un navigateur annonce son type lui-même, dans
 * `file.type`. Cette annonce ne prouve rien : elle se change en une ligne. On
 * lit donc les **premiers octets** du fichier, qui, eux, ne mentent pas.
 *
 * Le SVG est refusé, et ce n'est pas une négligence. Un SVG est un document
 * XML qui peut contenir du JavaScript ; servi depuis notre propre domaine, il
 * s'exécuterait avec les droits du site — le cookie de session de la console
 * compris. Un logo vectoriel se convertit en PNG, ce qui coûte trente
 * secondes ; l'alternative coûte la console.
 */

/** Ce qu'on accepte, avec la signature qui le prouve. */
const FORMATS = [
  { type: 'image/png', extension: 'png', signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: 'image/jpeg', extension: 'jpg', signature: [0xff, 0xd8, 0xff] },
  // WebP : « RIFF » puis quatre octets de taille, puis « WEBP ».
  { type: 'image/webp', extension: 'webp', signature: [0x52, 0x49, 0x46, 0x46], a8: [0x57, 0x45, 0x42, 0x50] },
];

/** Taille maximale, avant encodage. Un logo qui dépasse est une photo. */
export const TAILLE_MAX = 512 * 1024;

/**
 * Taille maximale d'une capture d'écran de maquette.
 *
 * Huit fois celle d'un logo, parce que ce n'est pas la même chose : un logo
 * est un dessin de quelques traits, une capture d'application est une page
 * entière de texte et de tableaux. La réduire à 512 ko obligerait à
 * recompresser jusqu'à rendre les libellés illisibles — et une maquette dont
 * on ne lit pas les colonnes ne prévient aucun malentendu.
 */
export const TAILLE_MAX_CAPTURE = 4 * 1024 * 1024;

/** Les types proposés à l'attribut `accept` du champ de fichier. */
export const TYPES_ACCEPTES = FORMATS.map((f) => f.type).join(',');

/** Le format reconnu d'après les octets, ou `null`. */
export function reconnaitre(octets) {
  const vue = new Uint8Array(octets);
  return (
    FORMATS.find((f) => {
      if (!f.signature.every((o, i) => vue[i] === o)) return false;
      if (f.a8 && !f.a8.every((o, i) => vue[8 + i] === o)) return false;
      return true;
    }) || null
  );
}

/**
 * Vérifie un fichier téléversé et rend de quoi le stocker.
 *
 * @param {File|null} fichier
 * @param {{maxOctets?: number, pourquoi?: string}} [options]
 *   `maxOctets` relève le plafond — une capture d'écran n'est pas un logo —
 *   et `pourquoi` remplace la phrase qui l'explique. Sans eux, la limite du
 *   bandeau s'applique, ce qui reste le cas le plus fréquent.
 * @returns {Promise<{base64: string, type: string, octets: number}|null>}
 *   `null` quand aucun fichier n'a été choisi — le champ vide n'est pas une
 *   erreur, il veut dire « ne change rien ».
 * @throws {Error} avec un message qui dit quoi faire, pas seulement ce qui ne va pas.
 */
export async function lireImage(fichier, options = {}) {
  if (!fichier || typeof fichier === 'string' || !fichier.size) return null;

  const plafond = Number(options.maxOctets) || TAILLE_MAX;
  if (fichier.size > plafond) {
    throw new Error(
      `L'image fait ${Math.round(fichier.size / 1024)} ko, le maximum est ${Math.round(plafond / 1024)} ko. `
      + (options.pourquoi || "Un logo de bandeau n'a pas besoin de plus."),
    );
  }

  const octets = new Uint8Array(await fichier.arrayBuffer());
  const format = reconnaitre(octets);
  if (!format) {
    const nom = String(fichier.name || '').toLowerCase();
    if (nom.endsWith('.svg') || /svg/i.test(fichier.type || '')) {
      throw new Error(
        "Le SVG n'est pas accepté : il peut contenir du JavaScript, qui s'exécuterait sur notre propre domaine. Exportez le logo en PNG.",
      );
    }
    throw new Error(
      `Ce fichier n'est pas une image PNG, JPEG ou WebP — quel que soit son nom. Vérifiez ce que vous avez exporté.`,
    );
  }

  return {
    base64: Buffer.from(octets).toString('base64'),
    type: format.type,
    octets: fichier.size,
  };
}
