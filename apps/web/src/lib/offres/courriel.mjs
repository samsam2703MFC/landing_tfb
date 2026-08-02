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
 * @property {string} corps        La version texte, qui part toujours.
 * @property {string} corps_html   La version mise en page.
 */

/**
 * La feuille de style de la lettre, aux couleurs de la marque.
 *
 * C'est la valeur de départ du paramètre `courriel_css` : elle se modifie
 * ensuite dans la console, sans redéploiement.
 *
 * Le partage est net, et il est délibéré : **la mise en page est en ligne
 * dans le document** — largeurs, marges, bordures, alignements —, **les
 * couleurs et la typographie sont ici**. Un style en ligne l'emporterait sur
 * cette feuille, et le paramètre ne servirait à rien : c'est pourquoi aucune
 * couleur n'est écrite dans le document.
 *
 * La contrepartie est réelle : un client de messagerie qui jette les feuilles
 * de style — Outlook pour Windows, essentiellement — affiche une lettre juste
 * et lisible, mais sans les couleurs de la marque. C'est le prix d'une charte
 * qui se règle sans redéploiement.
 */
export const CSS_COURRIEL = `/* The Franchise Buddy — la lettre d'offre.
   Les couleurs viennent de la marque : prune #7b4488, encre marine #0c1329.
   Les largeurs et les marges sont en ligne dans le document — ce qui est ici
   se perd sans dommage chez les clients qui ignorent les feuilles de style. */

body, td, p, span { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
.tfb-corps { background: #f5f6f9; }
.tfb-carte { background: #ffffff; box-shadow: 0 1px 3px rgba(12, 19, 41, .08); }

/* L'en-tête porte la marque, sur l'encre marine. */
.tfb-entete { background: #0c1329; }
.tfb-marque { color: #ffffff; }

.tfb-dedans { color: #0c1329; }
.tfb-dedans a { color: #7b4488; }

/* Le titre d'un rythme de paiement — une fois, par mois, par an. */
.tfb-rythme { color: #7b4488; font-weight: 700; }
.tfb-ligne { color: #0c1329; }
.tfb-note { color: #565d73; }
.tfb-qte { color: #9aa0b4; }
.tfb-soustotal { color: #565d73; }
.tfb-total { color: #0c1329; font-weight: 700; }

/* Le geste commercial se lit en vert : ce n'est pas une alerte. */
.tfb-offert { background: #d7f2f0; color: #0c6a66; }
.tfb-mention { color: #565d73; }

/* Le bouton qui mène à l'annexe. */
.tfb-bouton { background: #7b4488; }
.tfb-bouton__lien { color: #ffffff; }
.tfb-pied { background: #f5f6f9; color: #565d73; }

@media (max-width: 620px) {
  .tfb-dedans { padding: 20px !important; }
  .tfb-entete, .tfb-pied { padding-left: 20px !important; padding-right: 20px !important; }
}`;

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
  fr: { annexe: 'Voir le détail de l’offre', unique: 'À la signature', mensuel: 'Par mois', annuel: 'Par an', ht: 'Hors taxes', tva: 'TVA', total: 'Total', remise: 'Remise', offert: 'offert(s) sur l’abonnement, soit' },
  en: { annexe: 'See the full breakdown', unique: 'On signature', mensuel: 'Per month', annuel: 'Per year', ht: 'Excl. VAT', tva: 'VAT', total: 'Total', remise: 'Discount', offert: 'free on the subscription, i.e.' },
  nl: { annexe: 'Bekijk het volledige overzicht', unique: 'Bij ondertekening', mensuel: 'Per maand', annuel: 'Per jaar', ht: 'Excl. btw', tva: 'Btw', total: 'Totaal', remise: 'Korting', offert: 'gratis op het abonnement, ofwel' },
  de: { annexe: 'Die Details ansehen', unique: 'Bei Unterzeichnung', mensuel: 'Pro Monat', annuel: 'Pro Jahr', ht: 'Netto', tva: 'MwSt.', total: 'Gesamt', remise: 'Rabatt', offert: 'kostenlos im Abonnement, also' },
  it: { annexe: 'Vedi il dettaglio completo', unique: 'Alla firma', mensuel: 'Al mese', annuel: "All'anno", ht: 'Imponibile', tva: 'IVA', total: 'Totale', remise: 'Sconto', offert: 'in omaggio sull’abbonamento, ossia' },
  es: { annexe: 'Ver el detalle completo', unique: 'A la firma', mensuel: 'Al mes', annuel: 'Al año', ht: 'Base imponible', tva: 'IVA', total: 'Total', remise: 'Descuento', offert: 'gratis en la suscripción, es decir' },
  pl: { annexe: 'Zobacz pełne zestawienie', unique: 'Przy podpisaniu', mensuel: 'Miesięcznie', annuel: 'Rocznie', ht: 'Netto', tva: 'VAT', total: 'Razem', remise: 'Rabat', offert: 'gratis w abonamencie, czyli' },
  uk: { annexe: 'Переглянути деталі', unique: 'При підписанні', mensuel: 'Щомісяця', annuel: 'Щороку', ht: 'Без ПДВ', tva: 'ПДВ', total: 'Разом', remise: 'Знижка', offert: 'безкоштовно за передплатою, тобто' },
  ru: { annexe: 'Посмотреть детали', unique: 'При подписании', mensuel: 'В месяц', annuel: 'В год', ht: 'Без НДС', tva: 'НДС', total: 'Итого', remise: 'Скидка', offert: 'бесплатно по подписке, то есть' },
  ar: { annexe: 'عرض التفاصيل الكاملة', unique: 'عند التوقيع', mensuel: 'شهريًا', annuel: 'سنويًا', ht: 'قبل الضريبة', tva: 'ضريبة القيمة المضافة', total: 'الإجمالي', remise: 'خصم', offert: 'مجانًا على الاشتراك، أي' },
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
      // Ce que la ligne précise — la caisse retenue pour le socle, ce
      // qu'apporte un module. Décalé, pour se lire sans brouiller la colonne
      // des montants.
      if (l.note) lignes.push(`    ${l.note}`);
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
 * Échappe ce qui part dans du HTML.
 *
 * Le nom d'un client, l'intitulé d'une ligne libre, une mention de TVA : tout
 * cela est saisi dans la console et finit dans la lettre. Une esperluette
 * dans « Dupont & Fils » casserait le document ; un chevron le casserait
 * davantage.
 */
