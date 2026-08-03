/**
 * La route que consomme une application cliente.
 *
 *   GET /api/donnees/<cle>?filtre[colonne][op]=valeur&tri=colonne:asc&limite=50
 *   Authorization: Bearer tfb_…
 *
 * Quatre choses viennent du **jeton** et jamais de la requête : l'application,
 * le client, donc la base, et le droit de lire cet endpoint-là. C'est tout
 * l'argument : il n'y a aucun paramètre à falsifier, parce qu'il n'y a aucun
 * paramètre qui décide.
 *
 * Ce que la requête peut dire se limite à ce que l'endpoint déclare : un filtre
 * déjà prévu, un tri sur une colonne déjà autorisée, une limite déjà plafonnée.
 * Le reste est refusé plutôt qu'ignoré — un filtre inconnu qu'on laisserait
 * tomber rendrait plus de lignes que l'appelant n'en a demandé, et personne ne
 * s'en apercevrait avant de lire un chiffre faux.
 *
 * LES CODES DE RETOUR mentent volontairement d'un cran : un endpoint qui existe
 * mais n'est pas déclaré pour cette application répond 404, comme un endpoint
 * qui n'existe pas. Répondre 403 confirmerait son existence à qui n'y a pas
 * droit, et transformerait la bibliothèque en annuaire pour qui possède
 * n'importe quel jeton.
 */

import { endpointParCle } from '../../../lib/donnees/endpoints.mjs';
import {
  PLAFOND_DEBIT, debitDepasse, endpointAutorise, noterUsage, reconnaitreJeton,
} from '../../../lib/donnees/jetons.mjs';
import { DemandeRefusee, executerRessource, lireDemande } from '../../../lib/donnees/requete.mjs';

/** Le jeton voyage en en-tête, jamais dans l'URL : une URL se journalise. */
function jetonPresente(requete) {
  const brut = requete.headers.get('authorization') || '';
  const trouve = /^Bearer\s+(\S+)$/i.exec(brut.trim());
  return trouve ? trouve[1] : null;
}

function json(corps, statut = 200, entetes = {}) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Ni cache partagé ni cache navigateur : la réponse dépend du jeton, et
      // un intermédiaire qui la garderait la servirait au client suivant.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      // L'authentification est un en-tête, pas un cookie : une origine tierce
      // ne peut donc pas emprunter les droits du visiteur, et « * » n'ouvre
      // rien. C'est ce qui permet à une application installée sur son propre
      // domaine d'appeler cette route.
      'Access-Control-Allow-Origin': '*',
      ...entetes,
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET({ params, request, url }) {
  const presente = jetonPresente(request);
  if (!presente) {
    return json({ erreur: 'Jeton absent. Attendu : en-tête Authorization: Bearer tfb_…' }, 401,
      { 'WWW-Authenticate': 'Bearer' });
  }

  let jeton;
  try {
    jeton = await reconnaitreJeton(presente);
  } catch (err) {
    console.error(`[donnees] base injoignable : ${err.message}`);
    return json({ erreur: 'Service indisponible.' }, 503);
  }
  // Un seul message pour « inconnu », « révoqué » et « expiré » : distinguer
  // les trois dirait à qui essaie un jeton au hasard s'il a existé.
  if (!jeton) return json({ erreur: 'Jeton refusé.' }, 401, { 'WWW-Authenticate': 'Bearer' });

  if (debitDepasse(jeton.id)) {
    return json(
      { erreur: `Trop d’appels : ${PLAFOND_DEBIT.parMinute} par minute et par jeton.` },
      429, { 'Retry-After': '60' },
    );
  }

  const endpoint = await endpointParCle(String(params.cle));
  // Un endpoint en brouillon ou retiré n'existe pas pour une application.
  if (!endpoint) return json({ erreur: 'Endpoint inconnu.' }, 404);
  if (!(await endpointAutorise(endpoint.id, jeton.applicationId))) {
    return json({ erreur: 'Endpoint inconnu.' }, 404);
  }

  try {
    const demande = lireDemande(url, endpoint);
    // Le client vient du jeton. C'est la ligne qui compte dans ce fichier.
    const lignes = await executerRessource(endpoint, jeton.prospectId, demande);
    noterUsage(jeton.id);
    return json({
      cle: endpoint.cle,
      version: endpoint.version,
      lignes,
      // Dit sans détour que la limite a mordu : sans cela une application croit
      // avoir tout reçu et affiche un total faux.
      tronque: lignes.length >= demande.limite,
      limite: demande.limite,
    });
  } catch (err) {
    if (err instanceof DemandeRefusee) return json({ erreur: err.message }, err.statut);
    // Le message d'un pilote peut porter un hôte ou un identifiant : il reste
    // dans le journal du serveur, jamais dans la réponse.
    console.error(`[donnees] ${endpoint.cle} : ${err.message}`);
    return json({ erreur: 'Lecture impossible pour ce client.' }, 502);
  }
}
