/**
 * Quand faut-il prévenir le commercial qu'une offre dort — fonction pure.
 *
 * Une relance qui part trop tôt est du bruit, et le bruit se coupe : au bout
 * de trois notifications inutiles, plus personne ne les lit, et celle qui
 * comptait passe avec les autres. La règle est donc étroite et se dit en une
 * phrase : on prévient **une fois** par période de silence, et seulement si
 * l'étape le demande.
 *
 * Le calcul est ici, séparé de la base et de l'envoi, parce que c'est la seule
 * partie qui peut se tromper sans qu'on s'en aperçoive — une relance qui ne
 * part pas ne fait pas de bruit non plus.
 */

/** Le nombre de jours entiers entre deux instants. */
export function joursEntre(debut, fin) {
  // `new Date(null)` vaut l'époque Unix, pas une date invalide : sans ce
  // garde-fou, une offre sans date compterait cinquante-six ans de silence et
  // se relancerait aussitôt.
  if (debut == null || fin == null) return 0;
  const a = new Date(debut).getTime();
  const b = new Date(fin).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86_400_000);
}

/**
 * Cette offre doit-elle réveiller son commercial ?
 *
 * @param {object} offre    Avec `etape`, `etape_le`, `relance_le`, `statut`.
 * @param {object} etape    L'étape en vigueur, avec `relance_active` et `relance_jours`.
 * @param {Date}   maintenant
 * @returns {{relancer: boolean, raison: string, dort: number}}
 *   `dort` est le nombre de jours depuis le dernier mouvement — l'écran
 *   l'affiche même quand aucune relance n'est due.
 */
export function aRelancer(offre, etape, maintenant = new Date()) {
  const depuis = offre?.etape_le || offre?.cree_le;
  const dort = depuis ? joursEntre(depuis, maintenant) : 0;
  const non = (raison) => ({ relancer: false, raison, dort });

  // Une offre figée n'attend plus rien de son commercial : elle est partie,
  // acceptée ou refusée, et la relancer serait lui demander de recontacter un
  // client qui a déjà tranché.
  if (offre?.statut === 'acceptee' || offre?.statut === 'refusee') return non('offre close');
  if (!etape) return non('sans étape');
  if (!etape.relance_active) return non('relance désactivée sur cette étape');

  const seuil = Number(etape.relance_jours) || 0;
  if (seuil <= 0) return non('aucun délai fixé');
  if (dort < seuil) return non(`${dort} j sur ${seuil}`);

  // Déjà relancé depuis le dernier mouvement : on ne répète pas. Le compteur
  // repart quand l'offre change d'étape, ce qui est le seul signe qu'il s'est
  // passé quelque chose.
  if (offre.relance_le && joursEntre(depuis, offre.relance_le) >= 0
      && new Date(offre.relance_le) >= new Date(depuis)) {
    return non('déjà relancée depuis le dernier mouvement');
  }

  return { relancer: true, raison: `${dort} j sans mouvement`, dort };
}

/**
 * La date de la prochaine relance, ou `null` s'il n'y en aura pas.
 *
 * Sert à l'écran, qui l'affiche à côté de l'offre : savoir qu'on sera prévenu
 * jeudi vaut mieux que de vérifier soi-même tous les jours.
 */
export function prochaineRelance(offre, etape) {
  if (!etape?.relance_active) return null;
  const seuil = Number(etape.relance_jours) || 0;
  if (seuil <= 0) return null;
  if (offre?.statut === 'acceptee' || offre?.statut === 'refusee') return null;
  const depuis = offre?.etape_le || offre?.cree_le;
  if (!depuis) return null;
  if (offre.relance_le && new Date(offre.relance_le) >= new Date(depuis)) return null;
  const quand = new Date(depuis);
  quand.setDate(quand.getDate() + seuil);
  return quand;
}