function html(valeur) {
  return String(valeur ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Le récapitulatif chiffré, en HTML.
 *
 * Des tables et des styles en ligne, parce qu'un client de messagerie n'est
 * pas un navigateur : la grille, le flex et les variables CSS n'y existent
 * pas, et Outlook rend le tout avec le moteur de Word. Ce qui est ici doit
 * survivre partout ; ce qui est décoratif vit dans la feuille de style, que
 * les clients modernes honorent et que les autres ignorent sans dommage.
 */
export function recapHtml(offre, resultat, formater) {
  const mots = MOTS[offre.langue] || MOTS.fr;
  const morceaux = [];

  for (const [cle, seau] of Object.entries(resultat.seaux)) {
    if (seau.lignes.length === 0) continue;
    const lignes = seau.lignes.map((l) => `
        <tr>
          <td class="tfb-ligne" style="padding:7px 0;border-bottom:1px solid #edeef3">
            ${html(libelleLigne(l, offre.langue))}${l.quantite > 1 ? ` <span class="tfb-qte">× ${l.quantite}</span>` : ''}
            ${l.note ? `<br><span class="tfb-note" style="font-size:12px">${html(l.note)}</span>` : ''}
          </td>
          <td class="tfb-montant" style="padding:7px 0;border-bottom:1px solid #edeef3;text-align:right;white-space:nowrap">
            ${html(formater(l.total_cents))}
          </td>
        </tr>`).join('');

    const total = (libelle, montant, fort = false) => `
        <tr>
          <td class="${fort ? 'tfb-total' : 'tfb-soustotal'}" style="padding:${fort ? '10px 0 0' : '5px 0 0'}">${html(libelle)}</td>
          <td class="${fort ? 'tfb-total' : 'tfb-soustotal'}" style="padding:${fort ? '10px 0 0' : '5px 0 0'};text-align:right;white-space:nowrap">${html(montant)}</td>
        </tr>`;

    morceaux.push(`
    <table class="tfb-seau" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:18px 0 22px">
      <tr>
        <td colspan="2" class="tfb-rythme" style="padding:0 0 6px;font-size:11px;letter-spacing:.08em;text-transform:uppercase">
          ${html(mots[cle])}
        </td>
      </tr>${lignes}
      ${seau.remise > 0 ? total(mots.remise, `− ${formater(seau.remise)}`) : ''}
      ${total(mots.ht, formater(seau.ht))}
      ${resultat.exoneree ? '' : total(mots.tva, formater(seau.tva))}
      ${total(mots.total, formater(seau.ttc), true)}
    </table>`);
  }

  if (resultat.offert && resultat.offert.ttc > 0) {
    morceaux.push(`
    <p class="tfb-offert" style="margin:0 0 18px;padding:11px 14px;border-radius:8px;font-size:14px">
      <strong>${resultat.offert.mois} × ${html(mots.mensuel.toLowerCase())} ${html(mots.offert)} ${html(formater(resultat.offert.ttc))}.</strong>
    </p>`);
  }
  if (resultat.exoneree && offre.tva_mention) {
    morceaux.push(`
    <p class="tfb-mention" style="margin:0 0 18px;font-size:12px">${html(offre.tva_mention)}</p>`);
  }
  return morceaux.join('');
}

/**
 * La lettre entière, mise en page.
 *
 * Le corps rédigé dans la console reste du texte : c'est ce qu'on veut écrire
 * à un client, et lui demander d'écrire du HTML serait le meilleur moyen
 * d'obtenir une lettre cassée. Il est découpé en paragraphes, le
 * récapitulatif prend sa place, et le tout est habillé.
 */
export function corpsHtml({ texte, recap, css, titre, annexe = '', motAnnexe = '', langue = 'fr', rtl = false }) {
  const paragraphes = String(texte || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px">${html(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n      ');

  // Le récapitulatif est posé là où le gabarit l'appelait : le jeton a déjà
  // été remplacé par un repère, qu'on remplace ici par le tableau. Le repère
  // occupe en général un paragraphe à lui seul, mais rien n'oblige le gabarit
  // à l'écrire ainsi — s'il est au milieu d'une phrase, on le remplace quand
  // même. Le laisser passer imprimerait « {{RECAP}} » dans la lettre.
  const corps = paragraphes
    .replace('<p style="margin:0 0 14px">{{RECAP}}</p>', recap)
    .replace(/\{\{RECAP\}\}/g, recap);

  // Le bouton d'annexe, posé après le récapitulatif : le client lit d'abord
  // ce qu'il paie, ensuite ce que ça couvre.
  const bouton = annexe
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:4px 0 18px">
        <tr>
          <td class="tfb-bouton" style="border-radius:8px;padding:11px 18px">
            <a href="${html(annexe)}" class="tfb-bouton__lien" style="text-decoration:none;font-weight:700;font-size:14px">${html(motAnnexe)}</a>
          </td>
        </tr>
      </table>`
    : '';

  return `<!doctype html>
<html lang="${html(langue)}"${rtl ? ' dir="rtl"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${html(titre)}</title>
<style>
${css}
</style>
</head>
<body class="tfb-corps" style="margin:0;padding:0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
    <tr>
      <td align="center" style="padding:28px 12px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="tfb-carte" style="width:600px;max-width:100%;border-collapse:collapse;border-radius:14px;overflow:hidden">
          <tr>
            <td class="tfb-entete" style="padding:22px 28px">
              <span class="tfb-marque" style="font-size:17px;font-weight:700;letter-spacing:-.01em">The Franchise Buddy</span>
            </td>
          </tr>
          <tr>
            <td class="tfb-dedans" style="padding:28px;font-size:15px;line-height:1.6">
      ${corps}
      ${bouton}
            </td>
          </tr>
          <tr>
            <td class="tfb-pied" style="padding:16px 28px;font-size:12px">
              ${html(titre)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
  // L'annexe part avec l'offre, toujours : le chiffrage seul ne dit pas ce
  // qu'il couvre. Le jeton existe même sans lien fourni, pour qu'un gabarit
  // qui l'appelle n'imprime pas « {annexe} » au client.
  jetons.annexe = gabarits.annexe || '';

  const sujet = remplacer(gabarits.sujet, jetons);
  return {
    destinataire: offre.prospect?.contact_email || '',
    sujet,
    corps: remplacer(gabarits.corps, jetons),
    // La version mise en page. Le même gabarit sert aux deux : le
    // récapitulatif y est marqué d'un repère plutôt que recopié en texte,
    // pour être remplacé par le tableau. Un client de messagerie qui refuse
    // le HTML reçoit `corps`, qui dit exactement la même chose.
    corps_html: corpsHtml({
      texte: remplacer(gabarits.corps, { ...jetons, recapitulatif: '{{RECAP}}' }),
      recap: recapHtml(offre, resultat, formater),
      annexe: gabarits.annexe || '',
      motAnnexe: (MOTS[offre.langue] || MOTS.fr).annexe,
      css: gabarits.css || CSS_COURRIEL,
      titre: sujet,
      langue: offre.langue,
      rtl: Boolean(offre.rtl),
    }),
    jetons,
  };
}
