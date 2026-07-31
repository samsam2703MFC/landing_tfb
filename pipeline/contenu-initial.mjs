/**
 * Contenu de départ des treize modules, rédigé à partir du code et des fiches
 * `.tfb/module.json` de chaque dépôt.
 *
 * Sert à alimenter la landing sans clé Anthropic. Une ingestion ultérieure
 * (`ingest-all.mjs`) remplace proprement ce contenu module par module.
 *
 * Chaque fonction porte une `cle` stable : c'est la même que dans le manifeste
 * du dépôt, donc la régénération par l'IA retrouvera les mêmes entrées.
 */

export const MODULES = [
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'webshop',
    repo: 'samsam2703MFC/WebShop',
    groupe: 'Vente',
    icone: 'shopping-cart',
    ordre: 1,
    nom: 'Webshop',
    accroche: "La boutique en ligne du réseau, déclinée par point de vente.",
    resume:
      "Le client commande sur le site de son magasin, pas sur un site générique : catalogue, prix, jours d'ouverture et créneaux sont ceux de ce point de vente. La disponibilité est vérifiée avant le paiement, et la commande atterrit directement dans la console du franchisé.",
    public_cible: 'Clients du réseau, particuliers et entreprises',
    description: `Un réseau qui vend en ligne se heurte vite au même mur : un site unique ne sait pas qu'une boutique ferme le lundi, qu'une autre n'a plus de pâte à tarte, et qu'une troisième pratique un tarif différent. Résultat, des commandes acceptées que personne ne peut produire, et un franchisé qui appelle le client pour annuler.

Le webshop part de la boutique. Le visiteur choisit son point de vente, et tout découle de ce choix : l'assortiment, les prix, les jours ouvrés, les créneaux de retrait ou de livraison. Le moteur de disponibilité croise le stock du jour, le remplissage du créneau et l'heure limite de commande avant d'accepter le paiement.

Le devis du panier est calculé côté serveur. Les règles de prix du siège, les promotions locales du franchisé et les bons de réduction sont résolus au même endroit, dans cet ordre : le client voit un prix ferme, pas une estimation qui bougera à la facturation.

Les entreprises ont leur propre parcours — commande pour un bureau et un service, sur une tournée existante, avec le numéro de TVA vérifié et les frais de livraison négociés. Le thème visuel vient des jetons de la boutique servis par l'API, ce qui permet d'ajouter une enseigne au réseau sans redévelopper de front.`,
    stack: ['React', 'PHP', 'MySQL'],
    mots_cles: ['webshop', 'franchise', 'click and collect', 'B2B', 'créneaux'],
    problemes: [
      {
        titre: 'Commandes impossibles à produire',
        texte:
          "Un site qui ignore le stock et la capacité du magasin accepte des commandes que la cuisine ne peut pas honorer. Le franchisé passe sa matinée à rappeler des clients pour annuler.",
      },
      {
        titre: 'Un site par boutique, ou aucun',
        texte:
          "Soit chaque franchisé bricole sa propre vitrine et le réseau perd toute cohérence, soit un site unique impose le même catalogue partout. Les deux abîment la marque.",
      },
      {
        titre: 'Le prix affiché n\'est pas le prix facturé',
        texte:
          "Quand les remises se calculent dans le navigateur, chaque écart devient un litige. La confiance du client se joue sur ce détail.",
      },
    ],
    benefices: [
      {
        titre: 'Une vitrine par point de vente',
        texte:
          "Le catalogue réseau est filtré et tarifé pour la boutique choisie. Le franchiseur garde le référentiel, le franchisé garde son assortiment réel.",
      },
      {
        titre: 'Aucune commande invendable',
        texte:
          "Stock du jour, capacité du créneau et heure limite sont vérifiés avant le paiement. Ce qui est vendu est produisible.",
      },
      {
        titre: 'Un seul moteur de prix',
        texte:
          "Règles du siège, promotions locales et bons se résolvent côté serveur. Le prix affiché est celui qui sera facturé.",
      },
      {
        titre: "Une enseigne de plus sans redéveloppement",
        texte:
          "Couleurs, logo et typographies viennent de la configuration de la boutique. Ouvrir une nouvelle marque dans le réseau relève du paramétrage.",
      },
    ],
    mermaid: `flowchart TD
  A[Le client choisit sa boutique] --> B[Catalogue et prix locaux]
  B --> C[Panier]
  C --> D{Disponibilite verifiee}
  D -->|Stock creneau heure limite| E[Paiement]
  D -->|Indisponible| B
  E --> F[Commande dans la console franchise]
  F --> G[Preparation en cuisine]`,
    leviers: ["trafic", "recurrence", "xp"],
    liens: [{"slug": "console-marque", "sens": "recoit", "quoi": "le catalogue, les prix et les promotions du siège"}, {"slug": "console-franchise", "sens": "envoie", "quoi": "les commandes du jour, prêtes à préparer"}, {"slug": "console-franchise", "sens": "recoit", "quoi": "le stock du jour et les créneaux disponibles"}],
    onboarding:
      "Première semaine : vous choisissez une boutique pilote, vous vérifiez que son catalogue, ses créneaux et son heure limite sont justes, et vous ouvrez la vente. Ce que vous gagnez tout de suite : plus aucune commande acceptée que la cuisine ne peut produire.",
    fonctions: [
      { cle: 'catalogue', icone: 'book-open', nom: 'Catalogue par boutique', leviers: ["trafic"], description: "Le même catalogue réseau, filtré et tarifé pour la boutique choisie : assortiment, prix local, saison, allergènes. Changer de boutique change la vitrine, pas le référentiel.", benefice: "Le siège garde la main sur l'offre sans imposer le même rayon à tous." },
      { cle: 'creneaux', icone: 'clock', nom: 'Créneaux et heure limite', leviers: ["xp", "labour"], description: "Le moteur de disponibilité croise les jours d'ouverture, le stock du jour et le remplissage du créneau. L'heure limite est lue dans la configuration de la boutique et réévaluée en continu.", benefice: "Plus d'annulation le lendemain matin faute de capacité." },
      { cle: 'tarifs', icone: 'credit-card', nom: 'Tarifs, bons et remises', leviers: ["food", "recurrence"], description: "Le devis du panier est calculé côté serveur : règles de prix du siège, promotions locales, bons validés à l'usage, offre croisée par portion. Le client voit un prix, pas une estimation.", benefice: "Le montant annoncé est le montant facturé, sans litige." },
      { cle: 'b2b', icone: 'users', nom: 'Commande B2B', leviers: ["recurrence", "trafic"], description: "Les entreprises commandent pour un bureau et un service, sur une tournée existante, avec leurs frais de livraison propres et leur numéro de TVA vérifié.", benefice: "La facture part au bon service sans ressaisie comptable." },
      { cle: 'compte', icone: 'search', nom: 'Compte et suivi de commande', leviers: ["recurrence"], description: "Inscription, session, historique et suivi : le client retrouve ses commandes passées et l'état de celle du jour, la même donnée que celle affichée en magasin.", benefice: "Le magasin et le client regardent le même écran quand ils s'appellent." },
      { cle: 'marque', icone: 'layers', nom: 'Thème par enseigne', leviers: ["trafic"], description: "Couleurs, logo et typographies viennent des jetons de la boutique servis par l'API. Une enseigne de plus dans le réseau ne demande pas un nouveau front.", benefice: "Une seconde marque se lance en paramétrage, pas en projet." },
      { cle: 'langues', icone: 'settings', nom: 'Quatre langues', leviers: ["trafic"], description: "Français, néerlandais, anglais et allemand, choisis par le client — indispensable pour un réseau belge où deux boutiques voisines ne parlent pas la même langue.", benefice: "Le réseau s'étend sur une frontière linguistique sans dupliquer le site." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'console-marque',
    repo: 'samsam2703MFC/back_office_ws_franchisor',
    groupe: 'Pilotage',
    icone: 'layout-dashboard',
    ordre: 2,
    nom: 'Console marque',
    accroche: "L'écran du franchiseur : ce que le réseau vend, et ce qu'il a fait.",
    resume:
      "Le back office du siège. Il décide ce que le réseau vend — catalogue, formules, prix, promotions — et voit ce que le réseau a fait : chiffre consolidé, boutique par boutique, zone par zone. Les droits sont posés par rôle, avec un journal d'audit derrière.",
    public_cible: 'Direction du réseau, animation, marketing',
    description: `La question qui revient chez tout franchiseur : qu'est-ce qui se passe réellement dans mes points de vente ? Tant que la réponse suppose d'appeler douze franchisés et de recoller douze tableurs, le réseau n'est pas pilotable — et il n'est pas transmissible non plus, puisque tout le savoir tient dans la tête de celui qui passe les appels.

La console marque met les deux moitiés du métier sur le même écran. D'un côté ce que le siège décide : l'arbre du catalogue, les formules et leurs étapes, les règles de prix, les promotions réseau et leur périmètre. De l'autre ce que le réseau produit : indicateurs consolidés, détail par boutique, ventes rapportées aux codes postaux.

L'analyse géographique mérite qu'on s'y arrête. Les ventes projetées sur les zones de chalandise montrent les recouvrements entre boutiques et les secteurs vides. C'est l'écran qui sert à décider où ouvrir la suivante, plutôt qu'à justifier après coup une ouverture décidée à l'instinct.

La gouvernance est explicite : la fiche boutique dit ce que le franchisé a le droit de modifier chez lui et ce qui reste hérité du siège. C'est un interrupteur, pas une convention orale — et c'est précisément ce qui rend une procédure transmissible à un nouveau propriétaire.`,
    stack: ['React 18', 'JavaScript', 'API REST'],
    mots_cles: ['back office', 'franchiseur', 'pilotage réseau', 'catalogue', 'zone de chalandise'],
    problemes: [
      {
        titre: 'Le siège découvre trop tard',
        texte:
          "Quand les chiffres remontent par tableur en fin de mois, l'écart entre deux boutiques se constate au lieu de se corriger. Un trimestre se perd vite.",
      },
      {
        titre: 'Chacun sa règle du jeu',
        texte:
          "Sans frontière explicite entre ce que décide le siège et ce que décide le franchisé, chaque négociation se rejoue à chaque changement de propriétaire.",
      },
      {
        titre: 'Les ouvertures se décident à l\'instinct',
        texte:
          "Sans lecture géographique des ventes, on ouvre là où une opportunité se présente, quitte à cannibaliser une boutique existante.",
      },
    ],
    benefices: [
      {
        titre: 'Le réseau visible sur un écran',
        texte:
          "Indicateurs consolidés et détail par boutique au même endroit. L'écart se voit le jour où il apparaît, pas à la clôture.",
      },
      {
        titre: 'Une source unique pour le catalogue',
        texte:
          "Webshop, écrans en magasin et back-offices franchisés lisent tous le même référentiel. Un changement de prix se fait une fois.",
      },
      {
        titre: 'La gouvernance devient un réglage',
        texte:
          "Ce que le franchisé peut modifier est coché dans sa fiche. La règle survit au départ de celui qui l'avait négociée.",
      },
      {
        titre: 'Des ouvertures documentées',
        texte:
          "Zones de chalandise, recouvrements et secteurs vides sur la carte. La décision d'ouverture s'appuie sur les ventes réelles.",
      },
    ],
    mermaid: `flowchart TD
  A[Siege] --> B[Catalogue et formules]
  A --> C[Promotions reseau]
  A --> D[Droits par boutique]
  B --> E[Webshop]
  B --> F[Ecrans en magasin]
  B --> G[Console franchise]
  E --> H[Ventes consolidees]
  G --> H
  H --> I[Analyse par boutique et par zone]`,
    leviers: ["trafic", "recurrence", "food", "overhead"],
    liens: [{"slug": "webshop", "sens": "envoie", "quoi": "le catalogue, les formules et les règles de prix"}, {"slug": "console-franchise", "sens": "envoie", "quoi": "ce que le franchisé peut modifier chez lui"}, {"slug": "affichage", "sens": "envoie", "quoi": "les produits et tarifs affichés en magasin"}, {"slug": "consultant", "sens": "recoit", "quoi": "les comptes rendus de visite et les écarts constatés"}],
    onboarding:
      "C'est par ici qu'on commence. Vous y déclarez vos boutiques, vous montez le catalogue une fois, et vous décidez ce que chaque franchisé peut modifier chez lui. Tout le reste du réseau lit ces décisions.",
    fonctions: [
      { cle: 'dashboard', icone: 'bar-chart', nom: 'Tableau de bord réseau', leviers: ["trafic", "food"], description: "Les indicateurs du réseau consolidés au siège, avec le détail par boutique en dessous : on voit l'écart entre les points de vente sans exporter quoi que ce soit.", benefice: "L'écart se traite dans la semaine, pas au trimestre." },
      { cle: 'boutiques', icone: 'map-pin', nom: 'Boutiques du réseau', leviers: ["overhead"], description: "La fiche de chaque point de vente — ouverture, périmètre, réglages hérités du siège — et ce que le franchisé a le droit de modifier chez lui.", benefice: "La gouvernance est un interrupteur, pas une convention orale." },
      { cle: 'catalogue', icone: 'book-open', nom: 'Catalogue produits', leviers: ["food"], description: "L'arbre catégories puis produits, avec la saison et la disponibilité. C'est la source unique que lisent le webshop, les écrans en magasin et les consoles franchisées.", benefice: "Un prix se change une fois et se propage partout." },
      { cle: 'menus', icone: 'layers', nom: 'Menus et formules', leviers: ["food"], description: "Le constructeur de formules : une formule, ses étapes, les choix ouverts à chaque étape, et le prix résolu côté serveur avec sa marge.", benefice: "La marge d'une formule est connue avant de la lancer." },
      { cle: 'promotions', icone: 'credit-card', nom: 'Promotions réseau', leviers: ["trafic", "recurrence"], description: "Bons de réduction et règles de prix décidés au siège, avec le périmètre des boutiques concernées. Le franchisé garde ses promotions locales à côté, sans écraser celles de la marque.", benefice: "Une opération nationale se lance sans appeler chaque magasin." },
      { cle: 'geo', icone: 'map-pin', nom: 'Analyse géographique', leviers: ["trafic"], description: "Les ventes rapportées aux codes postaux : zones de chalandise, recouvrements entre boutiques, secteurs vides. C'est l'écran qui sert à décider où ouvrir.", benefice: "Une ouverture cesse d'être un pari." },
      { cle: 'tracabilite', icone: 'search', nom: 'Traçabilité clients', leviers: ["recurrence"], description: "Le parcours d'un client à travers le réseau : où il commande, à quelle fréquence, sous quelle enseigne. Utile quand plusieurs boutiques servent la même personne.", benefice: "Le client appartient au réseau, pas à une boutique." },
      { cle: 'prospects', icone: 'users', nom: 'Prospects', leviers: ["overhead"], description: "Les candidats franchisés et les demandes d'ouverture suivis au même endroit que le reste du réseau, plutôt que dans un tableur à part.", benefice: "Le développement du réseau se pilote comme le reste." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'console-franchise',
    repo: 'samsam2703MFC/back_office_ws_franchisee',
    groupe: 'Pilotage',
    icone: 'store',
    ordre: 3,
    nom: 'Console franchisé',
    accroche: "La journée du point de vente : préparation, livraison, stock, clients.",
    resume:
      "Le pendant magasin de la console marque. Le franchisé y voit sa journée — ce qu'il faut préparer, ce qui part en tournée, ce qui manque — et gère ce qui lui appartient : clients professionnels, créneaux, frais de livraison, promotions locales.",
    public_cible: 'Franchisés et responsables de point de vente',
    description: `Un franchisé passe sa journée entre la production, les livraisons et le téléphone. Ce qu'il lui faut n'est pas un outil de reporting, c'est un écran qui lui dit ce qui se passe maintenant : combien de commandes à préparer, quelles tournées sont parties, quel produit manque, quel incident est ouvert.

La console franchisé sépare nettement deux choses. Ce qui vient du siège — le catalogue, les règles de prix, les formules — arrive d'en haut et ne se discute pas depuis le magasin. Ce qui est local — les clients B2B, les créneaux, les frais de livraison, les promotions du magasin — appartient au franchisé et se règle chez lui.

Le stock du jour mérite une mention particulière : c'est la même table que consulte le webshop avant d'accepter une commande. Fermer un produit ici le retire de la vente en ligne immédiatement. Il n'y a pas deux vérités, une pour le magasin et une pour le site.

Les incidents utilisent les mêmes motifs codifiés que l'application du chauffeur. Un colis manquant déclaré sur la route et un litige constaté au magasin portent la même étiquette, donc les chiffres se comparent d'une boutique à l'autre — condition pour que le siège puisse traiter un problème récurrent au lieu de le découvrir par hasard.`,
    stack: ['React 18', 'JavaScript', 'API REST', 'Leaflet'],
    mots_cles: ['back office', 'franchisé', 'préparation', 'stock', 'B2B'],
    problemes: [
      {
        titre: 'Deux vérités sur le stock',
        texte:
          "Quand le site et le magasin ne lisent pas la même disponibilité, la rupture se découvre au moment de produire. Le client l'apprend par téléphone.",
      },
      {
        titre: 'Le franchisé bloqué sur son propre métier',
        texte:
          "S'il faut passer par le siège pour ajouter un client B2B ou fermer un créneau, le magasin perd des heures sur des décisions qui lui appartiennent.",
      },
      {
        titre: 'Des incidents incomparables',
        texte:
          "Rédigés en texte libre, les problèmes ne se comptent pas. Un défaut récurrent dans le réseau reste invisible jusqu'à ce qu'il coûte cher.",
      },
    ],
    benefices: [
      {
        titre: 'La journée sur un écran',
        texte:
          "Commandes à préparer, tournées engagées, incidents ouverts, avec les compteurs qui disent où ça coince.",
      },
      {
        titre: 'Un seul stock',
        texte:
          "La disponibilité vue au magasin est celle que consulte le webshop. Fermer un produit le retire de la vente immédiatement.",
      },
      {
        titre: 'Le local reste local',
        texte:
          "Clients B2B, créneaux, frais de livraison et promotions du magasin se gèrent sans passer par le siège.",
      },
      {
        titre: 'Des incidents qui se comptent',
        texte:
          "Les mêmes motifs codifiés que l'app chauffeur, donc des chiffres comparables entre boutiques.",
      },
    ],
    mermaid: `flowchart TD
  A[Commandes du jour] --> B[Preparation]
  B --> C[Chargement verifie]
  C --> D[Tournee]
  D --> E[Livre ou incident]
  F[Stock du jour] --> G[Webshop]
  F --> B
  E --> H[Incidents et litiges]
  H --> I[Rentabilite par tournee]`,
    leviers: ["xp", "food", "labour", "overhead"],
    liens: [{"slug": "webshop", "sens": "envoie", "quoi": "la disponibilité qui autorise ou bloque une vente"}, {"slug": "cuisine", "sens": "envoie", "quoi": "les commandes à produire dans la journée"}, {"slug": "livraison", "sens": "envoie", "quoi": "les tournées et le bon de chargement à contre-scanner"}, {"slug": "livraison", "sens": "recoit", "quoi": "les preuves de livraison et les incidents"}],
    onboarding:
      "À ouvrir le matin. La journée du magasin y tient sur un écran : ce qu'il faut préparer, ce qui part en tournée, ce qui manque. Le franchisé y gère ce qui lui appartient sans passer par le siège.",
    fonctions: [
      { cle: 'dashboard', icone: 'bar-chart', nom: 'Tableau de bord du jour', leviers: ["labour", "xp"], description: "Commandes à préparer, tournées engagées, incidents ouverts : la journée du magasin sur un écran, avec les compteurs qui disent où ça coince.", benefice: "Le responsable sait où porter son attention en arrivant." },
      { cle: 'preparation', icone: 'clipboard-check', nom: 'Préparation des commandes', leviers: ["labour"], description: "Les commandes du jour regroupées par tournée ou à plat, avec le détail article par article. C'est la liste que suit l'équipe en cuisine et que le chauffeur contre-scanne au chargement.", benefice: "Une seule liste sert la production et le contrôle au départ." },
      { cle: 'livraison', icone: 'truck', nom: 'Livraison du jour', leviers: ["xp", "labour"], description: "L'état des tournées en cours vu du magasin : ce qui est parti, ce qui est livré, ce qui traîne.", benefice: "Le magasin répond au client sans appeler le chauffeur." },
      { cle: 'stock', icone: 'package', nom: 'Stock du jour', leviers: ["food"], description: "La disponibilité par produit et par jour, celle-là même que le webshop consulte avant d'accepter une commande.", benefice: "Fermer un produit ici le retire de la vente en ligne tout de suite." },
      { cle: 'b2b', icone: 'users', nom: 'Clients et demandes B2B', leviers: ["recurrence"], description: "Les entreprises livrées : sociétés, services, sites de livraison, e-mails de facturation. Les demandes entrantes se traitent ici et alimentent les tournées.", benefice: "Le franchisé développe son B2B sans dépendre du siège." },
      { cle: 'incidents', icone: 'triangle-alert', nom: 'Incidents et litiges', leviers: ["xp"], description: "Les incidents remontés du terrain — colis manquant, client absent, litige de facturation — avec leur preuve et leur suite, sur les mêmes motifs codifiés que l'app chauffeur.", benefice: "Les problèmes se comptent au lieu de se raconter." },
      { cle: 'capacite', icone: 'clock', nom: 'Capacité et remplissage', leviers: ["labour", "xp"], description: "Les créneaux, leur remplissage et les fermetures exceptionnelles.", benefice: "Ce qui est vendu en ligne reste produisible en cuisine." },
      { cle: 'rentabilite', icone: 'trending-up', nom: 'Rentabilité', leviers: ["overhead", "food"], description: "Ce que rapporte réellement une tournée ou un client une fois les frais de livraison posés en face.", benefice: "La discussion sur les frais se fait sur des chiffres." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'fournisseurs',
    repo: 'samsam2703MFC/supplier_atl',
    groupe: 'Approvisionnement',
    icone: 'building-2',
    ordre: 4,
    nom: 'Fournisseur',
    accroche: "L'atelier de production : matières, recettes, coût de revient et commandes du réseau.",
    resume:
      "Le module que fait tourner l'atelier qui produit pour le réseau. Il tient la chaîne complète : matières premières, recettes et fiches techniques, coût de revient, puis catalogue et liste de prix négociée client par client. Les commandes des points de vente arrivent dedans, la logistique les expédie.",
    public_cible: 'Ateliers de production et fournisseurs du réseau',
    description: `Dans un réseau qui produit, la marge se joue en amont. Tant que le coût de revient d'un produit se devine, la grille tarifaire proposée aux points de vente est un pari — et personne ne peut dire si une référence est rentable.

Le module fournisseur remonte la chaîne jusqu'aux matières premières. Chaque ingrédient a son unité et son prix d'achat, chaque produit fabriqué a sa recette et sa fiche technique. Le coût de revient en découle mécaniquement, et sert de socle aux prix négociés.

Le catalogue fournisseur est exposé aux points de vente : le magasin commande sur le vrai référentiel, pas sur un PDF envoyé une fois en début d'année. Chaque client dispose de sa grille de prix, saisie à la main ou importée en JSON avec validation avant écriture — reprendre un tarif annuel ne veut plus dire retaper deux cents lignes.

Les commandes du réseau arrivent, sont préparées, expédiées et suivies au tarif du client qui les a passées. Les réclamations reviennent au même endroit, ce qui fait que le fournisseur et le point de vente parlent du même dossier au lieu d'échanger des courriels.`,
    stack: ['PHP', 'Twig', 'MySQL', 'FastRoute', 'JWT'],
    mots_cles: ['fournisseur', 'recettes', 'coût de revient', 'tarifs', 'logistique'],
    problemes: [
      {
        titre: 'Un coût de revient approximatif',
        texte:
          "Sans lien entre les matières et les recettes, le prix de vente se fixe au ressenti. Une référence peut se vendre à perte pendant des mois.",
      },
      {
        titre: 'Des tarifs qui vivent dans des fichiers',
        texte:
          "Chaque client a sa grille, dans un tableur, dans un PDF, parfois dans un courriel. La renégociation annuelle devient un chantier de ressaisie.",
      },
      {
        titre: 'Les réclamations se perdent',
        texte:
          "Quand un retour se traite par téléphone, personne ne sait combien de fois le même défaut est revenu.",
      },
    ],
    benefices: [
      {
        titre: 'Une marge calculée, pas estimée',
        texte:
          "Matières, recettes et fiches techniques donnent un coût de revient à chaque produit fabriqué.",
      },
      {
        titre: "Un tarif par client, tenu à jour",
        texte:
          "La grille se saisit ou s'importe en JSON avec validation. Une renégociation annuelle prend une importation.",
      },
      {
        titre: 'Le réseau commande sur le vrai catalogue',
        texte:
          "Le point de vente voit ce que l'atelier propose réellement, avec son propre tarif.",
      },
      {
        titre: 'Un dossier partagé pour les litiges',
        texte:
          "Les réclamations sont tracées avec leur suite. Le fournisseur et le magasin parlent du même incident.",
      },
    ],
    mermaid: `flowchart TD
  A[Matieres premieres] --> B[Recettes et fiches techniques]
  B --> C[Cout de revient]
  C --> D[Catalogue fournisseur]
  D --> E[Liste de prix par client]
  E --> F[Commandes des points de vente]
  F --> G[Logistique et expedition]
  G --> H[Reclamations]
  H --> I[Analyse des ventes et des marges]`,
    leviers: ["food", "overhead"],
    liens: [{"slug": "cuisine", "sens": "envoie", "quoi": "les recettes, fiches techniques et coûts de revient"}, {"slug": "console-franchise", "sens": "recoit", "quoi": "les commandes des points de vente"}],
    onboarding:
      "Le point de départ de la marge. Vous saisissez les matières et les recettes, le coût de revient en découle, et la grille tarifaire de chaque point de vente cesse d'être un pari.",
    fonctions: [
      { cle: 'matieres', icone: 'package', nom: 'Matières premières et ingrédients', leviers: ["food"], description: "Le référentiel amont : matières, ingrédients, unités et prix d'achat. C'est ce qui donne un coût de revient à chaque recette au lieu d'un prix décidé au doigt mouillé.", benefice: "La marge se calcule à partir de données, pas d'intuitions." },
      { cle: 'recettes', icone: 'chef-hat', nom: 'Recettes et fiches techniques', leviers: ["food", "xp"], description: "Chaque produit fabriqué a sa recette et sa fiche technique : composants, quantités, process. La fiche sert autant à produire qu'à répondre à un client sur ce qu'il y a dedans.", benefice: "Le savoir-faire est écrit, donc transmissible." },
      { cle: 'catalogue', icone: 'book-open', nom: 'Catalogue fournisseur', leviers: ["food"], description: "Ce que l'atelier propose au réseau, avec l'accès client au catalogue : le point de vente commande sur le vrai référentiel, pas sur un PDF envoyé une fois.", benefice: "Fini les commandes passées sur un tarif périmé." },
      { cle: 'cennik', icone: 'credit-card', nom: 'Liste de prix par client', leviers: ["food", "overhead"], description: "Chaque client a sa grille négociée. Elle se saisit à la main ou s'importe en JSON, validée avant écriture.", benefice: "Reprendre un tarif annuel ne veut plus dire retaper deux cents lignes." },
      { cle: 'commandes', icone: 'clipboard-check', nom: 'Commandes des points de vente', leviers: ["food"], description: "Les commandes arrivent du réseau, sont préparées et suivies jusqu'à l'expédition, au tarif du client qui les a passées.", benefice: "Le bon prix s'applique sans vérification manuelle." },
      { cle: 'logistique', icone: 'truck', nom: 'Logistique et expéditions', leviers: ["overhead"], description: "Les départs, les regroupements et ce qui part vers quel point de vente — l'écran qui dit ce qui est réellement sorti de l'atelier aujourd'hui.", benefice: "L'atelier sait ce qu'il a expédié sans compter les palettes." },
      { cle: 'reclamations', icone: 'triangle-alert', nom: 'Réclamations', leviers: ["xp"], description: "Les retours du réseau sur un produit ou une livraison, tracés avec leur suite.", benefice: "Un défaut récurrent devient visible avant de coûter cher." },
      { cle: 'analytics', icone: 'trending-up', nom: 'Analyse des ventes', leviers: ["food", "overhead"], description: "Ce qui se vend, à qui, à quelle marge, sur la base des vraies commandes et des vrais coûts de revient plutôt que d'un export retravaillé.", benefice: "Les décisions d'assortiment s'appuient sur la marge réelle." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'cuisine',
    repo: 'samsam2703MFC/pwa_kitchen',
    groupe: 'Terrain',
    icone: 'chef-hat',
    ordre: 5,
    nom: 'Cuisine',
    accroche: "L'application du plan de travail : production du jour, checklists, fiches techniques.",
    resume:
      "Une application installable, tenue à une main derrière le plan de travail. Elle dit à l'équipe ce qu'il faut produire aujourd'hui, dans quel ordre, avec les fiches produit et les recettes à portée. Les checklists remplacent les feuilles plastifiées.",
    public_cible: 'Équipes de production en point de vente',
    description: `La cuisine d'un point de vente fonctionne encore, dans la plupart des réseaux, avec des feuilles imprimées le matin et un classeur de fiches techniques que personne ne rouvre. Quand le responsable change, la moitié du tour de main part avec lui.

L'application cuisine tient sur le téléphone ou la tablette du poste. Elle ouvre sur ce qu'il y a à produire aujourd'hui, avec l'avancement par tâche — à faire, en cours, terminé — plutôt que sur un menu. Les commandes réelles des clients sont là, pas une recopie.

Les checklists d'ouverture, de service et de fermeture se cochent dans l'app, horodatées et attribuées. La différence avec la feuille plastifiée n'est pas le confort : c'est qu'un contrôle coché sans nom ni heure ne prouve rien, et qu'un réseau qui veut être transmissible doit pouvoir montrer que ses procédures sont réellement suivies.

Les fiches produit et les recettes viennent du même référentiel que celui tenu par le fournisseur. Une nouvelle recette arrive au poste de travail sans réimpression, et un problème constaté en production se déclare sur place au lieu de rester dans un carnet.`,
    stack: ['PHP', 'Twig', 'MySQL', 'PWA'],
    mots_cles: ['cuisine', 'production', 'checklists', 'fiches techniques', 'PWA'],
    problemes: [
      {
        titre: 'Le savoir-faire part avec la personne',
        texte:
          "Quand les recettes et les tours de main ne sont écrits nulle part, le départ d'un responsable coûte des mois de réapprentissage.",
      },
      {
        titre: 'Des contrôles impossibles à prouver',
        texte:
          "Une case cochée sur une feuille plastifiée, sans nom ni heure, ne vaut rien le jour où il faut démontrer qu'une procédure est suivie.",
      },
      {
        titre: 'La production travaille sur une recopie',
        texte:
          "Recopier les commandes du matin introduit des erreurs, et personne ne sait laquelle des deux listes fait foi.",
      },
    ],
    benefices: [
      {
        titre: 'Les procédures vivent dans l\'outil',
        texte:
          "Recettes, fiches techniques et checklists sont au poste de travail. Le savoir-faire ne dépend plus d'une personne.",
      },
      {
        titre: 'Des contrôles prouvables',
        texte:
          "Chaque tâche cochée porte un nom et une heure. Ce qui a été fait est démontrable sans classeur.",
      },
      {
        titre: 'La commande réelle, pas sa copie',
        texte:
          "La cuisine travaille sur la commande du client telle qu'elle a été passée.",
      },
      {
        titre: "Aucune installation à gérer",
        texte:
          "L'app s'installe depuis le navigateur, sans boutique d'applications ni intervention informatique.",
      },
    ],
    mermaid: `flowchart TD
  A[Commandes du jour] --> B[Production du jour]
  B --> C{Avancement par tache}
  C --> D[A faire]
  C --> E[En cours]
  C --> F[Termine]
  G[Recettes et fiches techniques] --> B
  B --> H[Checklists de poste horodatees]
  B --> I[Reclamation declaree au poste]`,
    leviers: ["xp", "food", "labour"],
    liens: [{"slug": "console-franchise", "sens": "recoit", "quoi": "les commandes du jour et le stock"}, {"slug": "fournisseurs", "sens": "recoit", "quoi": "les recettes et les fiches techniques"}, {"slug": "livraison", "sens": "envoie", "quoi": "ce qui est prêt à charger"}],
    onboarding:
      "Installable depuis le navigateur, sans informatique sur place. L'équipe voit ce qu'il y a à produire et coche ses contrôles ; chaque case porte un nom et une heure.",
    fonctions: [
      { cle: 'production', icone: 'chef-hat', nom: 'Production du jour', leviers: ["labour", "food"], description: "Ce qu'il y a à faire aujourd'hui, avec l'avancement par tâche : à faire, en cours, terminé. Le tableau de bord ouvre sur cet état, pas sur un menu.", benefice: "L'équipe voit l'essentiel en déverrouillant l'écran." },
      { cle: 'checklists', icone: 'clipboard-check', nom: 'Checklists de poste', leviers: ["xp"], description: "Les contrôles d'ouverture, de service et de fermeture cochés dans l'app, horodatés et attribués.", benefice: "Ce qui a été fait est prouvable sans classeur." },
      { cle: 'fiches', icone: 'file-text', nom: 'Produits et recettes', leviers: ["xp", "food"], description: "La base de connaissances de la cuisine : fiche produit, recette, fiche technique. Le même contenu que celui tenu par le fournisseur, consulté au poste de travail.", benefice: "Une recette nouvelle arrive au poste sans réimpression." },
      { cle: 'commandes', icone: 'package', nom: 'Commandes à produire', leviers: ["labour"], description: "Les commandes qui concernent la cuisine, avec leur détail. La cuisine travaille sur la commande réelle du client, pas sur une recopie.", benefice: "Une erreur de recopie en moins entre le client et le four." },
      { cle: 'clients', icone: 'users', nom: 'Clients servis', leviers: ["recurrence"], description: "Qui est livré, avec quelles particularités. Utile quand une commande B2B revient chaque semaine avec ses contraintes.", benefice: "Les habitudes d'un client régulier ne se redécouvrent pas." },
      { cle: 'reclamations', icone: 'triangle-alert', nom: 'Réclamations', leviers: ["xp"], description: "Un problème constaté en production se déclare sur place, avec son motif. Il part vers le fournisseur ou le siège au lieu de rester dans un carnet.", benefice: "Le défaut remonte le jour où il est vu." },
      { cle: 'hors-ligne', icone: 'smartphone', nom: 'Installable et hors ligne', leviers: ["overhead"], description: "L'app s'installe sur le téléphone ou la tablette de la cuisine depuis le navigateur, sans boutique d'applications ni intervention IT, et supporte les coupures réseau du magasin.", benefice: "Déployer un magasin de plus ne demande aucune informatique sur place." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'consultant',
    repo: 'samsam2703MFC/pwa_consultant',
    groupe: 'Terrain',
    icone: 'clipboard-check',
    ordre: 6,
    nom: 'Panel consultant',
    accroche: "L'application terrain des animateurs réseau : visites, checklists notées, comptes rendus.",
    resume:
      "L'animateur réseau passe sa journée en magasin, pas devant un tableur. Le panel lui donne son agenda de visites, les checklists à passer point de vente par point de vente, et de quoi noter et commenter chaque tâche vérifiée — avec le nom du vérificateur et l'horodatage.",
    public_cible: "Animateurs réseau et responsables d'exploitation",
    description: `L'animation réseau est le métier qui décide si une enseigne tient ses standards. C'est aussi celui qui se pratique le plus souvent sans outil : un carnet dans la voiture, un tableur le soir, et un compte rendu rédigé de mémoire trois jours plus tard.

Le panel consultant met la visite au centre. L'agenda liste les points de vente à voir, avec ce qui avait été laissé ouvert la fois précédente. Sur place, les checklists se passent tâche par tâche : chacune est vérifiée, notée et commentée, et la revue porte le nom de son auteur et son horodatage.

Ce détail est l'essentiel du module. « Vérifié » sans savoir par qui ni quand ne vaut rien — ni pour corriger, ni pour prouver, ni pour transmettre. Un réseau dont les contrôles sont datés et signés peut démontrer à un repreneur que ses standards existent ailleurs que dans le discours.

Les objectifs par indicateur, la tendance sur la période et les leviers identifiés sont sur le même écran : la conversation avec le franchisé s'appuie sur ces trois vues plutôt que sur une impression. Le compte rendu se construit à partir de ce qui a été réellement vérifié sur place, et se valide côté propriétaire. Personne ne retape la visite le soir.`,
    stack: ['PHP', 'Twig', 'MySQL', 'PWA'],
    mots_cles: ['animation réseau', 'visites', 'checklists', 'audit', 'terrain'],
    problemes: [
      {
        titre: 'Des visites sans trace exploitable',
        texte:
          "Un compte rendu rédigé de mémoire trois jours après la visite perd l'essentiel. Ce qui n'est pas noté sur place n'existe pas.",
      },
      {
        titre: '« Vérifié » par personne',
        texte:
          "Un contrôle sans nom ni horodatage ne prouve rien. Le jour où il faut démontrer qu'un standard est appliqué, il n'y a rien à montrer.",
      },
      {
        titre: 'La discussion tourne au ressenti',
        texte:
          "Sans objectifs ni tendance sous les yeux, l'échange avec le franchisé se joue sur des impressions et se rejoue à chaque visite.",
      },
    ],
    benefices: [
      {
        titre: 'Le contrôle devient une preuve',
        texte:
          "Chaque tâche vérifiée porte une note, un commentaire, un nom et une heure.",
      },
      {
        titre: 'Zéro ressaisie après la visite',
        texte:
          "Le compte rendu se construit à partir de ce qui a été relevé sur place, et se valide côté propriétaire.",
      },
      {
        titre: 'Une conversation appuyée sur des chiffres',
        texte:
          "Objectifs, tendance et leviers sur le même écran que la checklist.",
      },
      {
        titre: 'La mémoire du magasin se conserve',
        texte:
          "Ce qui restait ouvert à la visite précédente est retrouvé à la suivante, quel que soit l'animateur.",
      },
    ],
    mermaid: `flowchart TD
  A[Agenda des visites] --> B[Preparation avant depart]
  B --> C[Visite en magasin]
  C --> D[Checklist notee et commentee]
  D --> E[Nom du verificateur et horodatage]
  C --> F[Objectifs tendances leviers]
  D --> G[Compte rendu]
  F --> G
  G --> H[Validation cote proprietaire]`,
    leviers: ["trafic", "recurrence", "xp", "food", "labour", "overhead"],
    liens: [{"slug": "console-marque", "sens": "envoie", "quoi": "les visites notées et les leviers à travailler"}, {"slug": "console-franchise", "sens": "recoit", "quoi": "les chiffres du magasin visité"}],
    onboarding:
      "L'outil de l'animateur réseau. Il prépare sa visite, la passe checklist par checklist, et repart avec un compte rendu déjà écrit. Les 6 leviers sont l'ossature de la conversation avec le franchisé.",
    fonctions: [
      { cle: 'agenda', icone: 'calendar', nom: 'Agenda des visites', leviers: ["overhead"], description: "Les visites planifiées par point de vente, préparées avant de partir et retrouvées sur place. L'animateur sait ce qu'il va voir et ce qu'il a laissé ouvert la dernière fois.", benefice: "Rien ne se perd entre deux passages." },
      { cle: 'checklists', icone: 'clipboard-check', nom: 'Checklists de visite notées', leviers: ["xp"], description: "Chaque tâche du magasin est vérifiée, notée et commentée, et la revue porte le nom de son auteur et son horodatage.", benefice: "Le contrôle devient démontrable, pas déclaratif." },
      { cle: 'objectifs', icone: 'trending-up', nom: 'Objectifs, tendances et leviers', leviers: ["trafic", "recurrence"], description: "Les cibles par indicateur et par magasin, la tendance sur la période, et les leviers identifiés pour la corriger.", benefice: "La discussion avec le franchisé porte sur des chiffres." },
      { cle: 'reclamations', icone: 'triangle-alert', nom: 'Réclamations matériel', leviers: ["overhead"], description: "Ce qui est cassé ou manquant se déclare pendant la visite, sur plusieurs magasins d'un coup quand le même problème revient dans le réseau.", benefice: "Un défaut de série se traite en une fois." },
      { cle: 'rapports', icone: 'file-text', nom: 'Comptes rendus de visite', leviers: ["labour"], description: "Le compte rendu se construit à partir de ce qui a été vérifié sur place, et se valide côté propriétaire.", benefice: "Personne ne retape la visite le soir." },
      { cle: 'notes', icone: 'pencil', nom: 'Notes de terrain', leviers: ["xp"], description: "Les remarques prises au passage, rattachées au magasin et retrouvées à la visite suivante — plutôt qu'un carnet qui reste dans la voiture.", benefice: "La mémoire du magasin survit au changement d'animateur." },
      { cle: 'kiosque', icone: 'smartphone', nom: 'Installable et plein écran', leviers: ["overhead"], description: "L'app s'installe depuis le navigateur et s'ouvre sans barre d'adresse. Sur un écran fixe en magasin, elle se lance en mode kiosque.", benefice: "Un poste de plus se met en service en quelques minutes." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'livraison',
    repo: 'samsam2703MFC/pwa_delivery',
    groupe: 'Approvisionnement',
    icone: 'truck',
    ordre: 7,
    nom: 'Tournées de livraison',
    accroche: "L'application tablette du chauffeur : chargement vérifié, tournée guidée, preuve de livraison.",
    resume:
      "Une tablette partagée au dépôt, une session liée à la tournée du jour. Le chauffeur vérifie son chargement au scan, suit un ordre de passage qui ne bouge plus, et repart de chaque point avec une preuve datée. Tout fonctionne hors ligne.",
    public_cible: 'Chauffeurs livreurs, salariés ou sous-traitants',
    description: `La livraison est l'endroit où un réseau perd de l'argent sans le voir. Un colis manquant se découvre chez le client, un litige se règle au téléphone contre la parole du chauffeur, et personne ne sait combien de fois le cas s'est reproduit ce mois-ci.

L'application impose deux points de contrôle. Au départ, le double scan : le chauffeur scanne ce qu'il embarque, l'app le confronte au bon préparé par le magasin, les manquants sont listés par client, et le départ reste bloqué tant que l'emport est incomplet — sauf dérogation, elle aussi journalisée avec son auteur.

À l'arrivée, la preuve : dépôt scanné, photo géolocalisée, puis un QR code qui tourne et que le client scanne pour confirmer la réception. Si le client n'a pas de téléphone, la preuve retombe sur un code PIN, une signature ou la photo seule. Les incidents se choisissent dans une liste fermée de motifs, jamais en texte libre, pour que le siège lise des chiffres comparables entre tournées.

Le tout fonctionne hors ligne par construction. La tournée entière tient dans la tablette ; sans réseau, le chauffeur continue à scanner, photographier et clôturer. Les écritures partent à la reconnexion, dans l'ordre, chacune avec une clé d'idempotence pour qu'un rejeu ne crée jamais de doublon.`,
    stack: ['JavaScript', 'PWA', 'Service Worker'],
    mots_cles: ['livraison', 'tournées', 'preuve de livraison', 'hors ligne', 'PWA'],
    problemes: [
      {
        titre: 'Le manquant se découvre chez le client',
        texte:
          "Sans contrôle au chargement, l'erreur se constate à l'arrivée. Le magasin refait la course ou perd la commande.",
      },
      {
        titre: 'Un litige contre une parole',
        texte:
          "Sans preuve datée et localisée, chaque contestation de livraison se règle au bénéfice du doute — toujours le même qui paie.",
      },
      {
        titre: 'Des motifs en texte libre',
        texte:
          "Quand chaque chauffeur décrit l'incident à sa façon, le siège ne peut ni compter ni comparer.",
      },
      {
        titre: 'Le réseau coupe, la tournée s\'arrête',
        texte:
          "Une application qui exige la connexion devient inutilisable en zone blanche, c'est-à-dire là où se font les livraisons.",
      },
    ],
    benefices: [
      {
        titre: 'Le départ bloqué sur emport incomplet',
        texte:
          "Le double scan confronte le chargement au bon préparé. L'erreur se corrige au dépôt, pas chez le client.",
      },
      {
        titre: 'Une preuve à chaque point',
        texte:
          "Photo géolocalisée et confirmation du client par QR, avec repli sur PIN, signature ou photo seule.",
      },
      {
        titre: 'Des incidents comparables',
        texte:
          "Motifs codifiés, décision et preuve jointe. Le siège lit des chiffres, pas des récits.",
      },
      {
        titre: 'Utilisable en zone blanche',
        texte:
          "La tournée tient dans la tablette. Les écritures repartent à la reconnexion, sans doublon.",
      },
    ],
    mermaid: `flowchart TD
  A[Connexion chauffeur] --> B[Tournee du jour]
  B --> C[Chargement en double scan]
  C --> D{Emport complet}
  D -->|Non| C
  D -->|Oui| E[Ordre de passage figé]
  E --> F[Point de livraison]
  F --> G[Photo geolocalisee et QR client]
  F --> H[Incident avec motif codifie]
  G --> I[File hors ligne renvoyee a la reconnexion]
  H --> I`,
    leviers: ["xp", "labour", "overhead"],
    liens: [{"slug": "console-franchise", "sens": "recoit", "quoi": "la tournée assignée et le bon préparé"}, {"slug": "console-franchise", "sens": "envoie", "quoi": "les preuves datées et les incidents codifiés"}],
    onboarding:
      "Une tablette au dépôt, une session par tournée. Le double scan bloque un départ incomplet et chaque point de livraison laisse une preuve datée. Fonctionne sans réseau.",
    fonctions: [
      { cle: 'tournee', icone: 'map-pin', nom: 'Tournée du jour', leviers: ["xp", "labour"], description: "La tournée assignée s'ouvre avec ses chiffres : colis à livrer, points de passage, heure de départ et ETA de fin. L'ordre de passage est figé, il ne se réordonne pas en cours de route.", benefice: "Le magasin et le client savent quand la livraison passe." },
      { cle: 'chargement', icone: 'package', nom: 'Chargement en double scan', leviers: ["food", "labour"], description: "Le chauffeur scanne ce qu'il embarque, l'app le confronte au bon préparé par le magasin. Les manquants sont listés par client et le départ reste bloqué tant que l'emport est incomplet.", benefice: "L'erreur se corrige au dépôt, pas chez le client." },
      { cle: 'livraison', icone: 'clipboard-check', nom: 'Preuve de livraison', leviers: ["xp"], description: "À chaque point : dépôt scanné, photo géolocalisée, puis un QR qui tourne et que le client scanne pour confirmer. Repli sur code PIN, signature ou photo seule.", benefice: "Un litige se tranche sur une preuve datée." },
      { cle: 'incident', icone: 'triangle-alert', nom: 'Incidents codifiés', leviers: ["xp", "overhead"], description: "Client absent, adresse fermée, colis abîmé : le chauffeur choisit un motif dans une liste fermée, décide de la suite et joint la preuve.", benefice: "Le siège lit des motifs comparables entre tournées." },
      { cle: 'hors-ligne', icone: 'refresh-cw', nom: 'Hors ligne par défaut', leviers: ["labour"], description: "La tournée entière tient dans la tablette. Sans réseau, le chauffeur continue à scanner, photographier et clôturer ; les écritures partent à la reconnexion, dans l'ordre, sans doublon.", benefice: "La zone blanche n'interrompt plus la tournée." },
      { cle: 'contrat', icone: 'users', nom: 'Salarié ou sous-traitant', leviers: ["overhead", "labour"], description: "Le même écran sert les deux statuts : le chauffeur salarié voit son pointage de service, le sous-traitant ne l'a pas. Le type de contrat est porté par la session.", benefice: "Une seule application à maintenir pour les deux modèles." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'affichage',
    repo: 'samsam2703MFC/signage',
    groupe: 'Vente',
    icone: 'monitor',
    ordre: 8,
    nom: "Régie d'affichage",
    accroche: "Les écrans du magasin pilotés depuis un seul back office, jusqu'au player.",
    resume:
      "Un magasin affiche des prix, des promos et des menus sur ses écrans. La régie remplace le montage vidéo et la clé USB : on construit un film à partir de la base produits, on le planifie par période, on le pousse sur les écrans du réseau, et chaque écran remonte son état.",
    public_cible: 'Marketing réseau et responsables de point de vente',
    description: `Les écrans en magasin sont le dernier endroit où le prix affiché ne vient de nulle part. Quelqu'un monte une vidéo, la copie sur une clé USB, fait le tour des boutiques — et six semaines plus tard trois magasins affichent encore l'ancienne promotion.

La régie relie l'affichage à la base produits. Les listes de prix à l'écran sont liées à la table catalogue, pas retapées : un changement de tarif se propage au film suivant sans repasser par un logiciel de montage. Les jetons dynamiques — nom du magasin, date, saison — se résolvent à l'affichage, donc un même élément sert tout le réseau.

Le compositeur assemble une bibliothèque d'éléments en playlist : mise en page, mouvement, filigrane, réglés élément par élément. Les périodes décrivent les plages de la journée — le petit-déjeuner, le service du midi, le goûter n'affichent pas la même chose — et le planning dit quel film passe quand, sur l'horloge du magasin.

Chaque écran est un player authentifié par jeton qui envoie un battement de cœur et une capture. La supervision montre, magasin par magasin, ce qui est réellement affiché, et signale l'écran qui a décroché. La dernière playlist publiée est aussi consultable en plein écran à l'adresse publique, ce qui permet à un responsable de vérifier depuis son téléphone.`,
    stack: ['Node.js 22', 'SQLite', 'Preact'],
    mots_cles: ['affichage dynamique', 'digital signage', 'écrans magasin', 'campagnes', 'playlist'],
    problemes: [
      {
        titre: 'Le prix à l\'écran est faux',
        texte:
          "Quand l'affichage est monté à la main, il dérive du catalogue dès la première promotion. Le client voit un prix, la caisse en applique un autre.",
      },
      {
        titre: 'Une opération commerciale prend des semaines',
        texte:
          "Monter, copier et distribuer une vidéo par magasin fait qu'une campagne nationale n'est jamais lancée partout le même jour.",
      },
      {
        titre: 'Personne ne sait ce qui est affiché',
        texte:
          "Sans remontée des écrans, un player éteint ou bloqué sur l'ancienne campagne passe inaperçu pendant des semaines.",
      },
    ],
    benefices: [
      {
        titre: 'Le tarif affiché vient du catalogue',
        texte:
          "Les listes de prix sont liées à la table produits. Un changement se propage sans ressaisie.",
      },
      {
        titre: 'Une campagne bascule d\'un coup',
        texte:
          "Les éléments taggés en campagne s'activent ensemble, sur les écrans choisis.",
      },
      {
        titre: 'Ce qui est affiché est vérifiable',
        texte:
          "Chaque player remonte un battement de cœur et une capture. L'écran décroché est signalé.",
      },
      {
        titre: "L'affichage s'adapte à l'heure",
        texte:
          "Les périodes de la journée déclenchent le bon film sur l'horloge du magasin.",
      },
    ],
    mermaid: `flowchart TD
  A[Base produits et tarifs] --> B[Elements du compositeur]
  B --> C[Playlist et film]
  D[Campagnes] --> C
  C --> E[Planning par periode]
  E --> F[Publication vers les players]
  F --> G[Ecrans en magasin]
  G --> H[Battement de coeur et capture]
  H --> I[Supervision du reseau]`,
    leviers: ["trafic", "recurrence", "xp"],
    liens: [{"slug": "console-marque", "sens": "recoit", "quoi": "le catalogue, les tarifs et les campagnes"}],
    onboarding:
      "Vos écrans cessent d'être un montage vidéo. Le film se construit sur la base produits, se planifie par tranche horaire, et chaque écran remonte ce qu'il affiche vraiment.",
    fonctions: [
      { cle: 'compositeur', icone: 'layers', nom: 'Compositeur de film', leviers: ["trafic"], description: "La bibliothèque d'éléments — catégories, liaisons, promos — et la playlist qui en fait un film. Mise en page, mouvement, filigrane et jetons dynamiques se règlent élément par élément.", benefice: "Un montage vidéo de moins à sous-traiter." },
      { cle: 'produits', icone: 'book-open', nom: 'Produits et tarifs affichés', leviers: ["trafic", "food"], description: "Les listes de prix à l'écran sont liées à la table produits, pas retapées. Un changement de prix se propage au prochain film.", benefice: "Le prix vu par le client est celui de la caisse." },
      { cle: 'campagnes', icone: 'bell', nom: 'Campagnes et promotions', leviers: ["trafic", "recurrence"], description: "Les opérations commerciales sont taguées en campagne : on active une campagne et tous les éléments qui la portent basculent d'un coup, sur les écrans choisis.", benefice: "Une opération nationale démarre partout le même matin." },
      { cle: 'planning', icone: 'calendar', nom: 'Périodes et planning de diffusion', leviers: ["trafic"], description: "Le petit-déjeuner, le service du midi et le goûter n'affichent pas la même chose. Les périodes décrivent ces plages et le planning dit quel film passe quand.", benefice: "L'écran vend ce qui est disponible à cette heure-là." },
      { cle: 'reseau', icone: 'monitor', nom: 'Réseau et supervision des écrans', leviers: ["overhead"], description: "Chaque écran est un player authentifié par jeton qui envoie un battement de cœur et une capture. La supervision montre magasin par magasin ce qui est réellement affiché.", benefice: "Un écran décroché se voit le jour même." },
      { cle: 'film', icone: 'smartphone', nom: 'Visionneuse publique', leviers: ["xp"], description: "La dernière playlist publiée est consultable en plein écran sans connexion, à l'adresse /film.", benefice: "Le responsable vérifie l'affichage depuis son téléphone." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'recrutement',
    repo: 'samsam2703MFC/atelier-espace-candidat',
    groupe: 'Développement',
    icone: 'handshake',
    ordre: 9,
    nom: 'Recrutement de franchisés',
    accroche: "Du premier clic sur l'annonce à la signature, un seul dossier suivi.",
    resume:
      "Recruter un franchisé prend six à dix-huit mois et passe par une trentaine d'échanges. Ce module tient les quatre faces de ce parcours au même endroit : la page publique qui capte les candidatures, le CRM qui suit les étapes, l'espace où le candidat avance seul, et la vue du propriétaire qui dit ce que tout cela coûte.",
    public_cible: "Direction du développement, consultants recrutement, candidats franchisés",
    description: `Le recrutement de franchisés est le processus le plus mal outillé des réseaux, et le plus déterminant : c'est lui qui décide qui portera l'enseigne pendant dix ans. Dans la plupart des réseaux il vit dans une boîte mail, un tableur et la mémoire d'un consultant. Quand ce consultant part, la moitié des dossiers en cours devient illisible.

Ce module part du constat qu'un candidat traverse quatre surfaces, et qu'elles doivent raconter la même chose. La page publique présente l'enseigne, ses emplacements disponibles et son formulaire. Le CRM suit le dossier étape par étape, avec les documents attendus à chaque étape. L'espace candidat laisse la personne avancer seule — lire, regarder, simuler son financement, réserver un rendez-vous — sans mobiliser un consultant pour chaque question. Et la vue du propriétaire dit, en lecture seule, combien de candidats sont dans le tuyau, où ils bloquent, et ce que coûte une signature.

La liaison entre les quatre est l'adresse e-mail. Un envoi du formulaire crée d'un coup la trace brute du lead, le compte du portail candidat et la fiche CRM à l'étape « dossier reçu ». Aucune ressaisie, et surtout aucun candidat qui existe dans un outil mais pas dans l'autre.

Le parcours candidat n'est pas figé dans le code : les étapes, leur ordre, leur caractère bloquant, les documents qu'elles exigent et l'e-mail qu'elles déclenchent se paramètrent. Un réseau qui change sa méthode de recrutement change son paramétrage, pas son logiciel — et c'est précisément ce qui rend la méthode transmissible à un nouveau directeur du développement.

Les emplacements sont une table unique servie aux trois fronts : ils alimentent la liste déroulante du formulaire, les épingles de la carte publique et le carrousel d'opportunités du portail candidat. Une zone ouverte au recrutement se déclare une fois.`,
    stack: ['React', 'PHP', 'MySQL', 'Vite'],
    mots_cles: ['recrutement franchisé', 'CRM', 'espace candidat', 'parcours', 'DIP', 'signature électronique'],
    problemes: [
      {
        titre: 'Le dossier vit dans une boîte mail',
        texte:
          "Les pièces d'un candidat sont éparpillées entre des mails, un dossier partagé et la mémoire du consultant. Personne d'autre ne peut reprendre le dossier, et le réseau ne sait pas dire où en est un candidat sans appeler quelqu'un.",
      },
      {
        titre: 'Le candidat attend, et se refroidit',
        texte:
          "Entre deux rendez-vous, un candidat n'a rien à faire ni rien à lire. Le délai devient un signal négatif : celui qui abandonne au troisième mois est souvent celui qui n'avait simplement plus de nouvelles.",
      },
      {
        titre: 'La méthode de recrutement ne se transmet pas',
        texte:
          "Les étapes, les questions à poser, les documents à réclamer sont dans la tête du recruteur. Un départ, et le réseau réapprend son propre processus — au moment précis où il voudrait accélérer son développement.",
      },
      {
        titre: 'Le coût d\'une signature est inconnu',
        texte:
          "Salons, publicité, temps consultant, primes : les dépenses de recrutement sont réelles mais jamais rapportées au nombre de signatures. Le réseau investit sans savoir ce qu'il paie pour un franchisé.",
      },
    ],
    benefices: [
      {
        titre: 'Un candidat, un dossier, quatre vues',
        texte:
          "La page publique, le CRM, l'espace candidat et la vue du propriétaire lisent la même donnée, reliée par l'adresse e-mail. Le formulaire crée les trois enregistrements d'un coup.",
      },
      {
        titre: 'Le candidat avance sans vous',
        texte:
          "Vidéothèque, documents à lire, carte des emplacements, simulateur de financement, créneaux de rendez-vous : entre deux échanges, il progresse seul et vous le voyez progresser.",
      },
      {
        titre: 'Le parcours est un paramétrage',
        texte:
          "Étapes, ordre, caractère bloquant, documents exigés et e-mail déclenché se règlent dans l'interface. La méthode du réseau est écrite quelque part, donc reprenable.",
      },
      {
        titre: 'Le coût par signature est un chiffre',
        texte:
          "Fixe, primes, publicité, foires et campagnes sont additionnés et rapportés aux candidats et aux signatures. Le développement se pilote comme le reste du réseau.",
      },
      {
        titre: 'Les documents se génèrent et se relisent',
        texte:
          "Publipostage à partir de modèles à variables, annexes fixes, signature électronique, puis lecture assistée des pièces reçues avec synthèse et alertes.",
      },
    ],
    mermaid: `flowchart TD
  A[Page franchise publique] --> B[Formulaire de candidature]
  B --> C[Trace du lead]
  B --> D[Compte espace candidat]
  B --> E[Fiche CRM etape 1]
  E --> F[Etapes du parcours]
  F --> G[Documents et publipostage]
  G --> H[Signature electronique]
  F --> I[Rendez-vous et agenda]
  F --> J[Messagerie]
  D --> K[Videos badges carte simulateur]
  K --> L[Dossier de candidature]
  L --> E
  E --> M[Bilan du proprietaire]
  N[Emplacements] --> A
  N --> D`,
    leviers: ["overhead", "xp", "trafic"],
    liens: [
      {"slug": "console-marque", "sens": "envoie", "quoi": "le franchisé signé et sa zone, prêts à devenir un point de vente"},
      {"slug": "console-marque", "sens": "recoit", "quoi": "les emplacements ciblés par l'analyse géographique du réseau"},
      {"slug": "consultant", "sens": "envoie", "quoi": "le nouveau franchisé à accompagner sur ses premières visites"}
    ],
    onboarding:
      "C'est ici qu'un réseau grandit. Le candidat entre par l'annonce, avance seul entre deux rendez-vous, et vous voyez à tout moment où il en est et ce qu'il vous coûte. Rien de tout cela ne dépend plus de la mémoire d'un recruteur.",
    fonctions: [
      { cle: 'landing', icone: 'monitor', nom: 'Page franchise publique', leviers: ["trafic"], description: "La page qui présente l'enseigne aux candidats : carrousels photos et vidéos, carte des emplacements, formulaire de contact. Tout son contenu vient de la base — aucune ligne à modifier pour changer une diapositive.", benefice: "Le développement publie son annonce sans passer par un développeur." },
      { cle: 'leads', icone: 'users', nom: 'Candidatures entrantes', leviers: ["trafic", "overhead"], description: "Chaque envoi du formulaire est archivé tel quel, et crée en même temps le compte du portail et la fiche CRM. La trace brute n'est jamais effacée : c'est la sauvegarde de secours des candidatures.", benefice: "Aucune candidature ne se perd entre deux outils." },
      { cle: 'parcours', icone: 'clipboard-check', nom: 'Étapes du parcours', leviers: ["overhead"], description: "Les étapes du recrutement, leur ordre, celles qui bloquent la suite, les documents qu'elles réclament et l'e-mail qu'elles déclenchent. Le processus du réseau est décrit ici, pas dans une note de service.", benefice: "La méthode de recrutement survit au départ du recruteur." },
      { cle: 'candidats', icone: 'search', nom: 'Fiches candidats', leviers: ["overhead"], description: "Le dossier de chaque candidat : coordonnées, zone visée, étape courante, notes privées ou partagées, documents reçus par étape, motif de clôture.", benefice: "N'importe quel consultant reprend un dossier en trois minutes." },
      { cle: 'emplacements', icone: 'map-pin', nom: 'Emplacements et zones', leviers: ["trafic", "overhead"], description: "Une seule table sert les trois fronts : la liste déroulante du formulaire, les épingles de la carte publique et le carrousel d'opportunités du portail. Boutique existante, zone disponible ou zone ciblée sont distinguées.", benefice: "Une zone ouverte au recrutement se déclare une seule fois." },
      { cle: 'publipostage', icone: 'book-open', nom: 'Publipostage et contrats', leviers: ["overhead"], description: "Des modèles de documents à variables — DIP, contrat, bail — remplis avec les données du candidat, avec leurs annexes PDF fixes. Le document part complet du premier coup.", benefice: "Une heure de mise en forme par dossier en moins." },
      { cle: 'signature', icone: 'clipboard-check', nom: 'Signature électronique', leviers: ["overhead", "xp"], description: "Envoi à signer, relance et retour du document signé rattaché à l'étape. Le statut de signature est visible dans le dossier, pas dans la boîte mail de quelqu'un.", benefice: "Le délai de signature cesse d'être un angle mort." },
      { cle: 'lecture-ia', icone: 'search', nom: 'Lecture assistée des documents', leviers: ["overhead"], description: "Les pièces reçues sont analysées : synthèse, champs extraits, alertes sur ce qui manque ou détonne. Le consultant relit une synthèse au lieu de trente pages.", benefice: "Les pièces d'un dossier se contrôlent en quelques minutes." },
      { cle: 'lexique', icone: 'layers', nom: 'Lexique documentaire', leviers: ["overhead"], description: "La bibliothèque des types de documents du réseau — ce qu'est un DIP, ce que contient un contrat, quelle pièce sert à quoi — organisée et consultable par les consultants.", benefice: "Un consultant qui arrive sait quoi demander, et pourquoi." },
      { cle: 'rdv', icone: 'calendar', nom: 'Rendez-vous et Google Calendar', leviers: ["overhead", "xp"], description: "Les rendez-vous du parcours, leur lieu, leur statut, et leur synchronisation avec l'agenda du consultant. Le candidat réserve depuis son espace, le consultant les voit dans son calendrier.", benefice: "Plus d'aller-retour de dix messages pour caler une date." },
      { cle: 'messagerie', icone: 'bell', nom: 'Messagerie intégrée', leviers: ["xp", "overhead"], description: "Les e-mails envoyés et reçus sont journalisés dans le dossier du candidat, avec les modèles automatiques — dont l'accusé de réception sous 48 heures.", benefice: "L'historique de la relation est dans le dossier, pas dans une boîte personnelle." },
      { cle: 'espace-candidat', icone: 'smartphone', nom: 'Espace candidat', leviers: ["xp"], description: "Le portail du candidat, en deux niveaux : découverte à l'inscription, puis accès complet une fois le dossier validé. Ce que le candidat peut voir dépend de son avancement, pas d'un envoi manuel.", benefice: "Le candidat a quelque chose à faire entre deux rendez-vous." },
      { cle: 'journey', icone: 'trending-up', nom: 'Parcours en 8 étapes', leviers: ["xp"], description: "Le suivi visuel côté candidat : les huit étapes, la barre d'avancement, et surtout la prochaine action attendue de lui.", benefice: "Le candidat sait toujours ce qu'on attend de lui." },
      { cle: 'videotheque', icone: 'monitor', nom: 'Vidéothèque et quiz', leviers: ["xp"], description: "Les vidéos de présentation du réseau, avec leur progression de visionnage, puis un quiz qui vérifie ce qui a été compris et débloque un badge.", benefice: "La présentation du concept ne repose plus sur une réunion." },
      { cle: 'badges', icone: 'bell', nom: 'Collection de badges', leviers: ["xp"], description: "Neuf badges gagnés au fil du parcours. Un candidat engagé dans une collection est un candidat qui revient, et sa progression est un signal lisible pour le consultant.", benefice: "L'engagement du candidat devient mesurable." },
      { cle: 'carte', icone: 'map-pin', nom: 'Carte des emplacements', leviers: ["xp", "trafic"], description: "La carte du territoire vue par le candidat : boutiques existantes, zones disponibles, zones ciblées, avec le détail de chaque emplacement et un carrousel des opportunités d'ouverture.", benefice: "Le candidat se projette sur un territoire réel, pas sur une promesse." },
      { cle: 'investisseurs', icone: 'credit-card', nom: 'Financement et investisseurs', leviers: ["xp", "overhead"], description: "Les partenaires financiers du réseau et un simulateur d'apport et de mensualité. Le candidat teste son plan avant le premier rendez-vous bancaire.", benefice: "La question de l'argent se pose tôt, sur des chiffres." },
      { cle: 'agenda', icone: 'clock', nom: 'Créneaux réservables', leviers: ["xp"], description: "Les disponibilités du consultant groupées par jour, réservables depuis l'espace candidat, plus la journée découverte réservée aux dossiers validés.", benefice: "Le rendez-vous se prend quand le candidat y pense, pas trois jours plus tard." },
      { cle: 'candidature', icone: 'clipboard-check', nom: 'Dossier de candidature', leviers: ["overhead", "xp"], description: "Le formulaire détaillé — apport, expérience, motivation, zone. Son envoi valide le dossier, débloque le niveau 2 du portail et bascule la fiche CRM.", benefice: "Le passage à l'étape suivante est déclenché par le candidat, pas relancé par vous." },
      { cle: 'bilan', icone: 'bar-chart', nom: 'Bilan du propriétaire', leviers: ["overhead"], description: "Une vue en lecture seule, sur téléphone : candidats actifs, en attente, signés, abandonnés, répartition par étape et par zone, motifs d'abandon, candidatures des 7 et 30 derniers jours.", benefice: "Le propriétaire suit son développement sans ouvrir le CRM." },
      { cle: 'couts', icone: 'trending-up', nom: 'Coût du recrutement', leviers: ["overhead"], description: "Fixe, primes de signature, publicité, foires et salons, campagnes par prestataire — additionnés puis rapportés au nombre de candidats et de signatures.", benefice: "On sait enfin ce que coûte un franchisé recruté." },
      { cle: 'acces', icone: 'settings', nom: 'Comptes et journal de connexion', leviers: ["overhead"], description: "Les comptes consultants avec leur rôle, révocables, et le journal de chaque connexion, échec et déconnexion avec l'adresse et le navigateur.", benefice: "L'accès aux dossiers candidats est traçable." },
    ],
  },
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "redevances",
    repo: "samsam2703MFC/royalties",
    groupe: "Pilotage",
    icone: "wallet",
    ordre: 10,
    nom: "Redevances",
    accroche: "Royalties et redevance marketing calculées, encaissées et, au besoin, bloquantes.",
    resume:
      "Les redevances se calculent sur le chiffre réel remonté des caisses : royalties, redevance marketing, minima contractuels. L'impayé suit une escalade écrite — relance, restriction, blocage — et le paiement reçu rouvre les services sans intervention manuelle.",
    public_cible: "Direction financière du réseau",
    description: `La redevance est le revenu du franchiseur, et c'est souvent le flux le plus mal outillé du réseau : une assiette déclarée par le franchisé, un calcul refait dans un tableur, et un impayé qui traîne parce que personne ne veut déclencher le conflit.

Le module part du chiffre réel remonté des caisses. Taux, assiette, minima et exonérations sont posés dans le contrat de chaque boutique ; la facture part seule à la clôture de période, avec le détail du calcul joint. L'impayé suit une escalade écrite : relances datées, restriction des services de confort, puis blocage — jamais l'encaissement du magasin. Le paiement reçu débloque immédiatement, et chaque étape est journalisée avec son auteur et sa règle.`,
    stack: ["PHP","MySQL","SEPA"],
    mots_cles: ["royalties","redevance marketing","prélèvement","blocage"],
    problemes: [
      {
        titre: "La redevance se calcule sur du déclaratif",
        texte:
          "Quand le franchisé déclare lui-même son chiffre, chaque facture devient une négociation. Le siège encaisse en retard, et en dessous.",
      },
      {
        titre: "L'impayé n'a pas de conséquence",
        texte:
          "Sans mécanisme gradué, un impayé traîne des mois. Le franchisé qui paie à l'heure se demande pourquoi il continue.",
      },
      {
        titre: "Le contrat vit dans un classeur",
        texte:
          "Taux, assiette et minima varient par contrat. Recalculés à la main chaque mois, ils finissent par diverger de ce qui est signé.",
      },
    ],
    benefices: [
      {
        titre: "Calculées sur le chiffre réel",
        texte:
          "L'assiette vient des encaissements remontés, pas d'une déclaration mensuelle.",
      },
      {
        titre: "Une escalade écrite",
        texte:
          "Relance, restriction, blocage : chaque étape est une règle datée et journalisée, connue d'avance.",
      },
      {
        titre: "Le contrat est le paramétrage",
        texte:
          "Taux, assiette, minima et exonérations se règlent boutique par boutique.",
      },
      {
        titre: "Le déblocage est immédiat",
        texte:
          "Le paiement reçu rouvre les services sans intervention manuelle.",
      },
    ],
    mermaid: `flowchart TD
  A[Encaissements remontes] --> B[Calcul par contrat]
  B --> C[Facture automatique]
  C --> D{Payee}
  D -->|Oui| E[Rapprochement]
  D -->|Non| F[Relances graduees]
  F --> G[Restriction puis blocage]
  G --> H[Paiement recu]
  H --> I[Deblocage immediat]`,
    leviers: ["overhead","recurrence"],
    liens: [{"slug":"pos","sens":"recoit","quoi":"les encaissements qui servent d'assiette au calcul"},{"slug":"console-marque","sens":"envoie","quoi":"l'état des paiements du réseau"}],
    onboarding:
      "À brancher dès que les ventes remontent. Le calcul part du chiffre réel, la facture part toute seule, et l'impayé suit une escalade écrite : relance, restriction, blocage — puis déblocage immédiat au paiement.",
    fonctions: [
      { cle: "calcul", icone: "percent", nom: "Calcul des redevances", leviers: ["overhead"], description: "Royalties et redevance marketing calculées par période sur le chiffre remonté, avec taux, assiette et minima propres à chaque contrat.", benefice: "La facture part juste, sans tableur." },
      { cle: "facturation", icone: "receipt", nom: "Facturation automatique", leviers: ["overhead"], description: "Les factures de redevances partent seules à la clôture de période, avec le détail du calcul joint.", benefice: "Personne ne passe le premier du mois à facturer." },
      { cle: "encaissement", icone: "credit-card", nom: "Prélèvement et encaissement", leviers: ["overhead"], description: "Prélèvement SEPA ou carte, rapprochement automatique du paiement et de la facture.", benefice: "L'encaissement cesse d'être une relance téléphonique." },
      { cle: "relances", icone: "bell", nom: "Relances graduées", leviers: ["overhead","xp"], description: "Les relances partent selon l'échéancier décidé au contrat, avec copie au consultant du magasin.", benefice: "L'impayé se traite avant de devenir un litige." },
      { cle: "blocage", icone: "lock", nom: "Suspension et blocage", leviers: ["overhead"], description: "L'impayé persistant restreint puis suspend les services selon la règle écrite : d'abord les modules de confort, jamais l'encaissement du magasin.", benefice: "La conséquence est connue d'avance, donc rarement nécessaire." },
      { cle: "audit", icone: "search", nom: "Journal et audit", leviers: ["overhead"], description: "Chaque calcul, facture, relance et blocage est journalisé avec son auteur et sa règle.", benefice: "Une contestation se tranche sur le journal, pas sur la mémoire." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "pos",
    repo: "samsam2703MFC/pos",
    groupe: "Vente",
    icone: "credit-card",
    ordre: 11,
    nom: "Caisse POS",
    accroche: "La caisse du magasin : bundles, promotions et encaissement reliés au catalogue réseau.",
    resume:
      "La caisse lit le même catalogue que le webshop et les écrans : produits, bundles, promotions du siège et du magasin. L'encaissement remonte en continu — c'est lui qui alimente le tableau de bord du jour et l'assiette des redevances.",
    public_cible: "Équipes de vente en point de vente",
    description: `Une caisse déconnectée du catalogue raconte sa propre histoire : un prix retapé à la main, une promotion oubliée, un bundle qui n'existe que sur l'affiche. Et comme le chiffre reste dans la caisse, le siège pilote sur des exports.

La caisse POS lit le référentiel réseau : produits, prix, formules et bundles viennent du catalogue, les promotions du siège et du magasin s'appliquent selon les mêmes règles que le webshop. L'encaissement remonte en continu vers la console du franchisé et sert d'assiette aux redevances. Le mode hors ligne encaisse pendant une coupure et resynchronise à la reconnexion, sans doublon.`,
    stack: ["React","PWA","MySQL"],
    mots_cles: ["caisse","POS","bundles","promotions","encaissement"],
    problemes: [
      {
        titre: "La caisse raconte sa propre histoire",
        texte:
          "Prix retapés, promotions oubliées : ce que la caisse applique diverge du catalogue dès la première opération commerciale.",
      },
      {
        titre: "Le chiffre reste dans la caisse",
        texte:
          "Le siège pilote sur des exports hebdomadaires. L'écart entre boutiques se découvre quand il est déjà installé.",
      },
      {
        titre: "Le bundle vit sur une affiche",
        texte:
          "La formule mise en avant n'existe pas dans la caisse : l'équipe la reconstitue à la main, chacun à sa façon.",
      },
    ],
    benefices: [
      {
        titre: "Un seul référentiel, jusqu'à la caisse",
        texte:
          "Produits, prix, bundles et promotions viennent du catalogue réseau.",
      },
      {
        titre: "Le chiffre remonte en continu",
        texte:
          "Chaque encaissement alimente le tableau de bord du jour et l'assiette des redevances.",
      },
      {
        titre: "Les bundles se vendent tels que conçus",
        texte:
          "La formule construite au siège arrive en caisse prête à encaisser, avec sa marge connue.",
      },
      {
        titre: "La coupure ne ferme pas le magasin",
        texte:
          "Le mode hors ligne encaisse et resynchronise à la reconnexion, sans doublon.",
      },
    ],
    mermaid: `flowchart TD
  A[Catalogue reseau] --> B[Ecran de vente]
  C[Promotions siege et magasin] --> B
  B --> D[Panier et bundles]
  D --> E[Encaissement]
  E --> F[Ticket et TVA]
  E --> G[Remontee en continu]
  G --> H[Console franchise]
  G --> I[Assiette des redevances]`,
    leviers: ["trafic","recurrence","food"],
    liens: [{"slug":"console-marque","sens":"recoit","quoi":"le catalogue, les bundles et les promotions"},{"slug":"console-franchise","sens":"envoie","quoi":"les ventes du jour, en continu"},{"slug":"redevances","sens":"envoie","quoi":"les encaissements qui servent d'assiette"}],
    onboarding:
      "La caisse se branche sur le catalogue existant : l'équipe retrouve les mêmes produits, bundles et promotions que le webshop, et le chiffre remonte tout seul dès le premier ticket.",
    fonctions: [
      { cle: "vente", icone: "credit-card", nom: "Écran de vente", leviers: ["labour"], description: "L'écran d'encaissement tenu à une main : produits, formules et remises, pensé pour l'heure de pointe.", benefice: "Un nouvel équipier encaisse dès son premier service." },
      { cle: "bundles", icone: "layers", nom: "Bundles et formules", leviers: ["food","trafic"], description: "Les formules construites au siège arrivent en caisse prêtes à vendre, avec leur prix résolu et leur marge connue.", benefice: "Le bundle vendu est celui qui a été conçu." },
      { cle: "promotions", icone: "percent", nom: "Promotions en caisse", leviers: ["trafic","recurrence"], description: "Les promotions du siège et du magasin s'appliquent selon les mêmes règles que le webshop, sans saisie manuelle.", benefice: "Le prix en caisse est celui de l'affiche." },
      { cle: "encaissement", icone: "wallet", nom: "Paiements et clôture", leviers: ["overhead"], description: "Espèces, carte et titres, avec la clôture de journée rapprochée automatiquement des encaissements.", benefice: "La clôture prend cinq minutes, pas une heure." },
      { cle: "tickets", icone: "receipt", nom: "Tickets et TVA", leviers: ["overhead"], description: "Tickets conformes, taux de TVA par produit, et le journal légal tenu sans y penser.", benefice: "Le contrôle fiscal se passe sur le journal, pas dans les cartons." },
      { cle: "hors-ligne", icone: "refresh-cw", nom: "Hors ligne", leviers: ["labour"], description: "La caisse encaisse pendant une coupure réseau et resynchronise à la reconnexion, dans l'ordre, sans doublon.", benefice: "La coupure ne fait plus fermer le magasin." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "recettes",
    repo: "samsam2703MFC/foodcost",
    groupe: "Approvisionnement",
    icone: "utensils",
    ordre: 12,
    nom: "Recettes & Food Cost",
    accroche: "Produits, recettes et coûts matière suivis jusqu'à la rentabilité de chaque référence.",
    resume:
      "Chaque produit vendu est relié à sa recette et à ses coûts matière. Le food cost se suit par référence et par boutique, les dérives déclenchent une alerte, et la discussion sur les prix s'appuie sur la marge réelle plutôt que sur une impression.",
    public_cible: "Direction réseau et responsables food cost",
    description: `Le food cost est le levier le plus discuté des réseaux de restauration, et le moins mesuré : les recettes vivent dans un classeur, les prix d'achat dans les factures, et la marge par référence n'existe nulle part.

Le module relie les trois. Les recettes et fiches techniques donnent la composition de chaque produit vendu, les prix d'achat remontent du fournisseur, et le food cost se calcule par référence, par boutique et par période. Une dérive — un prix d'achat qui monte, une portion qui gonfle — déclenche une alerte avant que la marge du trimestre ne soit consommée. Les inventaires et les pertes ferment la boucle entre le théorique et le réel.`,
    stack: ["React","MySQL"],
    mots_cles: ["food cost","recettes","marge","rentabilité","inventaire"],
    problemes: [
      {
        titre: "La marge par référence n'existe nulle part",
        texte:
          "Recettes dans un classeur, prix d'achat dans les factures : personne ne peut dire ce que rapporte réellement une référence.",
      },
      {
        titre: "La dérive se découvre au bilan",
        texte:
          "Un prix d'achat qui monte ou une portion qui gonfle se voit des mois plus tard, quand la marge du trimestre est déjà consommée.",
      },
      {
        titre: "Le théorique ignore le réel",
        texte:
          "Sans inventaires rapprochés, l'écart entre le food cost calculé et le food cost constaté reste une intuition.",
      },
    ],
    benefices: [
      {
        titre: "Un food cost par référence",
        texte:
          "Chaque produit vendu est relié à sa recette et à ses coûts matière réels.",
      },
      {
        titre: "Les dérives déclenchent une alerte",
        texte:
          "Prix d'achat, portions, pertes : ce qui bouge au-delà du seuil se signale le jour même.",
      },
      {
        titre: "La rentabilité se compare",
        texte:
          "Marge par référence, par boutique et par période — sur les mêmes règles partout.",
      },
      {
        titre: "Le réel rejoint le théorique",
        texte:
          "Inventaires et pertes ferment la boucle entre la recette et ce qui sort vraiment de la cuisine.",
      },
    ],
    mermaid: `flowchart TD
  A[Prix d'achat fournisseur] --> B[Recettes et fiches techniques]
  B --> C[Food cost par reference]
  C --> D[Marge par boutique et periode]
  E[Inventaires et pertes] --> D
  D --> F[Alertes de derive]
  F --> G[Decision prix ou recette]`,
    leviers: ["food","overhead"],
    liens: [{"slug":"fournisseurs","sens":"recoit","quoi":"les prix d'achat et les fiches techniques"},{"slug":"pos","sens":"recoit","quoi":"les quantités réellement vendues"},{"slug":"console-marque","sens":"envoie","quoi":"la marge par référence et par boutique"}],
    onboarding:
      "À ouvrir quand le catalogue et le fournisseur sont en place : les recettes existent déjà, le module les relie aux prix d'achat et la marge par référence apparaît sans ressaisie.",
    fonctions: [
      { cle: "produits", icone: "book-open", nom: "Produits et compositions", leviers: ["food"], description: "Chaque produit vendu est relié à sa recette : composants, quantités, unités — la base du calcul.", benefice: "Le food cost part de la recette, pas d'un ratio global." },
      { cle: "recettes", icone: "chef-hat", nom: "Recettes et portions", leviers: ["food","xp"], description: "Les fiches techniques donnent les portions théoriques ; ce qui sort de la cuisine se compare à ce qui devait sortir.", benefice: "La portion qui gonfle se voit avant la fin du mois." },
      { cle: "foodcost", icone: "percent", nom: "Food cost par référence", leviers: ["food"], description: "Le coût matière de chaque référence, recalculé quand un prix d'achat bouge, par boutique et par période.", benefice: "Une référence vendue à perte se repère en jours." },
      { cle: "marges", icone: "trending-up", nom: "Marges et rentabilité", leviers: ["food","overhead"], description: "La marge réelle par référence, par famille et par boutique, sur les quantités réellement vendues.", benefice: "La discussion prix s'appuie sur des chiffres." },
      { cle: "inventaires", icone: "clipboard-check", nom: "Inventaires et pertes", leviers: ["food"], description: "Inventaires périodiques et pertes déclarées, rapprochés du théorique pour mesurer l'écart réel.", benefice: "L'écart théorique-réel devient un chiffre suivi." },
      { cle: "alertes", icone: "triangle-alert", nom: "Alertes de dérive", leviers: ["food"], description: "Un seuil par référence ou par famille : ce qui dérive — coût, portion, perte — se signale le jour même.", benefice: "La marge se défend en semaine, pas au bilan." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "facturation",
    repo: "samsam2703MFC/invoicing",
    groupe: "Pilotage",
    icone: "receipt",
    ordre: 13,
    nom: "Facturation",
    accroche: "Des factures propres, simples à émettre pour l'équipe, simples à lire pour le client.",
    resume:
      "La facturation du réseau, pensée pour ceux qui l'utilisent : l'équipe émet une facture juste en quelques gestes, le client B2B reçoit un document lisible, et la comptabilité exporte sans retraitement. Avoirs, corrections et relances suivent le même dossier.",
    public_cible: "Franchisés, assistantes de gestion, comptables",
    description: `La facturation d'un point de vente se joue entre trois personnes qui ne se parlent pas : l'équipe qui vend, le client qui attend sa facture, et le comptable qui retraite. Chacun a son outil, et le même montant se ressaisit trois fois.

Le module prend les ventes là où elles naissent — webshop, caisse, commandes B2B — et en fait des factures propres : modèles du réseau, mentions justes, TVA par ligne. L'équipe émet en quelques gestes, sans connaître la comptabilité. Les avoirs et corrections restent rattachés à la facture d'origine, les relances suivent l'échéance, et l'export part vers le comptable dans son format, sans retraitement.`,
    stack: ["PHP","MySQL"],
    mots_cles: ["facture","avoir","B2B","export comptable","relance"],
    problemes: [
      {
        titre: "Le même montant se ressaisit trois fois",
        texte:
          "La vente, la facture et l'écriture comptable vivent dans trois outils. Chaque ressaisie est une erreur possible.",
      },
      {
        titre: "La facture est illisible",
        texte:
          "Un document généré pour le comptable, pas pour le client : le service facturé se devine, et le téléphone sonne.",
      },
      {
        titre: "L'avoir se perd",
        texte:
          "Une correction faite dans un coin sans lien avec la facture d'origine : au rapprochement, plus personne ne sait pourquoi.",
      },
    ],
    benefices: [
      {
        titre: "Émise depuis la vente",
        texte:
          "Webshop, caisse et commandes B2B deviennent des factures sans ressaisie.",
      },
      {
        titre: "Lisible par le client",
        texte:
          "Modèles du réseau, libellés clairs, TVA par ligne : le document s'explique tout seul.",
      },
      {
        titre: "L'avoir reste rattaché",
        texte:
          "Corrections et avoirs suivent la facture d'origine, avec leur motif.",
      },
      {
        titre: "L'export part sans retraitement",
        texte:
          "Le comptable reçoit son format ; personne ne repasse derrière.",
      },
    ],
    mermaid: `flowchart TD
  A[Webshop] --> D[Factures]
  B[Caisse POS] --> D
  C[Commandes B2B] --> D
  D --> E[Envoi au client]
  D --> F[Avoirs et corrections]
  E --> G[Relances a echeance]
  D --> H[Export comptable]`,
    leviers: ["overhead","xp"],
    liens: [{"slug":"webshop","sens":"recoit","quoi":"les commandes en ligne facturables"},{"slug":"pos","sens":"recoit","quoi":"les tickets et clôtures de caisse"},{"slug":"console-franchise","sens":"envoie","quoi":"l'état des paiements clients"}],
    onboarding:
      "Se branche sur ce qui vend déjà : webshop, caisse, B2B. Première semaine, vous posez les modèles du réseau et l'export du comptable — ensuite les factures partent du bon montant, du premier coup.",
    fonctions: [
      { cle: "emission", icone: "receipt", nom: "Émission et modèles", leviers: ["overhead"], description: "Les factures partent des ventes réelles, sur les modèles du réseau : mentions, numérotation et TVA justes par construction.", benefice: "Émettre une facture ne demande aucune connaissance comptable." },
      { cle: "clients", icone: "users", nom: "Comptes clients B2B", leviers: ["recurrence"], description: "Sociétés, services et adresses de facturation tenus au même endroit que les commandes, avec le numéro de TVA vérifié.", benefice: "La facture part au bon service du premier coup." },
      { cle: "avoirs", icone: "percent", nom: "Avoirs et corrections", leviers: ["overhead"], description: "Toute correction reste rattachée à la facture d'origine, avec son motif et son auteur.", benefice: "Le rapprochement se fait sans archéologie." },
      { cle: "relances", icone: "bell", nom: "Relances à échéance", leviers: ["overhead"], description: "Les factures échues se relancent selon l'échéancier du réseau, avec l'historique dans le dossier client.", benefice: "L'encours client baisse sans y passer ses soirées." },
      { cle: "export", icone: "download", nom: "Exports comptables", leviers: ["overhead"], description: "L'export part dans le format du cabinet — journal, pièces et TVA — sans retraitement manuel.", benefice: "Le comptable cesse de retaper le mois." },
    ],
  },
];

/** Contenu de la page d'accueil. */
export const SITE = {
  titre: "La valeur d'un réseau, c'est sa capacité à être transmis",
  sous_titre:
    "Un ERP qui met le savoir-faire dans l'outil plutôt que dans la tête de quelques personnes.",
  accroche: `Un réseau se vend sur ce qu'il peut transmettre. Tant que les procédures vivent dans la mémoire des fondateurs, dans des tableurs personnels et dans des habitudes prises en magasin, ce qui se transmet n'est qu'une enseigne et un bail. Le repreneur rachète un nom, pas une méthode.
Nos neuf modules couvrent l'exploitation réelle d'un réseau : le recrutement des franchisés, la vente en ligne, le pilotage du siège et du point de vente, l'approvisionnement, la production, l'animation terrain, la livraison et l'affichage. Chacun a la même exigence : ce qui est fait laisse une trace datée et attribuée, et ce qui est décidé est écrit quelque part d'autre que dans une conversation.`,
  cta_texte: 'Demander une démonstration',
  cta_url: '#contact',
  meta_description:
    "ERP pour réseaux de franchise : vente en ligne, pilotage, approvisionnement, production, animation terrain, livraison et affichage — huit modules en production.",
  problemes: [
    {
      titre: "L'exécution en magasin est invisible",
      texte:
        "Le siège apprend qu'un standard n'est pas tenu quand un client se plaint, ou lors d'une visite. Entre les deux, personne ne sait. L'écart entre deux points de vente se creuse sans que rien ne le signale.",
    },
    {
      titre: "L'information remonte tard et déformée",
      texte:
        "Les chiffres arrivent par tableur en fin de mois, recopiés au moins deux fois. Quand ils arrivent, le trimestre est joué et la discussion porte sur la fiabilité du fichier plutôt que sur la décision à prendre.",
    },
    {
      titre: 'Les procédures ne survivent pas au départ',
      texte:
        "Le savoir-faire tient dans quelques personnes. Un responsable qui part emporte le tour de main, la mémoire des clients difficiles et les raisons derrière chaque règle. Le successeur réapprend au prix d'une saison.",
    },
    {
      titre: 'Chaque outil raconte une histoire différente',
      texte:
        "Le site annonce un stock, la cuisine en connaît un autre, le chauffeur découvre le troisième. La ressaisie entre ces mondes coûte des heures et introduit les erreurs qu'on passe ensuite à corriger.",
    },
    {
      titre: '« Vérifié » ne prouve rien',
      texte:
        "Une case cochée sans nom ni horodatage ne démontre rien — ni à un franchisé, ni à un contrôle, ni à un repreneur. Le réseau ne peut pas prouver que ses standards existent ailleurs que dans son discours.",
    },
  ],
  reponses: [
    {
      titre: 'Le terrain saisit là où il travaille',
      texte:
        "Les applications de la cuisine, de l'animateur et du chauffeur sont installables depuis un navigateur et fonctionnent hors ligne. La donnée naît au poste de travail, une seule fois, au moment où le geste est fait.",
    },
    {
      titre: 'Chaque contrôle porte un nom et une heure',
      texte:
        "Checklists de poste, checklists de visite notées, preuve de livraison géolocalisée : ce qui est vérifié est attribué et daté. Un standard devient démontrable, donc transmissible.",
    },
    {
      titre: 'Un seul référentiel produit',
      texte:
        "Le catalogue du siège alimente le webshop, les consoles franchisées et les écrans en magasin. Un prix se change une fois. Le stock du jour vu en cuisine est celui que le site consulte avant d'accepter une commande.",
    },
    {
      titre: 'La frontière siège–franchisé est un réglage',
      texte:
        "La fiche de chaque boutique dit ce qui est hérité du siège et ce que le franchisé pilote chez lui. La règle ne se renégocie pas à chaque changement de propriétaire.",
    },
    {
      titre: 'Les incidents se comptent',
      texte:
        "Motifs codifiés, partagés entre l'application du chauffeur et la console du magasin. Un défaut récurrent devient un chiffre comparable entre boutiques, donc un sujet qu'on traite.",
    },
  ],
  mermaid: `flowchart LR
  R[Recrutement] --> A
  A[Console marque] --> B[Catalogue et regles]
  B --> C[Webshop]
  B --> D[Console franchise]
  B --> E[Regie d affichage]
  C --> F[Commandes]
  F --> D
  D --> G[Cuisine]
  G --> H[Tournees de livraison]
  I[Fournisseur] --> G
  J[Panel consultant] --> D
  H --> K[Preuves et incidents]
  K --> A
  G --> K`,
};

/**
 * Les questions de l'onboarding.
 *
 * Le franchiseur coche ce qui lui ressemble — ses problèmes d'abord, ses
 * besoins ensuite — et son système s'assemble en dessous. Chaque question
 * désigne les modules qu'elle déclenche par leur `slug` : ajouter une
 * question, c'est ajouter une ligne ici, sans toucher à la page.
 */
export const QUESTIONS = [
  { cle: 'chiffres', tag: 'Problème', cible: 'Console marque', slugs: ['console-marque'],
    texte: 'Les chiffres remontent par tableur en fin de mois, recopiés au moins deux fois ?' },
  { cle: 'promo', tag: 'Problème', cible: 'Console marque', slugs: ['console-marque', 'affichage'],
    texte: 'Une opération commerciale met des semaines à se déployer sur tout le réseau ?' },
  { cle: 'enligne', tag: 'Besoin', cible: 'Webshop', slugs: ['webshop', 'console-franchise'],
    texte: "Vendre en ligne sans accepter de commandes que la cuisine ne peut pas produire ?" },
  { cle: 'journee', tag: 'Problème', cible: 'Console franchisé', slugs: ['console-franchise'],
    texte: 'Le point de vente découvre sa journée sur un papier imprimé la veille ?' },
  { cle: 'ecrans', tag: 'Problème', cible: "Régie d'affichage", slugs: ['affichage'],
    texte: "Vos écrans en magasin affichent encore l'ancienne promotion ?" },
  { cle: 'fournisseur', tag: 'Problème', cible: 'Fournisseur', slugs: ['fournisseurs'],
    texte: 'Les commandes fournisseur se passent sur un tarif PDF périmé ?' },
  { cle: 'marge', tag: 'Problème', cible: 'Fournisseur', slugs: ['fournisseurs', 'cuisine'],
    texte: "La marge par référence n'existe nulle part, la dérive se découvre au bilan ?" },
  { cle: 'savoir', tag: 'Problème', cible: 'Cuisine', slugs: ['cuisine'],
    texte: "Le savoir-faire part quand un responsable s'en va ?" },
  { cle: 'visites', tag: 'Problème', cible: 'Panel consultant', slugs: ['consultant'],
    texte: 'Vos visites de réseau tiennent dans un compte rendu écrit le soir, de mémoire ?' },
  { cle: 'livraison', tag: 'Besoin', cible: 'Tournées de livraison', slugs: ['livraison', 'console-franchise'],
    texte: 'Livrer vos points de vente avec une preuve datée et sans litige ?' },
  { cle: 'recrutement', tag: 'Problème', cible: 'Recrutement', slugs: ['recrutement'],
    texte: 'Recruter un franchisé prend un an et le dossier vit dans une boîte mail ?' },
  { cle: 'caisse', tag: 'Problème', cible: 'Caisse POS', slugs: ['pos'],
    texte: 'Le prix en caisse diverge du catalogue, les bundles se reconstituent à la main ?' },
  { cle: 'redevances', tag: 'Problème', cible: 'Redevances', slugs: ['redevances'],
    texte: 'Des redevances calculées sur du déclaratif, des impayés qui traînent ?' },
  { cle: 'factures', tag: 'Problème', cible: 'Facturation', slugs: ['facturation'],
    texte: 'Le même montant se ressaisit trois fois entre la vente et le comptable ?' },
  { cle: 'foodcost', tag: 'Besoin', cible: 'Recettes & Food Cost', slugs: ['recettes'],
    texte: 'Connaître la marge de chaque référence, et voir la dérive avant le bilan ?' },
  { cle: 'transmission', tag: 'Besoin', cible: 'Tout le catalogue', slugs: ['console-marque', 'console-franchise', 'consultant', 'cuisine'],
    texte: 'Rendre votre réseau transmissible : que ce qui est fait laisse une trace datée ?' },
];
