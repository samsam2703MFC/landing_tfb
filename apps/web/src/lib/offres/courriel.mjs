/**
 * L'envoi d'une offre au client.
 *
 * Le serveur n'a **aucun service d'envoi** : ni SMTP, ni passerelle. Plutôt
 * que d'inventer une expédition qui n'aurait pas lieu, ce module fait deux
 * choses honnêtes :
 *
 *   · il construit le message — destinataire, sujet, corps — depuis le
 *     gabarit modifiable dans la console ;
 *   · il le remet à un `ServiceCourriel`, dont la seule implémentation
 *     disponible aujourd'hui **journalise** au lieu d'expédier.
 *
 * L'écran le dit en clair au commercial. Une offre marquée « envoyée » qui
 * n'est jamais partie serait pire qu'une offre restée en brouillon : elle se
 * relit dans la liste comme un travail fait.
 *
 * Pour un envoi réel, il suffit d'écrire un second service qui respecte la
 * même interface — `nodemailer` est le candidat évident, mais c'est une
 * dépendance à ajouter, et ce n'est pas à ce fichier d'en décider.
 */

/**
 * @typedef {object} Message
 * @property {string} destinataire
 * @property {string} sujet
 * @property {string} corps
 */

/**
 * @typedef {object} ServiceCourriel
 * @property {string} nom          Ce qui sera dit au commercial.
 * @property {boolean} expedie     Faux si le message ne part pas vraiment.
 * @property {(m: Message) => Promise<{trace: string}>} envoyer
 */

/**
 * Le service qui écrit dans le journal du service et ne poste rien.
 *
 * Le corps du message y figure entier : c'est le seul moyen, aujourd'hui, de
 * retrouver ce qu'un commercial croyait avoir envoyé.
 */
export const SERVICE_JOURNAL = {
  nom: 'journal du serveur',
  expedie: false,
  async envoyer(message) {
    const trace = [
      '─── COURRIEL NON EXPÉDIÉ (aucun service configuré) ───',
      `À      : ${message.destinataire}`,
      `Sujet  : ${message.sujet}`,
      '',
      message.corps,
      '──────────────────────────────────────────────────────',
    ].join('\n');
    console.log(trace);
    return { trace };
  },
};

/**
 * Le service en vigueur.
 *
 * Un seul aujourd'hui. La fonction existe pour que l'appelant n'ait jamais à
 * choisir : le jour où un vrai service arrive, c'est ici qu'il se branche, et
 * nulle part ailleurs.
 */
export function serviceCourriel() {
  return SERVICE_JOURNAL;
}

/** Une date écrite comme dans une lettre. */
function jour(valeur, langue = 'fr') {
  if (!valeur) return '—';
  const locale = { fr: 'fr-BE', nl: 'nl-BE', en: 'en-IE' }[langue] || 'fr-BE';
  return new Date(valeur).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Les intitulés du récapitulatif, dans la langue de l'offre. */
const MOTS = {
  fr: { unique: 'À la signature', mensuel: 'Par mois', annuel: 'Par an', ht: 'Hors taxes', tva: 'TVA', total: 'Total', remise: 'Remise' },
  nl: { unique: 'Bij ondertekening', mensuel: 'Per maand', annuel: 'Per jaar', ht: 'Excl. btw', tva: 'Btw', total: 'Totaal', remise: 'Korting' },
  en: { unique: 'On signature', mensuel: 'Per month', annuel: 'Per year', ht: 'Excl. VAT', tva: 'VAT', total: 'Total', remise: 'Discount' },
};

/**
 * Le récapitulatif chiffré, en texte brut.
 *
 * Un tableau HTML dans un courriel se lit mal une fois sur deux ; du texte
 * aligné se lit partout. Les trois rythmes restent séparés, et un rythme sans
 * ligne n'apparaît pas — dans une lettre, une colonne vide n'apporte rien.
 *
 * @param {object} offre
 * @param {object} resultat  Ce que `calculerOffre` a rendu.
 * @param {(cents: number) => string} formater
 */
export function recapTexte(offre, resultat, formater) {
  const mots = MOTS[offre.langue] || MOTS.fr;
  const lignes = [];

  for (const [cle, seau] of Object.entries(resultat.seaux)) {
    if (seau.lignes.length === 0) continue;
    lignes.push(`${mots[cle].toUpperCase()}`);
    for (const l of seau.lignes) {
      const quantite = l.quantite > 1 ? ` × ${l.quantite}` : '';
      lignes.push(`  ${l.libelle}${quantite}   ${formater(l.total_cents)}`);
    }
    if (seau.remise > 0) lignes.push(`  ${mots.remise}   − ${formater(seau.remise)}`);
    lignes.push(`  ${mots.ht}   ${formater(seau.ht)}`);
    if (!resultat.exoneree) lignes.push(`  ${mots.tva}   ${formater(seau.tva)}`);
    lignes.push(`  ${mots.total}   ${formater(seau.ttc)}`);
    lignes.push('');
  }

  // Le geste commercial se dit dans la lettre, pas seulement à l'écran.
  if (resultat.offert && resultat.offert.ttc > 0) {
    const m = resultat.offert.mois;
    lignes.push(
      `${m} ${m > 1 ? 'mois offerts' : 'mois offert'} sur l'abonnement, soit ${formater(resultat.offert.ttc)} non facturés.`,
      '',
    );
  }
  if (resultat.exoneree && offre.tva_mention) lignes.push(offre.tva_mention, '');
  return lignes.join('\n').trimEnd();
}

/**
 * Remplace les jetons `{nom}` d'un gabarit.
 *
 * Un jeton inconnu est **laissé tel quel** plutôt que remplacé par du vide :
 * un `{clietn}` mal orthographié doit se voir dans l'aperçu, pas disparaître
 * en silence pour réapparaître comme un trou dans la lettre du client.
 */
export function remplacer(gabarit, valeurs) {
  return String(gabarit || '').replace(/\{(\w+)\}/g, (entier, cle) =>
    Object.prototype.hasOwnProperty.call(valeurs, cle) ? String(valeurs[cle] ?? '') : entier,
  );
}

/**
 * Construit le message à partir de l'offre et des gabarits.
 *
 * @returns {Message & {jetons: object}} Les jetons sont rendus aussi : l'écran
 *   d'aperçu les liste, ce qui évite d'aller les chercher dans un commentaire.
 */
export function construireCourriel({ offre, resultat, gabarits, formater }) {
  const jetons = {
    reference: offre.reference,
    version: String(offre.version),
    client: offre.prospect?.raison_sociale || '',
    contact: offre.prospect?.contact_nom || '',
    commercial: offre.auteur?.nom || '',
    valide_jusqu_au: jour(offre.valide_jusqu_au, offre.langue),
    recapitulatif: recapTexte(offre, resultat, formater),
  };
  return {
    destinataire: offre.prospect?.contact_email || '',
    sujet: remplacer(gabarits.sujet, jetons),
    corps: remplacer(gabarits.corps, jetons),
    jetons,
  };
}
