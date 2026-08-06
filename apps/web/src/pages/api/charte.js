/**
 * La charte du client, telle qu'une de ses applications la reçoit.
 *
 *   GET /api/charte
 *   Authorization: Bearer tfb_…
 *
 * Même principe que `/api/donnees/<cle>`, et c'est délibéré : **le client vient
 * du jeton, jamais de la requête.** Il n'y a donc aucun identifiant à falsifier
 * pour lire la charte d'un autre — il n'y a aucun paramètre du tout.
 *
 * Ce que l'application reçoit :
 *
 *   · `variables` — les valeurs résolues du registre, pour qui veut piloter
 *     autre chose que du CSS : une barre de statut Android, un thème natif ;
 *   · `css` — la feuille prête à poser, `@font-face` compris, pour qui veut
 *     seulement l'insérer et ne rien décider ;
 *   · `logo` — le chemin, ou `null`.
 *
 * Les deux formes sortent de la **même** résolution. Une application qui lit
 * `variables` et une autre qui pose `css` ne peuvent pas diverger : c'est le
 * même appel, la même composition, à la même seconde.
 *
 * **La version publiée, jamais le brouillon.** Un brouillon est un travail en
 * cours ; le servir ferait changer les couleurs d'une application pendant qu'on
 * les essaie dans la console.
 *
 * La composition est celle de la page client — défauts du registre, puis charte
 * maison, puis surcharges du client. Un client sans surcharge sert exactement la
 * charte maison, ce qui est le cas sain et non une réponse vide.
 */
import { MAISON, charteMaison, chartePubliee } from '../../lib/admin/charte.mjs';
import { valeursResolues } from '../../lib/charte/registre.mjs';
import { cssCharte, facesCharte, logoCharte } from '../../lib/charte/theme.mjs';
import { listerPolices } from '../../lib/charte/polices.mjs';
import { reconnaitreJeton, noterUsage } from '../../lib/donnees/jetons.mjs';

/** Le jeton voyage en en-tête, jamais dans l'URL : une URL se journalise. */
function jetonPresente(requete) {
  const brut = requete.headers.get('authorization') || '';
  const trouve = /^Bearer\s+(\S+)$/i.exec(brut.trim());
  return trouve ? trouve[1] : null;
}

/**
 * L'adresse absolue de ce serveur, préfixe de montage compris.
 *
 * Les `@font-face` doivent porter une URL absolue. La page client, servie par
 * ce même serveur, se contente d'un chemin — mais l'application qui consomme
 * cette route vit sur SON domaine : `/polices/12` l'enverrait chercher la
 * police chez elle, où il n'y a rien. La feuille se poserait sans erreur et le
 * texte s'afficherait dans la police de repli, ce qui est exactement le genre
 * de panne dont personne ne fait un ticket.
 *
 * Apache termine le TLS et parle en clair au serveur Node : l'URL vue ici est
 * en http:// même quand le navigateur est en https://. Seul X-Forwarded-Proto
 * le dit — même raisonnement que `chiffre()` dans la session.
 */
function origineAbsolue(requete, url) {
  const annonce = requete.headers.get('x-forwarded-proto');
  const schema = annonce ? annonce.split(',')[0].trim() : url.protocol.replace(':', '');
  const hote = requete.headers.get('host') || url.host;
  const prefixe = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  return `${schema}://${hote}${prefixe}`;
}

function json(corps, statut = 200) {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // La réponse dépend du jeton : un intermédiaire qui la garderait
      // servirait les couleurs d'un client au suivant.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      // L'authentification est un en-tête et non un cookie, donc « * » n'ouvre
      // rien : une origine tierce ne peut pas emprunter les droits du visiteur.
      // C'est ce qui permet à une application installée sur son propre domaine
      // d'appeler cette route.
      'Access-Control-Allow-Origin': '*',
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

export async function GET({ request, url }) {
  const presente = jetonPresente(request);
  if (!presente) {
    return json({ erreur: 'Jeton absent. Attendu : Authorization: Bearer tfb_…' }, 401);
  }

  const jeton = await reconnaitreJeton(presente).catch(() => null);
  if (!jeton) return json({ erreur: 'Jeton inconnu, révoqué ou expiré.' }, 401);

  // Le prospect « 0 » porte la charte maison et n'appartient à personne. Un
  // jeton qui le désignerait servirait les défauts à tout le monde : refusé
  // plutôt que servi, parce que ce serait le signe d'un jeton mal posé.
  if (!Number.isInteger(jeton.prospectId) || jeton.prospectId === MAISON) {
    return json({ erreur: 'Ce jeton n’est rattaché à aucun client.' }, 403);
  }

  const [publie, maison, polices] = await Promise.all([
    chartePubliee(jeton.prospectId),
    charteMaison(),
    listerPolices(jeton.prospectId).catch(() => []),
  ]);

  const valeurs = valeursResolues(publie.donnees, maison.donnees);

  // L'usage est noté comme sur les données : un jeton qui n'a jamais servi et
  // un jeton qu'on a oublié de révoquer se ressemblent, et seule la date les
  // distingue. En sourdine — un compteur qui échoue ne doit pas priver une
  // application de ses couleurs.
  await noterUsage(jeton.id).catch(() => undefined);

  return json({
    client: jeton.prospectId,
    version: publie.version ?? 0,
    publie_le: publie.majLe ?? null,
    variables: valeurs,
    logo: logoCharte(valeurs),
    // Les @font-face d'abord : une police déclarée après son usage se charge
    // quand même, mais l'ordre rend la feuille lisible pour qui l'inspecte.
    // L'origine est absolue — voir `origineAbsolue`.
    css: `${facesCharte(polices, origineAbsolue(request, url))}\n${cssCharte(valeurs, polices)}`,
  });
}
