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

import { locale } from './calcul.mjs';

/** Une date écrite comme dans une lettre. */
function jour(valeur, langue = 'fr') {
  if (!valeur) return '—';
  return new Date(valeur).toLocaleDateString(locale(langue), { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Les intitulés du récapitulatif, dans la langue de l'offre.
 *
 * Les neuf langues déclarées du site y figurent : une offre ne peut sortir
 * que dans une langue publiée, et une langue publiée doit pouvoir produire un
 * devis lisible. Une langue absente retombe sur le français plutôt que sur
 * des clés techniques.
 *
 * `offert` sert au geste commercial, qui n'est pas une remise.
 */
const MOTS = {
  fr: { unique: 'À la signature', mensuel: 'Par mois', annuel: 'Par an', ht: 'Hors taxes', tva: 'TVA', total: 'Total', remise: 'Remise', offert: 'offert(s) sur l’abonnement, soit' },
  en: { unique: 'On signature', mensuel: 'Per month', annuel: 'Per year', ht: 'Excl. VAT', tva: 'VAT', total: 'Total', remise: 'Discount', offert: 'free on the subscription, i.e.' },
  nl: { unique: 'Bij ondertekening', mensuel: 'Per maand', annuel: 'Per jaar', ht: 'Excl. btw', tva: 'Btw', total: 'Totaal', remise: 'Korting', offert: 'gratis op het abonnement, ofwel' },
  de: { unique: 'Bei Unterzeichnung', mensuel: 'Pro Monat', annuel: 'Pro Jahr', ht: 'Netto', tva: 'MwSt.', total: 'Gesamt', remise: 'Rabatt', offert: 'kostenlos im Abonnement, also' },
  it: { unique: 'Alla firma', mensuel: 'Al mese', annuel: "All'anno", ht: 'Imponibile', tva: 'IVA', total: 'Totale', remise: 'Sconto', offert: 'in omaggio sull’abbonamento, ossia' },
  es: { unique: 'A la firma', mensuel: 'Al mes', annuel: 'Al año', ht: 'Base imponible', tva: 'IVA', total: 'Total', remise: 'Descuento', offert: 'gratis en la suscripción, es decir' },
  pl: { unique: 'Przy podpisaniu', mensuel: 'Miesięcznie', annuel: 'Rocznie', ht: 'Netto', tva: 'VAT', total: 'Razem', remise: 'Rabat', offert: 'gratis w abonamencie, czyli' },
  uk: { unique: 'При підписанні', mensuel: 'Щомісяця', annuel: 'Щороку', ht: 'Без ПДВ', tva: 'ПДВ', total: 'Разом', remise: 'Знижка', offert: 'безкоштовно за передплатою, тобто' },
  ru: { unique: 'При подписании', mensuel: 'В месяц', annuel: 'В год', ht: 'Без НДС', tva: 'НДС', total: 'Итого', remise: 'Скидка', offert: 'бесплатно по подписке, то есть' },
  ar: { unique: 'عند التوقيع', mensuel: 'شهريًا', annuel: 'سنويًا', ht: 'قبل الضريبة', tva: 'ضريبة القيمة المضافة', total: 'الإجمالي', remise: 'خصم', offert: 'مجانًا على الاشتراك، أي' },
};

/**
 * Les libellés que le calculateur pose lui-même.
 *
 * Un nom de prestation ou de vue est du contenu, saisi et traduit dans la
 * console. « Formation » ou « Maintenance annuelle », non : c'est le
 * calculateur qui les écrit, ils n'existent nulle part en base, et une offre
 * en italien qui les affiche en français a l'air d'une traduction bâclée.
 */
const LIGNES = {
  fr: { formation: 'Formation', poste: 'Postes en magasin', poste_franchiseur: 'Poste franchiseur', onboarding_poste: 'Onboarding des postes', achat: "Achat de l'application", maintenance: 'Maintenance annuelle' },
  en: { formation: 'Training', poste: 'In-store seats', poste_franchiseur: 'Head-office seat', onboarding_poste: 'Seat onboarding', achat: 'Application purchase', maintenance: 'Annual maintenance' },
  nl: { formation: 'Opleiding', poste: 'Werkplekken in de winkel', poste_franchiseur: 'Werkplek hoofdkantoor', onboarding_poste: 'Onboarding van werkplekken', achat: 'Aankoop van de applicatie', maintenance: 'Jaarlijks onderhoud' },
  de: { formation: 'Schulung', poste: 'Arbeitsplätze im Geschäft', poste_franchiseur: 'Arbeitsplatz Zentrale', onboarding_poste: 'Onboarding der Arbeitsplätze', achat: 'Kauf der Anwendung', maintenance: 'Jährliche Wartung' },
  it: { formation: 'Formazione', poste: 'Postazioni in negozio', poste_franchiseur: 'Postazione sede', onboarding_poste: 'Onboarding delle postazioni', achat: "Acquisto dell'applicazione", maintenance: 'Manutenzione annuale' },
  es: { formation: 'Formación', poste: 'Puestos en tienda', poste_franchiseur: 'Puesto de la central', onboarding_poste: 'Onboarding de los puestos', achat: 'Compra de la aplicación', maintenance: 'Mantenimiento anual' },
  pl: { formation: 'Szkolenie', poste: 'Stanowiska w sklepie', poste_franchiseur: 'Stanowisko centrali', onboarding_poste: 'Wdrożenie stanowisk', achat: 'Zakup aplikacji', maintenance: 'Roczne utrzymanie' },
  uk: { formation: 'Навчання', poste: 'Робочі місця в магазині', poste_franchiseur: 'Робоче місце центру', onboarding_poste: 'Впровадження робочих місць', achat: 'Придбання застосунку', maintenance: 'Річне обслуговування' },
  ru: { formation: 'Обучение', poste: 'Рабочие места в магазине', poste_franchiseur: 'Рабочее место центра', onboarding_poste: 'Внедрение рабочих мест', achat: 'Покупка приложения', maintenance: 'Годовое обслуживание' },
  ar: { formation: 'تدريب', poste: 'محطات في المتجر', poste_franchiseur: 'محطة المقر', onboarding_poste: 'تهيئة المحطات', achat: 'شراء التطبيق', maintenance: 'صيانة سنوية' },
};

/**
 * Le libellé d'une ligne dans la langue de l'offre.
 *
 * Les prestations et les vues gardent le nom qu'on leur a donné : c'est du
 * contenu, il se traduit dans la console comme le reste.
 */
export function libelleLigne(ligne, langue = 'fr') {
  const table = LIGNES[langue] || LIGNES.fr;
  return table[ligne.type] || ligne.libelle;
}

/** Les langues dans lesquelles une offre sait s'écrire. */
export const LANGUES_OFFRE = Object.keys(MOTS);

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
      lignes.push(`  ${libelleLigne(l, offre.langue)}${quantite}   ${formater(l.total_cents)}`);
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
    lignes.push(`${m} × ${mots.mensuel.toLowerCase()} ${mots.offert} ${formater(resultat.offert.ttc)}.`, '');
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
