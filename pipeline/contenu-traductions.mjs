/**
 * Les traductions du discours éditorial.
 *
 * Le français vit dans `contenu-textes.mjs` et reste la langue de référence :
 * ce fichier ne porte que les surcharges. Une clé absente ici affiche le
 * français plutôt qu'un blanc — une page à moitié traduite reste lisible, ce
 * qui compte plus qu'une cohérence de façade.
 *
 * Ce ne sont pas des traductions mot à mot. Le discours est commercial : on
 * traduit l'intention, pas la syntaxe. « Ce qu'un franchiseur ne voit pas lui
 * coûte le plus » devient en anglais une phrase qui frappe pareil, pas son
 * décalque.
 *
 * Ajouter une langue, c'est ajouter une entrée ici, puis relancer le seed.
 * La publier, c'est la cocher dans la console — jamais l'inverse : une langue
 * publiée à moitié traduite ment au visiteur.
 */

export const TRADUCTIONS = {
  en: {
    'site.titre_defaut': 'ERP for franchise networks',
    'nav.accueil': 'Home',
    'nav.modules': 'Modules',
    'nav.contact': 'Contact',
    'nav.onboarding': 'Onboarding',
    'nav.demo': 'Book a demo',
    'pied.fiches': 'Module sheets',
    'pied.leviers': 'The 6 levers',
    'pied.mention': '© 2026 The Franchise Buddy — ERP for franchise networks',
    'pied.note': "This site's content is generated from the modules' source code.",

    'accueil.oeil': 'ERP for franchise networks',
    'accueil.cta_secondaire': 'Browse the modules',
    'accueil.problemes.oeil': 'Your problems first',
    'accueil.problemes.titre': "What a franchisor cannot see is what costs them most",
    'accueil.reponses.oeil': 'Our answers',
    'accueil.reponses.titre': 'What the tool makes provable',
    'accueil.flux.oeil': 'The whole picture',
    'accueil.flux.titre': 'How information travels',
    'accueil.flux.chapo':
      'One single record, end to end. Pick a module: its exchanges light up.',
    'accueil.flux.lien': 'Follow the onboarding thread →',
    'accueil.leviers.oeil': 'The backbone',
    'accueil.leviers.titre': 'Six levers to read the whole network',
    'accueil.leviers.chapo':
      'Every module and every menu entry is tied to one or two levers. Three drive revenue, three drive cost.',
    'accueil.leviers.note': 'As a badge on every module and every menu entry:',
    'accueil.leviers.note2': 'each lever keeps its colour — the letter carries the identity',
    'accueil.modules.oeil': 'The modules',
    'accueil.modules.familles': 'Filter by family',
    'accueil.modules.toutes': 'All',
    'accueil.modules.lien': 'Follow the onboarding thread',
    'accueil.ecrans.oeil': 'On screen',
    'accueil.ecrans.titre': 'The product as it actually runs',
    'accueil.ecrans.chapo':
      'Screenshots of the applications in service, taken straight from the repositories. No mock-ups.',
    'accueil.clients.oeil': 'Networks working with TFB',
    'accueil.contact.chapo':
      'One hour, on your real cases: your stores, your catalogue, your rounds. We get back to you within one working day.',
    'accueil.contact.nom': 'Your name',
    'accueil.contact.nom_exemple': 'First and last name',
    'accueil.contact.reseau': 'Your network',
    'accueil.contact.reseau_exemple': 'Brand, number of outlets',
    'accueil.contact.email_libelle': 'Email',
    'accueil.contact.email_exemple': 'you@brand.eu',
    'accueil.contact.situation': 'Your situation',
    'accueil.contact.situation_exemple': "What has you looking for a tool today",
    'accueil.contact.merci_titre': 'Request received',
    'accueil.contact.merci': 'We get back to you within one working day.',

    'onboarding.meta_titre': 'Onboarding',
    'onboarding.meta_description':
      'Tick what sounds like your network: your system assembles itself, module by module.',
    'onboarding.oeil': 'Onboarding',
    'onboarding.titre': 'What does your network need?',
    'onboarding.chapo':
      'Tick what sounds familiar — problems first, needs after. Your system assembles itself further down the page, module by module.',
    'onboarding.cta': 'See my system',
    'onboarding.note': 'Nothing is sent: your selection never leaves your browser.',
    'onboarding.systeme.oeil': 'Your system',
    'onboarding.systeme.compte': 'of {n} modules',
    'onboarding.systeme.composants': '{n} components',
    'onboarding.systeme.vide':
      'Nothing yet — tick at least one need above and the matching modules will appear here.',
    'onboarding.systeme.fiche': 'See the full sheet →',
    'onboarding.systeme.sans_capture': 'screenshot to come',
    'onboarding.appel': 'Shall we look at your system together, on your real cases?',

    'module.problemes': 'Makes it go away',
    'module.benefices': 'Brings',
    'module.liens': 'Exchanges with',
    'module.vide': 'Not documented.',
    'module.sans_lien': 'No exchange declared.',
    'module.ecrans': 'The screens',
    'module.ecrans.note': 'scroll sideways',
    'module.menu': 'The menu',
    'module.detail': 'The module in detail',
    'module.entrees': 'What each entry is for',
    'module.flux': 'The flow, in plain words',
    'module.carrousel': 'The catalogue',
    'module.carrousel.aide': 'Scroll to change module.',
    'module.precedent': 'Previous module',
    'module.suivant': 'Next module',
    'module.compte_fonctions': '{n} functions',
    'module.envoie': 'sends to',
    'module.recoit': 'receives from',
    'module.maquette.note': '{n} menu entries, taken from the module’s code.',
  },

  it: {
    'site.titre_defaut': 'ERP per reti in franchising',
    'nav.accueil': 'Home',
    'nav.modules': 'Moduli',
    'nav.contact': 'Contatti',
    'nav.onboarding': 'Onboarding',
    'nav.demo': 'Richiedi una demo',
    'pied.fiches': 'Schede moduli',
    'pied.leviers': 'Le 6 leve',
    'pied.mention': '© 2026 The Franchise Buddy — ERP per reti in franchising',
    'pied.note': 'I contenuti di questo sito sono generati dal codice sorgente dei moduli.',

    'accueil.oeil': 'ERP per reti in franchising',
    'accueil.cta_secondaire': 'Sfoglia i moduli',
    'accueil.problemes.oeil': 'Prima i vostri problemi',
    'accueil.problemes.titre': 'Ciò che un affiliante non vede è ciò che gli costa di più',
    'accueil.reponses.oeil': 'Le nostre risposte',
    'accueil.reponses.titre': 'Ciò che lo strumento rende dimostrabile',
    'accueil.flux.oeil': 'Il quadro d’insieme',
    'accueil.flux.titre': 'Come circola l’informazione',
    'accueil.flux.chapo':
      'Un solo dato, da un capo all’altro. Scegliete un modulo: i suoi scambi si accendono.',
    'accueil.flux.lien': 'Segui il filo dell’onboarding →',
    'accueil.leviers.oeil': 'L’ossatura',
    'accueil.leviers.titre': 'Sei leve per leggere tutta la rete',
    'accueil.leviers.chapo':
      'Ogni modulo e ogni voce di menu è legata a una o due leve. Tre fanno il fatturato, tre fanno il costo.',
    'accueil.leviers.note': 'Come pastiglia su ogni modulo e ogni voce di menu:',
    'accueil.leviers.note2': 'ogni leva mantiene il suo colore — la lettera fa l’identità',
    'accueil.modules.oeil': 'I moduli',
    'accueil.modules.familles': 'Filtra per famiglia',
    'accueil.modules.toutes': 'Tutti',
    'accueil.modules.lien': 'Segui il filo dell’onboarding',
    'accueil.ecrans.oeil': 'A schermo',
    'accueil.ecrans.titre': 'Il prodotto così com’è in funzione',
    'accueil.ecrans.chapo':
      'Schermate delle applicazioni in servizio, riprese direttamente dai repository. Nessun mock-up.',
    'accueil.clients.oeil': 'Reti che lavorano con TFB',
    'accueil.contact.chapo':
      'Un’ora, sui vostri casi reali: i vostri punti vendita, il vostro catalogo, i vostri giri. Vi rispondiamo entro un giorno lavorativo.',
    'accueil.contact.nom': 'Il vostro nome',
    'accueil.contact.nom_exemple': 'Nome e cognome',
    'accueil.contact.reseau': 'La vostra rete',
    'accueil.contact.reseau_exemple': 'Insegna, numero di punti vendita',
    'accueil.contact.email_libelle': 'E-mail',
    'accueil.contact.email_exemple': 'voi@insegna.eu',
    'accueil.contact.situation': 'La vostra situazione',
    'accueil.contact.situation_exemple': 'Cosa vi spinge a cercare uno strumento oggi',
    'accueil.contact.merci_titre': 'Richiesta registrata',
    'accueil.contact.merci': 'Vi rispondiamo entro un giorno lavorativo.',

    'onboarding.meta_titre': 'Onboarding',
    'onboarding.meta_description':
      'Spuntate ciò che somiglia alla vostra rete: il vostro sistema si compone, modulo dopo modulo.',
    'onboarding.oeil': 'Onboarding',
    'onboarding.titre': 'Di cosa ha bisogno la vostra rete?',
    'onboarding.chapo':
      'Spuntate ciò in cui vi riconoscete — prima i problemi, poi i bisogni. Il vostro sistema si compone in fondo alla pagina, modulo dopo modulo.',
    'onboarding.cta': 'Vedi il mio sistema',
    'onboarding.note': 'Non viene inviato nulla: la selezione non lascia il vostro browser.',
    'onboarding.systeme.oeil': 'Il vostro sistema',
    'onboarding.systeme.compte': 'su {n} moduli',
    'onboarding.systeme.composants': '{n} componenti',
    'onboarding.systeme.vide':
      'Ancora niente — spuntate almeno un bisogno qui sopra e i moduli corrispondenti appariranno qui.',
    'onboarding.systeme.fiche': 'Vedi la scheda completa →',
    'onboarding.systeme.sans_capture': 'schermata in arrivo',
    'onboarding.appel': 'Guardiamo insieme il vostro sistema, sui vostri casi reali?',

    'module.problemes': 'Fa sparire',
    'module.benefices': 'Porta',
    'module.liens': 'Scambia con',
    'module.vide': 'Non documentato.',
    'module.sans_lien': 'Nessuno scambio dichiarato.',
    'module.ecrans': 'Le schermate',
    'module.ecrans.note': 'scorrete lateralmente',
    'module.menu': 'Il menu',
    'module.detail': 'Il modulo in dettaglio',
    'module.entrees': 'A cosa serve ogni voce',
    'module.flux': 'Il flusso, in chiaro',
    'module.carrousel': 'Il catalogo',
    'module.carrousel.aide': 'Scorrete per cambiare modulo.',
    'module.precedent': 'Modulo precedente',
    'module.suivant': 'Modulo successivo',
    'module.compte_fonctions': '{n} funzioni',
    'module.envoie': 'invia a',
    'module.recoit': 'riceve da',
    'module.maquette.note': '{n} voci di menu, riprese dal codice del modulo.',
  },
};

/**
 * Les clés volontairement non traduites : elles seraient identiques, ou ne
 * doivent pas l'être. Les lister évite qu'un contrôle de complétude les
 * signale indéfiniment comme manquantes.
 */
export const SANS_TRADUCTION = [
  'site.marque',                    // un nom propre
  'accueil.contact.email',          // une adresse
];
