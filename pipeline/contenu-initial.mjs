/**
 * Contenu de départ des huit modules, rédigé à partir du code et des fiches
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
    fonctions: [
      { cle: 'catalogue', icone: 'book-open', nom: 'Catalogue par boutique', description: "Le même catalogue réseau, filtré et tarifé pour la boutique choisie : assortiment, prix local, saison, allergènes. Changer de boutique change la vitrine, pas le référentiel.", benefice: "Le siège garde la main sur l'offre sans imposer le même rayon à tous." },
      { cle: 'creneaux', icone: 'clock', nom: 'Créneaux et heure limite', description: "Le moteur de disponibilité croise les jours d'ouverture, le stock du jour et le remplissage du créneau. L'heure limite est lue dans la configuration de la boutique et réévaluée en continu.", benefice: "Plus d'annulation le lendemain matin faute de capacité." },
      { cle: 'tarifs', icone: 'credit-card', nom: 'Tarifs, bons et remises', description: "Le devis du panier est calculé côté serveur : règles de prix du siège, promotions locales, bons validés à l'usage, offre croisée par portion. Le client voit un prix, pas une estimation.", benefice: "Le montant annoncé est le montant facturé, sans litige." },
      { cle: 'b2b', icone: 'users', nom: 'Commande B2B', description: "Les entreprises commandent pour un bureau et un service, sur une tournée existante, avec leurs frais de livraison propres et leur numéro de TVA vérifié.", benefice: "La facture part au bon service sans ressaisie comptable." },
      { cle: 'compte', icone: 'search', nom: 'Compte et suivi de commande', description: "Inscription, session, historique et suivi : le client retrouve ses commandes passées et l'état de celle du jour, la même donnée que celle affichée en magasin.", benefice: "Le magasin et le client regardent le même écran quand ils s'appellent." },
      { cle: 'marque', icone: 'layers', nom: 'Thème par enseigne', description: "Couleurs, logo et typographies viennent des jetons de la boutique servis par l'API. Une enseigne de plus dans le réseau ne demande pas un nouveau front.", benefice: "Une seconde marque se lance en paramétrage, pas en projet." },
      { cle: 'langues', icone: 'settings', nom: 'Quatre langues', description: "Français, néerlandais, anglais et allemand, choisis par le client — indispensable pour un réseau belge où deux boutiques voisines ne parlent pas la même langue.", benefice: "Le réseau s'étend sur une frontière linguistique sans dupliquer le site." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'console-marque',
    repo: 'samsam2703MFC/back_office_ws_franchisor',
    groupe: 'Pilotage',
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
    fonctions: [
      { cle: 'dashboard', icone: 'bar-chart', nom: 'Tableau de bord réseau', description: "Les indicateurs du réseau consolidés au siège, avec le détail par boutique en dessous : on voit l'écart entre les points de vente sans exporter quoi que ce soit.", benefice: "L'écart se traite dans la semaine, pas au trimestre." },
      { cle: 'boutiques', icone: 'map-pin', nom: 'Boutiques du réseau', description: "La fiche de chaque point de vente — ouverture, périmètre, réglages hérités du siège — et ce que le franchisé a le droit de modifier chez lui.", benefice: "La gouvernance est un interrupteur, pas une convention orale." },
      { cle: 'catalogue', icone: 'book-open', nom: 'Catalogue produits', description: "L'arbre catégories puis produits, avec la saison et la disponibilité. C'est la source unique que lisent le webshop, les écrans en magasin et les consoles franchisées.", benefice: "Un prix se change une fois et se propage partout." },
      { cle: 'menus', icone: 'layers', nom: 'Menus et formules', description: "Le constructeur de formules : une formule, ses étapes, les choix ouverts à chaque étape, et le prix résolu côté serveur avec sa marge.", benefice: "La marge d'une formule est connue avant de la lancer." },
      { cle: 'promotions', icone: 'credit-card', nom: 'Promotions réseau', description: "Bons de réduction et règles de prix décidés au siège, avec le périmètre des boutiques concernées. Le franchisé garde ses promotions locales à côté, sans écraser celles de la marque.", benefice: "Une opération nationale se lance sans appeler chaque magasin." },
      { cle: 'geo', icone: 'map-pin', nom: 'Analyse géographique', description: "Les ventes rapportées aux codes postaux : zones de chalandise, recouvrements entre boutiques, secteurs vides. C'est l'écran qui sert à décider où ouvrir.", benefice: "Une ouverture cesse d'être un pari." },
      { cle: 'tracabilite', icone: 'search', nom: 'Traçabilité clients', description: "Le parcours d'un client à travers le réseau : où il commande, à quelle fréquence, sous quelle enseigne. Utile quand plusieurs boutiques servent la même personne.", benefice: "Le client appartient au réseau, pas à une boutique." },
      { cle: 'prospects', icone: 'users', nom: 'Prospects', description: "Les candidats franchisés et les demandes d'ouverture suivis au même endroit que le reste du réseau, plutôt que dans un tableur à part.", benefice: "Le développement du réseau se pilote comme le reste." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'console-franchise',
    repo: 'samsam2703MFC/back_office_ws_franchisee',
    groupe: 'Pilotage',
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
    fonctions: [
      { cle: 'dashboard', icone: 'bar-chart', nom: 'Tableau de bord du jour', description: "Commandes à préparer, tournées engagées, incidents ouverts : la journée du magasin sur un écran, avec les compteurs qui disent où ça coince.", benefice: "Le responsable sait où porter son attention en arrivant." },
      { cle: 'preparation', icone: 'clipboard-check', nom: 'Préparation des commandes', description: "Les commandes du jour regroupées par tournée ou à plat, avec le détail article par article. C'est la liste que suit l'équipe en cuisine et que le chauffeur contre-scanne au chargement.", benefice: "Une seule liste sert la production et le contrôle au départ." },
      { cle: 'livraison', icone: 'truck', nom: 'Livraison du jour', description: "L'état des tournées en cours vu du magasin : ce qui est parti, ce qui est livré, ce qui traîne.", benefice: "Le magasin répond au client sans appeler le chauffeur." },
      { cle: 'stock', icone: 'package', nom: 'Stock du jour', description: "La disponibilité par produit et par jour, celle-là même que le webshop consulte avant d'accepter une commande.", benefice: "Fermer un produit ici le retire de la vente en ligne tout de suite." },
      { cle: 'b2b', icone: 'users', nom: 'Clients et demandes B2B', description: "Les entreprises livrées : sociétés, services, sites de livraison, e-mails de facturation. Les demandes entrantes se traitent ici et alimentent les tournées.", benefice: "Le franchisé développe son B2B sans dépendre du siège." },
      { cle: 'incidents', icone: 'triangle-alert', nom: 'Incidents et litiges', description: "Les incidents remontés du terrain — colis manquant, client absent, litige de facturation — avec leur preuve et leur suite, sur les mêmes motifs codifiés que l'app chauffeur.", benefice: "Les problèmes se comptent au lieu de se raconter." },
      { cle: 'capacite', icone: 'clock', nom: 'Capacité et remplissage', description: "Les créneaux, leur remplissage et les fermetures exceptionnelles.", benefice: "Ce qui est vendu en ligne reste produisible en cuisine." },
      { cle: 'rentabilite', icone: 'trending-up', nom: 'Rentabilité', description: "Ce que rapporte réellement une tournée ou un client une fois les frais de livraison posés en face.", benefice: "La discussion sur les frais se fait sur des chiffres." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'fournisseurs',
    repo: 'samsam2703MFC/supplier_atl',
    groupe: 'Approvisionnement',
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
    fonctions: [
      { cle: 'matieres', icone: 'package', nom: 'Matières premières et ingrédients', description: "Le référentiel amont : matières, ingrédients, unités et prix d'achat. C'est ce qui donne un coût de revient à chaque recette au lieu d'un prix décidé au doigt mouillé.", benefice: "La marge se calcule à partir de données, pas d'intuitions." },
      { cle: 'recettes', icone: 'chef-hat', nom: 'Recettes et fiches techniques', description: "Chaque produit fabriqué a sa recette et sa fiche technique : composants, quantités, process. La fiche sert autant à produire qu'à répondre à un client sur ce qu'il y a dedans.", benefice: "Le savoir-faire est écrit, donc transmissible." },
      { cle: 'catalogue', icone: 'book-open', nom: 'Catalogue fournisseur', description: "Ce que l'atelier propose au réseau, avec l'accès client au catalogue : le point de vente commande sur le vrai référentiel, pas sur un PDF envoyé une fois.", benefice: "Fini les commandes passées sur un tarif périmé." },
      { cle: 'cennik', icone: 'credit-card', nom: 'Liste de prix par client', description: "Chaque client a sa grille négociée. Elle se saisit à la main ou s'importe en JSON, validée avant écriture.", benefice: "Reprendre un tarif annuel ne veut plus dire retaper deux cents lignes." },
      { cle: 'commandes', icone: 'clipboard-check', nom: 'Commandes des points de vente', description: "Les commandes arrivent du réseau, sont préparées et suivies jusqu'à l'expédition, au tarif du client qui les a passées.", benefice: "Le bon prix s'applique sans vérification manuelle." },
      { cle: 'logistique', icone: 'truck', nom: 'Logistique et expéditions', description: "Les départs, les regroupements et ce qui part vers quel point de vente — l'écran qui dit ce qui est réellement sorti de l'atelier aujourd'hui.", benefice: "L'atelier sait ce qu'il a expédié sans compter les palettes." },
      { cle: 'reclamations', icone: 'triangle-alert', nom: 'Réclamations', description: "Les retours du réseau sur un produit ou une livraison, tracés avec leur suite.", benefice: "Un défaut récurrent devient visible avant de coûter cher." },
      { cle: 'analytics', icone: 'trending-up', nom: 'Analyse des ventes', description: "Ce qui se vend, à qui, à quelle marge, sur la base des vraies commandes et des vrais coûts de revient plutôt que d'un export retravaillé.", benefice: "Les décisions d'assortiment s'appuient sur la marge réelle." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'cuisine',
    repo: 'samsam2703MFC/pwa_kitchen',
    groupe: 'Terrain',
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
    fonctions: [
      { cle: 'production', icone: 'chef-hat', nom: 'Production du jour', description: "Ce qu'il y a à faire aujourd'hui, avec l'avancement par tâche : à faire, en cours, terminé. Le tableau de bord ouvre sur cet état, pas sur un menu.", benefice: "L'équipe voit l'essentiel en déverrouillant l'écran." },
      { cle: 'checklists', icone: 'clipboard-check', nom: 'Checklists de poste', description: "Les contrôles d'ouverture, de service et de fermeture cochés dans l'app, horodatés et attribués.", benefice: "Ce qui a été fait est prouvable sans classeur." },
      { cle: 'fiches', icone: 'file-text', nom: 'Produits et recettes', description: "La base de connaissances de la cuisine : fiche produit, recette, fiche technique. Le même contenu que celui tenu par le fournisseur, consulté au poste de travail.", benefice: "Une recette nouvelle arrive au poste sans réimpression." },
      { cle: 'commandes', icone: 'package', nom: 'Commandes à produire', description: "Les commandes qui concernent la cuisine, avec leur détail. La cuisine travaille sur la commande réelle du client, pas sur une recopie.", benefice: "Une erreur de recopie en moins entre le client et le four." },
      { cle: 'clients', icone: 'users', nom: 'Clients servis', description: "Qui est livré, avec quelles particularités. Utile quand une commande B2B revient chaque semaine avec ses contraintes.", benefice: "Les habitudes d'un client régulier ne se redécouvrent pas." },
      { cle: 'reclamations', icone: 'triangle-alert', nom: 'Réclamations', description: "Un problème constaté en production se déclare sur place, avec son motif. Il part vers le fournisseur ou le siège au lieu de rester dans un carnet.", benefice: "Le défaut remonte le jour où il est vu." },
      { cle: 'hors-ligne', icone: 'smartphone', nom: 'Installable et hors ligne', description: "L'app s'installe sur le téléphone ou la tablette de la cuisine depuis le navigateur, sans boutique d'applications ni intervention IT, et supporte les coupures réseau du magasin.", benefice: "Déployer un magasin de plus ne demande aucune informatique sur place." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'consultant',
    repo: 'samsam2703MFC/pwa_consultant',
    groupe: 'Terrain',
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
    fonctions: [
      { cle: 'agenda', icone: 'calendar', nom: 'Agenda des visites', description: "Les visites planifiées par point de vente, préparées avant de partir et retrouvées sur place. L'animateur sait ce qu'il va voir et ce qu'il a laissé ouvert la dernière fois.", benefice: "Rien ne se perd entre deux passages." },
      { cle: 'checklists', icone: 'clipboard-check', nom: 'Checklists de visite notées', description: "Chaque tâche du magasin est vérifiée, notée et commentée, et la revue porte le nom de son auteur et son horodatage.", benefice: "Le contrôle devient démontrable, pas déclaratif." },
      { cle: 'objectifs', icone: 'trending-up', nom: 'Objectifs, tendances et leviers', description: "Les cibles par indicateur et par magasin, la tendance sur la période, et les leviers identifiés pour la corriger.", benefice: "La discussion avec le franchisé porte sur des chiffres." },
      { cle: 'reclamations', icone: 'triangle-alert', nom: 'Réclamations matériel', description: "Ce qui est cassé ou manquant se déclare pendant la visite, sur plusieurs magasins d'un coup quand le même problème revient dans le réseau.", benefice: "Un défaut de série se traite en une fois." },
      { cle: 'rapports', icone: 'file-text', nom: 'Comptes rendus de visite', description: "Le compte rendu se construit à partir de ce qui a été vérifié sur place, et se valide côté propriétaire.", benefice: "Personne ne retape la visite le soir." },
      { cle: 'notes', icone: 'pencil', nom: 'Notes de terrain', description: "Les remarques prises au passage, rattachées au magasin et retrouvées à la visite suivante — plutôt qu'un carnet qui reste dans la voiture.", benefice: "La mémoire du magasin survit au changement d'animateur." },
      { cle: 'kiosque', icone: 'smartphone', nom: 'Installable et plein écran', description: "L'app s'installe depuis le navigateur et s'ouvre sans barre d'adresse. Sur un écran fixe en magasin, elle se lance en mode kiosque.", benefice: "Un poste de plus se met en service en quelques minutes." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'livraison',
    repo: 'samsam2703MFC/pwa_delivery',
    groupe: 'Approvisionnement',
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
    fonctions: [
      { cle: 'tournee', icone: 'map-pin', nom: 'Tournée du jour', description: "La tournée assignée s'ouvre avec ses chiffres : colis à livrer, points de passage, heure de départ et ETA de fin. L'ordre de passage est figé, il ne se réordonne pas en cours de route.", benefice: "Le magasin et le client savent quand la livraison passe." },
      { cle: 'chargement', icone: 'package', nom: 'Chargement en double scan', description: "Le chauffeur scanne ce qu'il embarque, l'app le confronte au bon préparé par le magasin. Les manquants sont listés par client et le départ reste bloqué tant que l'emport est incomplet.", benefice: "L'erreur se corrige au dépôt, pas chez le client." },
      { cle: 'livraison', icone: 'clipboard-check', nom: 'Preuve de livraison', description: "À chaque point : dépôt scanné, photo géolocalisée, puis un QR qui tourne et que le client scanne pour confirmer. Repli sur code PIN, signature ou photo seule.", benefice: "Un litige se tranche sur une preuve datée." },
      { cle: 'incident', icone: 'triangle-alert', nom: 'Incidents codifiés', description: "Client absent, adresse fermée, colis abîmé : le chauffeur choisit un motif dans une liste fermée, décide de la suite et joint la preuve.", benefice: "Le siège lit des motifs comparables entre tournées." },
      { cle: 'hors-ligne', icone: 'refresh-cw', nom: 'Hors ligne par défaut', description: "La tournée entière tient dans la tablette. Sans réseau, le chauffeur continue à scanner, photographier et clôturer ; les écritures partent à la reconnexion, dans l'ordre, sans doublon.", benefice: "La zone blanche n'interrompt plus la tournée." },
      { cle: 'contrat', icone: 'users', nom: 'Salarié ou sous-traitant', description: "Le même écran sert les deux statuts : le chauffeur salarié voit son pointage de service, le sous-traitant ne l'a pas. Le type de contrat est porté par la session.", benefice: "Une seule application à maintenir pour les deux modèles." },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: 'affichage',
    repo: 'samsam2703MFC/signage',
    groupe: 'Vente',
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
    fonctions: [
      { cle: 'compositeur', icone: 'layers', nom: 'Compositeur de film', description: "La bibliothèque d'éléments — catégories, liaisons, promos — et la playlist qui en fait un film. Mise en page, mouvement, filigrane et jetons dynamiques se règlent élément par élément.", benefice: "Un montage vidéo de moins à sous-traiter." },
      { cle: 'produits', icone: 'book-open', nom: 'Produits et tarifs affichés', description: "Les listes de prix à l'écran sont liées à la table produits, pas retapées. Un changement de prix se propage au prochain film.", benefice: "Le prix vu par le client est celui de la caisse." },
      { cle: 'campagnes', icone: 'bell', nom: 'Campagnes et promotions', description: "Les opérations commerciales sont taguées en campagne : on active une campagne et tous les éléments qui la portent basculent d'un coup, sur les écrans choisis.", benefice: "Une opération nationale démarre partout le même matin." },
      { cle: 'planning', icone: 'calendar', nom: 'Périodes et planning de diffusion', description: "Le petit-déjeuner, le service du midi et le goûter n'affichent pas la même chose. Les périodes décrivent ces plages et le planning dit quel film passe quand.", benefice: "L'écran vend ce qui est disponible à cette heure-là." },
      { cle: 'reseau', icone: 'monitor', nom: 'Réseau et supervision des écrans', description: "Chaque écran est un player authentifié par jeton qui envoie un battement de cœur et une capture. La supervision montre magasin par magasin ce qui est réellement affiché.", benefice: "Un écran décroché se voit le jour même." },
      { cle: 'film', icone: 'smartphone', nom: 'Visionneuse publique', description: "La dernière playlist publiée est consultable en plein écran sans connexion, à l'adresse /film.", benefice: "Le responsable vérifie l'affichage depuis son téléphone." },
    ],
  },
];

/** Contenu de la page d'accueil. */
export const SITE = {
  titre: "La valeur d'un réseau, c'est sa capacité à être transmis",
  sous_titre:
    "Un ERP qui met le savoir-faire dans l'outil plutôt que dans la tête de quelques personnes.",
  accroche: `Un réseau se vend sur ce qu'il peut transmettre. Tant que les procédures vivent dans la mémoire des fondateurs, dans des tableurs personnels et dans des habitudes prises en magasin, ce qui se transmet n'est qu'une enseigne et un bail. Le repreneur rachète un nom, pas une méthode.
Nos huit modules couvrent l'exploitation réelle d'un réseau : la vente en ligne, le pilotage du siège et du point de vente, l'approvisionnement, la production, l'animation terrain, la livraison et l'affichage. Chacun a la même exigence : ce qui est fait laisse une trace datée et attribuée, et ce qui est décidé est écrit quelque part d'autre que dans une conversation.`,
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
