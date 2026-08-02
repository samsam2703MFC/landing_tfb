/**
 * Le bon pour accord du client sur les vues personnalisées.
 *
 * Une vue se vend en une ligne : « Tableau des marges par boutique ». Le
 * commercial voit un tableau, le client imagine un graphique, et l'écart
 * n'apparaît qu'à la livraison — au moment où il coûte le plus cher. Une
 * capture, même faite à la main dans un tableur, coupe court ; un accord daté
 * dessus rend la discussion inutile trois mois plus tard.
 *
 * Tout tient dans une idée : **ce n'est pas le nom tapé qui fait l'accord,
 * c'est l'empreinte de ce qui était à l'écran au moment du clic.** Le nom dit
 * qui ; l'empreinte dit sur quoi. Sans elle, remplacer une capture après la
 * signature ne laisserait aucune trace, et le visa ne vaudrait rien.
 *
 * Rien ici ne touche à la base ni au réseau : on donne des vues et des
 * maquettes, on obtient une chaîne. C'est ce qui rend la chose vérifiable.
 */
import { createHash } from 'node:crypto';

/** Le condensé d'une image déposée. C'est ce qui entre dans l'empreinte. */
export function empreinteImage(contenu) {
  const brut = String(contenu || '');
  if (!brut) return '';
  return createHash('sha256').update(brut).digest('hex');
}

/**
 * La description canonique de ce qui est soumis à l'accord.
 *
 * Lisible exprès. Une empreinte qu'on ne peut pas expliquer ne convainc
 * personne : en cas de désaccord, on doit pouvoir remettre ce texte sous les
 * yeux du client et lui montrer que c'est bien ce qu'il a validé.
 *
 * Ce qui entre : le rang, le nombre, la description, et le condensé de la
 * capture. Ce qui n'entre pas : la note interne — elle ne part jamais chez le
 * client, elle ne peut donc pas faire partie de son accord — ni les montants,
 * qui vivent sur l'offre et ont leur propre acceptation.
 */
export function texteAValider(vues = [], maquettes = []) {
  const parRang = new Map(maquettes.map((m) => [Number(m.rang), m]));
  return (vues || [])
    .map((v, i) => {
      const m = parRang.get(i);
      const capture = m ? (m.empreinte || empreinteImage(m.contenu)) : 'sans capture';
      const nombre = Number(v.nombre) || 0;
      const quoi = String(v.note || '').trim() || 'Vue';
      return `${i + 1}. ${nombre} × ${quoi} — ${capture}`;
    })
    .join('\n');
}

/** L'empreinte de ce texte. Trente-deux octets, et toute la valeur du visa. */
export function empreinteDuFlux(vues = [], maquettes = []) {
  return createHash('sha256').update(texteAValider(vues, maquettes), 'utf8').digest('hex');
}

/**
 * Le visa correspond-il encore à ce qu'on affiche ?
 *
 * Le cas qui compte n'est pas la fraude, c'est la mégarde : une vue ajoutée
 * après l'accord, une capture redéposée « pour la mettre à jour ». Les deux
 * arrivent, et sans ce contrôle personne ne s'en apercevrait avant la
 * livraison.
 *
 * On rend `perime` plutôt que « invalide » : le visa reste vrai pour ce qu'il
 * a signé. C'est le flux qui a bougé.
 */
export function visaAJour(visa, vues = [], maquettes = []) {
  if (!visa) return { signe: false, perime: false };
  const attendue = empreinteDuFlux(vues, maquettes);
  return {
    signe: true,
    perime: String(visa.empreinte || '') !== attendue,
    empreinte_signee: String(visa.empreinte || ''),
    empreinte_actuelle: attendue,
  };
}

/**
 * Ce qui empêche de demander l'accord.
 *
 * On ne fait pas signer un flux vide, ni un flux dont on n'a pas montré les
 * écrans : un accord sur une liste de phrases est exactement le malentendu
 * qu'on cherchait à éviter.
 *
 * Une seule capture manquante ne bloque pas — parfois un écran est trop
 * évident pour mériter une maquette — mais l'écran le dit, et le client le
 * voit aussi.
 */
export function empechementsVisa(vues = [], maquettes = []) {
  const raisons = [];
  const utiles = (vues || []).filter((v) => String(v.note || '').trim() || Number(v.nombre) > 0);
  if (utiles.length === 0) {
    raisons.push("Aucune vue à valider : commencez par en décrire au moins une.");
    return raisons;
  }
  const rangs = new Set(maquettes.map((m) => Number(m.rang)));
  const sans = (vues || []).map((_, i) => i).filter((i) => !rangs.has(i));
  if (sans.length === vues.length) {
    raisons.push('Aucune capture déposée : un accord sur du texte seul ne prévient aucun malentendu.');
  }
  return raisons;
}

/** Les vues sans maquette, pour le dire une fois plutôt qu'à la livraison. */
export function vuesSansMaquette(vues = [], maquettes = []) {
  const rangs = new Set(maquettes.map((m) => Number(m.rang)));
  return (vues || [])
    .map((v, i) => ({ rang: i, note: String(v.note || '').trim() || 'Vue' }))
    .filter((v) => !rangs.has(v.rang));
}

/**
 * Le nom d'un signataire tient-il debout ?
 *
 * Volontairement peu exigeant. On ne cherche pas à prouver une identité — le
 * lien signé qui a mené jusqu'ici s'en charge — seulement à empêcher un accord
 * signé « x » ou « ok », qui ne servirait à personne le jour d'un litige.
 */
export function nomDeSignataire(saisie) {
  const nom = String(saisie || '').trim().replace(/\s+/g, ' ');
  if (nom.length < 3) return null;
  // Au moins une lettre : « ... » ou « 123 » ne sont pas des noms.
  if (!/\p{L}/u.test(nom)) return null;
  return nom.slice(0, 160);
}
