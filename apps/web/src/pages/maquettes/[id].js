/**
 * La maquette d'une vue, servie depuis la base.
 *
 * Hors de `/admin`, et c'est délibéré : le client qui reçoit une offre n'a pas
 * de compte, et lui en demander un pour regarder trois captures serait le
 * meilleur moyen qu'il ne les regarde jamais. Le contrôle est le même que pour
 * l'annexe — une clé signée, liée à la référence **et** à la version.
 *
 * La console passe par la même porte : elle sait fabriquer la clé, et deux
 * routes qui servent le même fichier finiraient par diverger sur les en-têtes
 * de sécurité, c'est-à-dire là où il ne faut pas.
 *
 * Sans clé valable, 404 et non 403 : confirmer qu'une maquette existe serait
 * déjà en dire trop.
 */
import { createHash } from 'node:crypto';

import { chargerOffre } from '../../lib/admin/donnees.mjs';
import { chargerMaquette, listerMaquettes } from '../../lib/admin/maquettes.mjs';
import { cleAnnexeValide } from '../../lib/admin/session.mjs';

export async function GET({ params, url, request }) {
  const introuvable = () => new Response('Introuvable', { status: 404 });

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return introuvable();

  const reference = url.searchParams.get('reference');
  const version = url.searchParams.get('version') || '1';
  if (!cleAnnexeValide(reference, version, url.searchParams.get('cle'))) return introuvable();

  let maquette = null;
  try {
    const offre = await chargerOffre(reference, version);
    if (!offre) return introuvable();
    // La clé ouvre **cette** offre : sans ce contrôle, une clé valable
    // donnerait accès aux maquettes de toutes les autres en changeant le
    // numéro dans l'adresse.
    const siennes = await listerMaquettes(offre.id);
    if (!siennes.some((m) => Number(m.id) === id)) return introuvable();
    maquette = await chargerMaquette(id);
  } catch (err) {
    console.error(`[maquettes] base injoignable : ${err.message}`);
    return new Response('Indisponible', { status: 503 });
  }
  if (!maquette) return introuvable();

  const empreinte = `"${createHash('sha256').update(maquette.octets).digest('base64url').slice(0, 22)}"`;
  if (request.headers.get('if-none-match') === empreinte) {
    return new Response(null, { status: 304, headers: { ETag: empreinte } });
  }

  return new Response(maquette.octets, {
    headers: {
      // Le type reconnu à l'enregistrement d'après les octets, jamais celui
      // qu'annonçait le navigateur qui a déposé le fichier.
      'Content-Type': maquette.type,
      'Content-Length': String(maquette.octets.length),
      ETag: empreinte,
      // Privé : une maquette n'est pas publique, même si son adresse est
      // devinable. Aucun intermédiaire ne doit la garder.
      'Cache-Control': 'private, max-age=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
