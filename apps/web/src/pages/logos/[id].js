/**
 * Le logo d'un réseau client, servi depuis la base.
 *
 * Les logos ne vivent pas dans `public/`, qui est figé au build : un fichier
 * déposé depuis la console n'y survivrait pas au déploiement suivant. Ils sont
 * donc stockés en base et rendus ici.
 *
 * Trois précautions, parce qu'on sert un fichier téléversé :
 *
 *   · le type renvoyé est celui **reconnu à l'enregistrement** d'après les
 *     octets du fichier, jamais celui annoncé par le navigateur ;
 *   · `X-Content-Type-Options: nosniff` empêche le navigateur de redevenir
 *     malin et d'interpréter l'image comme autre chose ;
 *   · `Content-Security-Policy: default-src 'none'` neutralise ce qui
 *     s'exécuterait si un format finissait par le permettre.
 *
 * L'ETag est l'empreinte du contenu : changer le logo change l'adresse
 * effective sans qu'on ait à inventer un numéro de version.
 */

import { createHash } from 'node:crypto';
import { chargerLogoClient } from '../../lib/admin/donnees.mjs';

export async function GET({ params, request }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return new Response('Introuvable', { status: 404 });

  let logo = null;
  try {
    logo = await chargerLogoClient(id);
  } catch (err) {
    console.error(`[logos] base injoignable : ${err.message}`);
    return new Response('Indisponible', { status: 503 });
  }
  if (!logo) return new Response('Introuvable', { status: 404 });

  const empreinte = `"${createHash('sha256').update(logo.octets).digest('base64url').slice(0, 22)}"`;
  if (request.headers.get('if-none-match') === empreinte) {
    return new Response(null, { status: 304, headers: { ETag: empreinte } });
  }

  return new Response(logo.octets, {
    headers: {
      'Content-Type': logo.type,
      'Content-Length': String(logo.octets.length),
      ETag: empreinte,
      // Court côté navigateur, revalidé ensuite : un logo remplacé dans la
      // console doit se voir le jour même, pas dans un an.
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
