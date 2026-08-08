/**
 * Ce qui se refuse dans un changement de code, avant d'interroger quoi que ce
 * soit.
 *
 * Sorti de la page pour une raison précise : **l'ordre des contrôles est la
 * seule chose qui compte ici**, et un ordre ne se relit pas, il s'éprouve.
 *
 * Une confirmation qui ne correspond pas est une faute de frappe, pas une
 * tentative d'intrusion. La compter comme un essai raté ferait de trois
 * maladresses une attente d'une demi-heure — et l'attente tomberait sur la
 * seule personne qui n'a rien fait de mal. Ces refus-là sont donc gratuits, et
 * ils passent avant la vérification du code actuel, qui, elle, se paie.
 */
import { codeTropSimple } from './session.mjs';

/**
 * Le refus qui ne coûte pas d'essai, ou `null` si le formulaire tient debout.
 *
 * @param {{actuel?: string, nouveau?: string, encore?: string}} saisie
 * @returns {string|null}
 */
export function soucisDeForme({ actuel = '', nouveau = '', encore = '' } = {}) {
  if (nouveau !== encore) return 'Les deux nouveaux codes diffèrent. Retapez-les.';

  const faible = codeTropSimple(nouveau);
  if (faible) return faible;

  // Après `codeTropSimple`, donc jamais sur deux champs vides : « le nouveau
  // code est l'ancien » n'aiderait personne à comprendre qu'il n'a rien tapé.
  if (actuel === nouveau) return 'Le nouveau code est l’ancien.';

  return null;
}
