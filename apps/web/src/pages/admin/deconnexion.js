/**
 * Déconnexion : on efface le cookie de session et on revient à la porte.
 * En POST seulement — un simple lien visité par un préchargement ne doit pas
 * déconnecter l'utilisateur.
 */

import { NOM_COOKIE, cheminCookie } from '../../lib/admin/session.mjs';

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');

export async function POST({ cookies, redirect }) {
  cookies.delete(NOM_COOKIE, { path: cheminCookie() });
  return redirect(`${BASE}/admin/connexion`, 302);
}
