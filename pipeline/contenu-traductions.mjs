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
      'Screenshots of the applications in service, taken straight from the repositories. Customer data in them is anonymised.',
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
    'module.maquette': 'The screen',
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
      'Schermate delle applicazioni in servizio, riprese direttamente dai repository. I dati dei clienti sono anonimizzati.',
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
    'module.maquette': 'La schermata',
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
 * La page d'accueil, qui ne vit pas dans `landing_textes` mais dans sa propre
 * table `landing_site` : titre, accroche, et les deux colonnes JSON qui
 * portent les problèmes et les réponses.
 *
 * Les listes sont écrites ici telles quelles ; le seed les sérialise avant de
 * les ranger dans `landing_traductions`, parce que la surcharge remplace la
 * valeur brute de la colonne et que `chargerSite` la relit ensuite au format
 * JSON. Traduire un seul problème sur cinq n'a donc pas de sens : c'est la
 * liste entière ou le français.
 */
export const SITE_TRADUCTIONS = {
  en: {
    titre: 'A network is worth what it can hand over',
    sous_titre:
      "An ERP that puts the know-how into the tool rather than into a few people's heads.",
    accroche: `A network sells on what it can hand over. As long as the procedures live in the founders' memory, in personal spreadsheets and in habits picked up on the shop floor, what changes hands is a sign and a lease. The buyer gets a name, not a method.
Our thirteen modules cover a network's real operations: franchisee recruitment, online and counter sales, head-office and outlet steering, supply and recipes, production, field coaching, delivery, in-store display, royalties and invoicing. Each holds to the same rule: what is done leaves a trace with a name and a time on it, and what is decided is written down somewhere other than a conversation.`,
    cta_texte: 'Book a demo',
    meta_description:
      'ERP for franchise networks: online and counter sales, steering, supply, production, field coaching, delivery, display, royalties and invoicing — thirteen modules.',
    problemes: [
      {
        titre: 'In-store execution is invisible',
        texte:
          'Head office finds out a standard has slipped when a customer complains, or during a visit. In between, nobody knows. The gap between two outlets widens with nothing to flag it.',
      },
      {
        titre: 'Information arrives late and distorted',
        texte:
          'The figures come in by spreadsheet at month end, re-keyed at least twice. By the time they land the quarter is decided, and the discussion is about whether the file can be trusted rather than about the call to make.',
      },
      {
        titre: "Procedures don't survive a departure",
        texte:
          'The know-how sits with a handful of people. A manager who leaves takes the knack, the memory of the difficult customers and the reasons behind every rule. Their successor relearns it at the cost of a season.',
      },
      {
        titre: 'Every tool tells a different story',
        texte:
          'The website announces one stock level, the kitchen knows another, the driver finds a third. Re-keying between those worlds costs hours and introduces the very errors everyone then spends time correcting.',
      },
      {
        titre: '“Checked” proves nothing',
        texte:
          'A ticked box with no name and no timestamp proves nothing — not to a franchisee, not to an inspection, not to a buyer. The network cannot show its standards exist anywhere but in its own pitch.',
      },
    ],
    reponses: [
      {
        titre: 'The field records where it works',
        texte:
          "The data is born at the workstation, once, the moment the job is done: the kitchen tablet, the field coach's panel, the driver's app. The consultant panel installs from the browser and opens full screen, on the tablet used out on the round.",
      },
      {
        titre: 'Every check carries a name and a time',
        texte:
          'Station checklists, scored visit checklists, geolocated proof of delivery: what is checked is attributed and dated. A standard becomes demonstrable, and therefore transferable.',
      },
      {
        titre: 'One product reference, everywhere',
        texte:
          "The head-office catalogue feeds the webshop, the franchisee consoles and the in-store screens. A price is changed once. The day's stock as the kitchen sees it is the stock the website checks before accepting an order.",
      },
      {
        titre: 'The head-office/franchisee line is a setting',
        texte:
          "Each outlet's record states what is inherited from head office and what the franchisee runs locally. The rule is not renegotiated every time an owner changes.",
      },
      {
        titre: 'Incidents are counted',
        texte:
          "Coded reasons, shared between the driver's app and the store console. A recurring fault becomes a figure you can compare between outlets, and therefore a subject you deal with.",
      },
    ],
  },

  it: {
    titre: 'Il valore di una rete è la sua capacità di essere trasmessa',
    sous_titre:
      'Un ERP che mette il saper fare nello strumento anziché nella testa di poche persone.',
    accroche: `Una rete si vende su ciò che riesce a trasmettere. Finché le procedure vivono nella memoria dei fondatori, in fogli di calcolo personali e in abitudini prese in negozio, ciò che si trasmette è solo un'insegna e un contratto d'affitto. Chi rileva compra un nome, non un metodo.
I nostri tredici moduli coprono l'esercizio reale di una rete: il reclutamento degli affiliati, la vendita online e alla cassa, il pilotaggio della sede e del punto vendita, l'approvvigionamento e le ricette, la produzione, l'animazione sul campo, la consegna, l'affissione, le royalty e la fatturazione. Ognuno ha la stessa esigenza: ciò che viene fatto lascia una traccia datata e attribuita, e ciò che viene deciso è scritto da qualche parte che non sia una conversazione.`,
    cta_texte: 'Richiedi una demo',
    meta_description:
      'ERP per reti in franchising: vendita online e cassa, pilotaggio, approvvigionamento, produzione, animazione sul campo, consegna, affissione, royalty e fatturazione — tredici moduli.',
    problemes: [
      {
        titre: "L'esecuzione in negozio è invisibile",
        texte:
          'La sede scopre che uno standard non è rispettato quando un cliente si lamenta, o durante una visita. Nel mezzo, nessuno lo sa. Il divario tra due punti vendita si allarga senza che nulla lo segnali.',
      },
      {
        titre: "L'informazione risale tardi e deformata",
        texte:
          'I numeri arrivano per foglio di calcolo a fine mese, ricopiati almeno due volte. Quando arrivano il trimestre è già giocato, e la discussione verte sull’affidabilità del file anziché sulla decisione da prendere.',
      },
      {
        titre: 'Le procedure non sopravvivono a una partenza',
        texte:
          'Il saper fare sta in poche persone. Un responsabile che se ne va porta con sé il mestiere, la memoria dei clienti difficili e le ragioni dietro ogni regola. Il successore reimpara al prezzo di una stagione.',
      },
      {
        titre: 'Ogni strumento racconta una storia diversa',
        texte:
          'Il sito annuncia una giacenza, la cucina ne conosce un’altra, l’autista ne scopre una terza. Il reinserimento tra questi mondi costa ore e introduce proprio gli errori che poi si passa a correggere.',
      },
      {
        titre: '«Verificato» non dimostra nulla',
        texte:
          'Una casella spuntata senza nome né orario non dimostra nulla — né a un affiliato, né a un controllo, né a chi rileva. La rete non può provare che i suoi standard esistano altrove che nei suoi discorsi.',
      },
    ],
    reponses: [
      {
        titre: 'Il campo registra dove lavora',
        texte:
          'Il dato nasce alla postazione di lavoro, una sola volta, nel momento in cui il gesto è compiuto: il tablet della cucina, il panel dell’animatore, l’applicazione dell’autista. Il panel consulente si installa dal browser e si apre a schermo intero, sul tablet del giro.',
      },
      {
        titre: 'Ogni controllo porta un nome e un’ora',
        texte:
          'Checklist di postazione, checklist di visita con punteggio, prova di consegna geolocalizzata: ciò che è verificato è attribuito e datato. Uno standard diventa dimostrabile, quindi trasmissibile.',
      },
      {
        titre: 'Un solo riferimento prodotto',
        texte:
          'Il catalogo della sede alimenta il webshop, le console degli affiliati e gli schermi in negozio. Un prezzo si cambia una volta sola. La giacenza del giorno vista in cucina è quella che il sito consulta prima di accettare un ordine.',
      },
      {
        titre: 'Il confine sede–affiliato è un’impostazione',
        texte:
          'La scheda di ogni punto vendita dice cosa è ereditato dalla sede e cosa l’affiliato governa in casa propria. La regola non si rinegozia a ogni cambio di proprietario.',
      },
      {
        titre: 'Gli incidenti si contano',
        texte:
          'Motivi codificati, condivisi tra l’applicazione dell’autista e la console del negozio. Un difetto ricorrente diventa un numero confrontabile tra punti vendita, quindi un tema che si affronta.',
      },
    ],
  },
};

