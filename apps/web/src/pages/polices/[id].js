/**
 * Une police importée d'un client, servie depuis la base.
 *
 * Comme les logos, elle ne vit pas dans `public/`, qui est figé au build : un
 * fichier déposé depuis la console n'y survivrait pas au déploiement suivant.
 *
 * Les mêmes précautions qu'ailleurs pour un fichier téléversé — le type est
 * celui **reconnu aux octets** à l'enregistrement, `nosniff` empêche le
 * navigateur de réinterpréter, et la politique de sécurité neutralise ce qui
 * s'exécuterait si un format finissait par le permettre.
 *
 * L'adresse est publique et devinable, et c'est assumé : une police est un
 * dessin de caractères, pas une donnée du client. La mettre derrière la clé de
 * la page charte obligerait à signer chaque requête de police d'une
 * application, pour protéger quelque chose qui n'a pas besoin de l'être.
 */

import { createHash } from 'node:crypto';
import { chargerPolice } from '../../lib/charte/polices.mjs';

export async function GET({ params, request }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return new Response('Introuvable', { status: 404 });

  let police = null;
  try {
    police = await chargerPolice(id);
  } catch (err) {
    console.error(`[polices] base injoignable : ${err.message}`);
    return new Response('Indisponible', { status: 503 });
  }
  if (!police) return new Response('Introuvable', { status: 404 });

  const empreinte = `"${createHash('sha256').update(police.octets).digest('base64url').slice(0, 22)}"`;
  if (request.headers.get('if-none-match') === empreinte) {
    return new Response(null, { status: 304, headers: { ETag: empreinte } });
  }

  return new Response(police.octets, {
    headers: {
      'Content-Type': police.type,
      'Content-Length': String(police.octets.length),
      ETag: empreinte,
      // Long, parce qu'un fichier de police ne change pas : le remplacer crée
      // une nouvelle ligne, donc une nouvelle adresse.
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
