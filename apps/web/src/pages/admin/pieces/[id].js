/**
 * Le téléchargement d'une pièce du dossier.
 *
 * Servie depuis la base et non depuis un dossier du disque : c'est là qu'elle
 * vit, et un scan de carte d'identité n'a rien à faire dans `public/`, où il
 * serait lisible sans être connecté.
 *
 * `Content-Disposition: attachment` est délibéré : un PDF affiché en ligne
 * s'ouvre dans le visualiseur du navigateur, qui garde parfois une copie en
 * cache disque. Ces pièces se téléchargent, elles ne se consultent pas au fil
 * de l'eau.
 */
import { chargerPiece } from '../../../lib/admin/donnees.mjs';

export async function GET({ params }) {
  const piece = await chargerPiece(params.id);
  if (!piece || !piece.contenu) return new Response('Pièce introuvable', { status: 404 });

  const octets = Buffer.from(String(piece.contenu), 'base64');
  // Le nom voyage dans un en-tête : un guillemet ou un retour à la ligne
  // dedans casserait l'en-tête, et les caractères non latins n'y passent pas.
  const nom = String(piece.nom || 'piece').replace(/["\\\r\n]/g, '_');
  return new Response(octets, {
    headers: {
      'Content-Type': piece.type_mime || 'application/octet-stream',
      'Content-Length': String(octets.length),
      'Content-Disposition': `attachment; filename="${nom}"; filename*=UTF-8''${encodeURIComponent(nom)}`,
      // Jamais mis en cache par un intermédiaire : c'est une pièce d'identité.
      'Cache-Control': 'private, no-store',
    },
  });
}