/**
 * Le questionnaire d'onboarding, indexé par la `cle` de la question — la même
 * que dans `contenu-initial.mjs`, donc stable d'une exécution à l'autre.
 *
 * `cible` nomme le module que la question déclenche : c'est le nom commercial
 * du module, pas une phrase. Il se traduit quand même — un anglophone qui lit
 * « Console franchisé » sous une question en anglais n'y voit qu'un mot de
 * plus qu'il ne comprend pas.
 */
export const QUESTIONS_TRADUCTIONS = {
  en: {
    chiffres: { tag: 'Problem', texte: 'The figures come in by spreadsheet at month end, re-keyed at least twice?', cible: 'Brand console' },
    promo: { tag: 'Problem', texte: 'A promotion takes weeks to reach every outlet in the network?', cible: 'Brand console' },
    enligne: { tag: 'Need', texte: 'Sell online without taking orders the kitchen cannot produce?', cible: 'Webshop' },
    journee: { tag: 'Problem', texte: 'The outlet finds out about its day from a sheet printed the night before?', cible: 'Franchisee console' },
    ecrans: { tag: 'Problem', texte: 'Your in-store screens are still showing last month’s promotion?', cible: 'Signage manager' },
    fournisseur: { tag: 'Problem', texte: 'Supplier orders go out against an out-of-date PDF price list?', cible: 'Suppliers' },
    marge: { tag: 'Problem', texte: 'Margin per line item exists nowhere, and the drift shows up at year end?', cible: 'Suppliers' },
    savoir: { tag: 'Problem', texte: 'The know-how walks out when a manager leaves?', cible: 'Kitchen' },
    visites: { tag: 'Problem', texte: 'Your network visits amount to a write-up done in the evening, from memory?', cible: 'Consultant panel' },
    livraison: { tag: 'Need', texte: 'Deliver to your outlets with dated proof and no disputes?', cible: 'Delivery rounds' },
    recrutement: { tag: 'Problem', texte: 'Recruiting a franchisee takes a year and the file lives in an inbox?', cible: 'Recruitment' },
    caisse: { tag: 'Problem', texte: 'The till price drifts from the catalogue, and bundles get rebuilt by hand?', cible: 'POS' },
    redevances: { tag: 'Problem', texte: 'Royalties calculated on self-declared figures, and arrears that drag on?', cible: 'Royalties' },
    factures: { tag: 'Problem', texte: 'The same amount is re-keyed three times between the sale and the accountant?', cible: 'Invoicing' },
    foodcost: { tag: 'Need', texte: 'Know the margin on every line item, and see the drift before year end?', cible: 'Recipes & food cost' },
    transmission: { tag: 'Need', texte: 'Make your network transferable: everything done leaves a dated trace?', cible: 'The whole catalogue' },
  },

  it: {
    chiffres: { tag: 'Problema', texte: 'I numeri arrivano per foglio di calcolo a fine mese, ricopiati almeno due volte?', cible: 'Console marca' },
    promo: { tag: 'Problema', texte: 'Un’operazione commerciale impiega settimane a raggiungere tutta la rete?', cible: 'Console marca' },
    enligne: { tag: 'Bisogno', texte: 'Vendere online senza accettare ordini che la cucina non può produrre?', cible: 'Webshop' },
    journee: { tag: 'Problema', texte: 'Il punto vendita scopre la propria giornata su un foglio stampato la sera prima?', cible: 'Console affiliato' },
    ecrans: { tag: 'Problema', texte: 'I vostri schermi in negozio mostrano ancora la promozione di ieri?', cible: 'Regia di affissione' },
    fournisseur: { tag: 'Problema', texte: 'Gli ordini ai fornitori partono su un listino PDF scaduto?', cible: 'Fornitori' },
    marge: { tag: 'Problema', texte: 'Il margine per referenza non esiste da nessuna parte, e la deriva si scopre a bilancio?', cible: 'Fornitori' },
    savoir: { tag: 'Problema', texte: 'Il saper fare se ne va quando un responsabile se ne va?', cible: 'Cucina' },
    visites: { tag: 'Problema', texte: 'Le vostre visite in rete si riducono a un resoconto scritto la sera, a memoria?', cible: 'Panel consulente' },
    livraison: { tag: 'Bisogno', texte: 'Consegnare ai punti vendita con una prova datata e senza contestazioni?', cible: 'Giri di consegna' },
    recrutement: { tag: 'Problema', texte: 'Reclutare un affiliato richiede un anno e la pratica vive in una casella di posta?', cible: 'Reclutamento' },
    caisse: { tag: 'Problema', texte: 'Il prezzo alla cassa diverge dal catalogo, e i bundle si ricostruiscono a mano?', cible: 'Cassa POS' },
    redevances: { tag: 'Problema', texte: 'Royalty calcolate su dati autodichiarati, e insoluti che si trascinano?', cible: 'Royalty' },
    factures: { tag: 'Problema', texte: 'Lo stesso importo si reinserisce tre volte tra la vendita e il commercialista?', cible: 'Fatturazione' },
    foodcost: { tag: 'Bisogno', texte: 'Conoscere il margine di ogni referenza e vedere la deriva prima del bilancio?', cible: 'Ricette & food cost' },
    transmission: { tag: 'Bisogno', texte: 'Rendere la vostra rete trasmissibile: ciò che è fatto lascia una traccia datata?', cible: 'Tutto il catalogo' },
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
