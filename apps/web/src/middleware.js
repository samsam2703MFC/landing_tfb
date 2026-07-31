/**
 * Garde d'accès à la console.
 *
 * Tout ce qui est sous /admin exige une session valide, sauf la page de
 * connexion elle-même. Le contrôle est fait ici plutôt que dans chaque page :
 * une page ajoutée demain est protégée sans qu'on ait à y penser.
 *
 * Le site public traverse ce middleware sans rien faire.
 */

import { NOM_COOKIE, consoleActive, jetonValide } from './lib/admin/session.mjs';

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

export async function onRequest(contexte, suivant) {
  const chemin = cheminInterne(contexte.url.pathname);
  if (!chemin.startsWith('/admin')) return suivant();

  if (origineEtrangere(contexte.request)) {
    return new Response('Soumission refusée : origine étrangère au site.', { status: 403 });
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

  if (jetonValide(contexte.cookies.get(NOM_COOKIE)?.value)) return suivant();

  // On mémorise la page demandée pour y revenir après la connexion.
  const retour = encodeURIComponent(chemin);
  return contexte.redirect(`${BASE}/admin/connexion?retour=${retour}`, 302);
}
