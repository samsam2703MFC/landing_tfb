/**
 * Deux gardes, une seule porte d'entrée.
 *
 * 1. La console : tout ce qui est sous /admin exige une session valide, sauf
 *    la page de connexion. Le contrôle est fait ici plutôt que dans chaque
 *    page — une page ajoutée demain est protégée sans qu'on y pense.
 *
 * 2. La langue : `/en/modules/webshop` sert la même page que
 *    `/modules/webshop`, en anglais. Plutôt que de dupliquer chaque gabarit
 *    sous `[langue]/`, on retire le préfixe ici et on range la langue dans
 *    `Astro.locals` : les pages restent uniques, et une page ajoutée demain
 *    est traduite sans qu'on y pense non plus.
 *
 * Une langue non publiée ne se sert pas : `/de/` répond 404 tant que
 * l'allemand n'est pas coché dans la console. Mieux vaut une page absente
 * qu'une page qui promet une traduction inexistante.
 *
 * En `.js` et non `.mjs` : Astro ne cherche le middleware que sous
 * `src/middleware.{js,ts}`. C'est une contrainte du cadre, pas un choix.
 */

import { chargerLangues } from './lib/db.mjs';
import { NOM_COOKIE, cheminAutorise, consoleActive, lireJeton } from './lib/admin/session.mjs';
import { utilisateurParId } from './lib/admin/donnees.mjs';

/** Préfixe de montage, sans barre oblique finale. */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

/** Méthodes qui ne modifient rien : pas de contrôle d'origine à faire. */
const METHODES_SURES = ['GET', 'HEAD', 'OPTIONS'];

/** Le chemin demandé, débarrassé du préfixe de montage. */
function cheminInterne(pathname) {
  if (BASE && pathname.startsWith(BASE)) return pathname.slice(BASE.length) || '/';
  return pathname;
}

/**
 * Protection CSRF, faite à la main parce que le contrôle natif d'Astro compare
 * des URL complètes : derrière un proxy qui termine le TLS, le protocole vu
 * par le serveur Node (http) ne peut jamais correspondre à celui annoncé par
 * le navigateur (https).
 *
 * On compare donc les seuls noms d'hôte. Un site tiers qui posterait vers la
 * console porterait son propre hôte dans « Origin » et serait refusé ; un
 * navigateur qui n'envoie pas cet en-tête sur une soumission de formulaire
 * n'existe plus.
 */
function origineEtrangere(requete) {
  if (METHODES_SURES.includes(requete.method)) return false;

  const origine = requete.headers.get('origin');
  if (!origine) return true;

  const attendu = requete.headers.get('x-forwarded-host') || requete.headers.get('host');
  if (!attendu) return true;

  try {
    // L'en-tête peut lister plusieurs hôtes quand les proxys s'enchaînent :
    // le premier est celui vu par le navigateur.
    const premier = attendu.split(',')[0].trim();
    return new URL(origine).host !== premier;
  } catch {
    return true;
  }
}

/**
 * Retire le préfixe de langue et le range dans `locals`.
 *
 * @returns {Promise<{redirection?: Response, versChemin?: string}>}
 *   `redirection` quand il faut renvoyer ailleurs, `versChemin` quand la page
 *   à servir n'est pas celle demandée. Rien quand la requête suit son cours.
 */
async function reglerLangue(contexte, chemin) {
  contexte.locals.langue = 'fr';
  contexte.locals.langues = [];

  let langues = [];
  try {
    langues = (await chargerLangues()).filter((l) => l.publiee);
  } catch {
    // Base injoignable : on sert le français, qui est dans les gabarits.
    return {};
  }
  contexte.locals.langues = langues;

  const trouve = chemin.match(/^\/([a-z]{2})(\/.*|$)/);
  if (!trouve) return {};

  const langue = langues.find((l) => l.code === trouve[1]);
  // Deux lettres qui ne sont pas une langue publiée : ce n'est pas un
  // préfixe, c'est peut-être une vraie page. On laisse passer.
  if (!langue) return {};

  const reste = trouve[2] || '/';
  // La langue par défaut n'a pas de préfixe : `/fr/` renvoie vers `/`, pour
  // qu'une page n'existe pas à deux adresses.
  if (langue.defaut) return { redirection: contexte.redirect(`${BASE}${reste}`, 301) };

  contexte.locals.langue = langue.code;
  contexte.locals.rtl = Boolean(langue.rtl);
  return { versChemin: `${BASE}${reste}${contexte.url.search}` };
}

export async function onRequest(contexte, suivant) {
  const chemin = cheminInterne(contexte.url.pathname);

  // Le contrôle d'origine s'applique à **toute** soumission, pas seulement à
  // la console. L'annexe d'une offre en reçoit une : le client y donne son
  // bon pour accord sur les écrans sur mesure, hors de `/admin`, sans
  // session. Sans ce contrôle, un site tiers pourrait faire signer cet accord
  // au client à son insu — et un accord obtenu ainsi ne vaudrait rien tout en
  // ayant l'air valable, ce qui est pire que pas d'accord du tout.
  if (origineEtrangere(contexte.request)) {
    return new Response('Soumission refusée : origine étrangère au site.', { status: 403 });
  }

  if (!chemin.startsWith('/admin')) {
    // La console reste en français : elle s'adresse à l'équipe, pas au marché.
    const { redirection, versChemin } = await reglerLangue(contexte, chemin);
    if (redirection) return redirection;
    // `next(url)` et non `rewrite(url)` : le second rejoue la chaîne de
    // middleware sur la nouvelle URL, qui n'a plus de préfixe — la langue
    // qu'on vient de poser serait aussitôt remise à « fr ».
    return versChemin ? suivant(versChemin) : suivant();
  }

  // Sans mot de passe configuré, la console n'existe pas. Mieux vaut la
  // refuser franchement que la servir ouverte.
  if (!consoleActive()) {
    return new Response(
      "Console indisponible : la variable d'environnement ADMIN_PASSWORD n'est pas renseignée sur le serveur.",
      { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  if (chemin === '/admin/connexion') return suivant();

  const session = lireJeton(contexte.cookies.get(NOM_COOKIE)?.value);
  if (!session) {
    // On mémorise la page demandée pour y revenir après la connexion.
    const retour = encodeURIComponent(chemin);
    return contexte.redirect(`${BASE}/admin/connexion?retour=${retour}`, 302);
  }

  // Le rôle vient du cookie signé — aucune requête ne dépend d'un aller-retour
  // en base pour savoir ce qu'elle a le droit de faire. Le nom, lui, est relu :
  // il change sans qu'on veuille invalider la session, et une console qui
  // affiche un nom périmé induit en erreur sur qui signe l'offre.
  contexte.locals.session = session;
  if (!session.secours) {
    try {
      const compte = await utilisateurParId(session.id);
      if (!compte || !compte.actif) {
        // Compte supprimé ou désactivé pendant la session : on ferme tout de
        // suite plutôt que d'attendre l'expiration du cookie.
        contexte.cookies.delete(NOM_COOKIE, { path: BASE || '/' });
        return contexte.redirect(`${BASE}/admin/connexion`, 302);
      }
      contexte.locals.session = { ...session, nom: compte.nom, identifiant: compte.identifiant };
    } catch {
      // Base injoignable : la session reste valable, l'écran dira lui-même que
      // la base ne répond pas.
    }
  }

  if (!cheminAutorise(chemin, session.role)) {
    return new Response(
      "Cet écran est réservé à l'administration. Votre compte est un compte commercial.",
      { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  return suivant();
}
