/**
 * Le verrou d'essais de la connexion.
 *
 * Un code à six chiffres, c'est un million de combinaisons. Sans verrou, une
 * machine les épuise en quelques minutes, et le nombre de chiffres n'y change
 * rien — sept chiffres ne feraient que dix minutes au lieu d'une. Ce qui rend
 * un code court utilisable, ce n'est pas sa longueur : c'est **le nombre
 * d'essais qu'on accorde**.
 *
 * Cinq essais, puis une attente qui double à chaque échec supplémentaire. Une
 * personne qui se trompe deux fois ne s'en aperçoit pas ; une machine qui
 * essaie un million de codes met des siècles.
 *
 * EN MÉMOIRE, DONC PAR PROCESSUS. Un redémarrage remet les compteurs à zéro, et
 * plusieurs processus ne les partagent pas. Ce n'est pas un oubli : la console
 * tourne en un seul processus, et un verrou en base ajouterait une écriture à
 * chaque tentative — donc un levier pour saturer la base en échouant à se
 * connecter. Si la console passe un jour à plusieurs processus, c'est ce
 * fichier qu'il faudra reprendre, et lui seul.
 */

/** Essais tolérés avant que l'attente ne commence. */
const FRANCHISE = 5;

/** Première attente, doublée à chaque échec au-delà de la franchise. */
const ATTENTE_MS = 30_000;

/** Plafond : au-delà, l'attente n'augmente plus mais ne redescend pas. */
const ATTENTE_MAX_MS = 30 * 60_000;

/** Un échec isolé s'oublie : sinon un mois de fautes de frappe finirait par bloquer. */
const OUBLI_MS = 60 * 60_000;

const essais = new Map();

/** Qui essaie. Derrière un proxy, l'adresse vue par Node est celle du proxy. */
export function origine(requete, adresseDirecte = null) {
  const annonce = requete?.headers?.get?.('x-forwarded-for');
  if (annonce) return annonce.split(',')[0].trim();
  return adresseDirecte || 'inconnue';
}

function nettoyer(maintenant) {
  if (essais.size < 2000) return;
  for (const [cle, e] of essais) if (maintenant - e.dernier > OUBLI_MS) essais.delete(cle);
}

/**
 * Cette origine a-t-elle le droit d'essayer maintenant ?
 * @returns {{permis: boolean, attendreS: number, restants: number}}
 */
export function peutEssayer(cle, maintenant = Date.now()) {
  const e = essais.get(cle);
  if (!e) return { permis: true, attendreS: 0, restants: FRANCHISE };
  if (maintenant - e.dernier > OUBLI_MS) {
    essais.delete(cle);
    return { permis: true, attendreS: 0, restants: FRANCHISE };
  }
  if (e.n < FRANCHISE) return { permis: true, attendreS: 0, restants: FRANCHISE - e.n };

  const attente = Math.min(ATTENTE_MS * 2 ** (e.n - FRANCHISE), ATTENTE_MAX_MS);
  const reste = e.dernier + attente - maintenant;
  return reste > 0
    ? { permis: false, attendreS: Math.ceil(reste / 1000), restants: 0 }
    : { permis: true, attendreS: 0, restants: 1 };
}

/** Un essai raté. C'est lui qui allonge l'attente suivante. */
export function noterEchec(cle, maintenant = Date.now()) {
  const e = essais.get(cle);
  essais.set(cle, { n: (e?.n || 0) + 1, dernier: maintenant });
  nettoyer(maintenant);
}

/** Une réussite efface l'ardoise : le verrou vise les machines, pas les gens. */
export function noterReussite(cle) {
  essais.delete(cle);
}

export const REGLAGES_VERROU = { franchise: FRANCHISE, attenteMs: ATTENTE_MS, attenteMaxMs: ATTENTE_MAX_MS };

/** Pour les tests : repartir d'une ardoise propre. */
export function viderVerrou() {
  essais.clear();
}
