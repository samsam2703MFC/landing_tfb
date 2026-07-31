-- Contenu de départ de la landing — 8 modules et la page d'accueil.
-- Généré par pipeline/seed-contenu.mjs. Compatible MySQL et PostgreSQL.
-- Rejouable : le contenu est remplacé, jamais dupliqué.
-- Prérequis : les tables existent (node bootstrap-db.mjs).

BEGIN;

DELETE FROM landing_fonctions;
DELETE FROM landing_modules;

-- ── Webshop (webshop)
INSERT INTO landing_modules (slug, repo, ref, groupe, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid, modele_ia)
VALUES (
  'webshop', 'samsam2703MFC/WebShop', 'main', 'Vente', 1, '1',
  'Webshop',
  'La boutique en ligne du réseau, déclinée par point de vente.',
  'Le client commande sur le site de son magasin, pas sur un site générique : catalogue, prix, jours d''ouverture et créneaux sont ceux de ce point de vente. La disponibilité est vérifiée avant le paiement, et la commande atterrit directement dans la console du franchisé.',
  'Un réseau qui vend en ligne se heurte vite au même mur : un site unique ne sait pas qu''une boutique ferme le lundi, qu''une autre n''a plus de pâte à tarte, et qu''une troisième pratique un tarif différent. Résultat, des commandes acceptées que personne ne peut produire, et un franchisé qui appelle le client pour annuler.

Le webshop part de la boutique. Le visiteur choisit son point de vente, et tout découle de ce choix : l''assortiment, les prix, les jours ouvrés, les créneaux de retrait ou de livraison. Le moteur de disponibilité croise le stock du jour, le remplissage du créneau et l''heure limite de commande avant d''accepter le paiement.

Le devis du panier est calculé côté serveur. Les règles de prix du siège, les promotions locales du franchisé et les bons de réduction sont résolus au même endroit, dans cet ordre : le client voit un prix ferme, pas une estimation qui bougera à la facturation.

Les entreprises ont leur propre parcours — commande pour un bureau et un service, sur une tournée existante, avec le numéro de TVA vérifié et les frais de livraison négociés. Le thème visuel vient des jetons de la boutique servis par l''API, ce qui permet d''ajouter une enseigne au réseau sans redévelopper de front.',
  'Clients du réseau, particuliers et entreprises',
  '[{"titre":"Commandes impossibles à produire","texte":"Un site qui ignore le stock et la capacité du magasin accepte des commandes que la cuisine ne peut pas honorer. Le franchisé passe sa matinée à rappeler des clients pour annuler."},{"titre":"Un site par boutique, ou aucun","texte":"Soit chaque franchisé bricole sa propre vitrine et le réseau perd toute cohérence, soit un site unique impose le même catalogue partout. Les deux abîment la marque."},{"titre":"Le prix affiché n''est pas le prix facturé","texte":"Quand les remises se calculent dans le navigateur, chaque écart devient un litige. La confiance du client se joue sur ce détail."}]',
  '[{"titre":"Une vitrine par point de vente","texte":"Le catalogue réseau est filtré et tarifé pour la boutique choisie. Le franchiseur garde le référentiel, le franchisé garde son assortiment réel."},{"titre":"Aucune commande invendable","texte":"Stock du jour, capacité du créneau et heure limite sont vérifiés avant le paiement. Ce qui est vendu est produisible."},{"titre":"Un seul moteur de prix","texte":"Règles du siège, promotions locales et bons se résolvent côté serveur. Le prix affiché est celui qui sera facturé."},{"titre":"Une enseigne de plus sans redéveloppement","texte":"Couleurs, logo et typographies viennent de la configuration de la boutique. Ouvrir une nouvelle marque dans le réseau relève du paramétrage."}]',
  '["React","PHP","MySQL"]',
  '["webshop","franchise","click and collect","B2B","créneaux"]',
  'flowchart TD
  A[Le client choisit sa boutique] --> B[Catalogue et prix locaux]
  B --> C[Panier]
  C --> D{Disponibilite verifiee}
  D -->|Stock creneau heure limite| E[Paiement]
  D -->|Indisponible| B
  E --> F[Commande dans la console franchise]
  F --> G[Preparation en cuisine]',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'catalogue', 'Catalogue par boutique',
  'Le même catalogue réseau, filtré et tarifé pour la boutique choisie : assortiment, prix local, saison, allergènes. Changer de boutique change la vitrine, pas le référentiel.',
  'Le siège garde la main sur l''offre sans imposer le même rayon à tous.', 'book-open', 1
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'creneaux', 'Créneaux et heure limite',
  'Le moteur de disponibilité croise les jours d''ouverture, le stock du jour et le remplissage du créneau. L''heure limite est lue dans la configuration de la boutique et réévaluée en continu.',
  'Plus d''annulation le lendemain matin faute de capacité.', 'clock', 2
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'tarifs', 'Tarifs, bons et remises',
  'Le devis du panier est calculé côté serveur : règles de prix du siège, promotions locales, bons validés à l''usage, offre croisée par portion. Le client voit un prix, pas une estimation.',
  'Le montant annoncé est le montant facturé, sans litige.', 'credit-card', 3
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'b2b', 'Commande B2B',
  'Les entreprises commandent pour un bureau et un service, sur une tournée existante, avec leurs frais de livraison propres et leur numéro de TVA vérifié.',
  'La facture part au bon service sans ressaisie comptable.', 'users', 4
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'compte', 'Compte et suivi de commande',
  'Inscription, session, historique et suivi : le client retrouve ses commandes passées et l''état de celle du jour, la même donnée que celle affichée en magasin.',
  'Le magasin et le client regardent le même écran quand ils s''appellent.', 'search', 5
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'marque', 'Thème par enseigne',
  'Couleurs, logo et typographies viennent des jetons de la boutique servis par l''API. Une enseigne de plus dans le réseau ne demande pas un nouveau front.',
  'Une seconde marque se lance en paramétrage, pas en projet.', 'layers', 6
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'langues', 'Quatre langues',
  'Français, néerlandais, anglais et allemand, choisis par le client — indispensable pour un réseau belge où deux boutiques voisines ne parlent pas la même langue.',
  'Le réseau s''étend sur une frontière linguistique sans dupliquer le site.', 'settings', 7
FROM landing_modules WHERE slug = 'webshop';

-- ── Console marque (console-marque)
INSERT INTO landing_modules (slug, repo, ref, groupe, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid, modele_ia)
VALUES (
  'console-marque', 'samsam2703MFC/back_office_ws_franchisor', 'main', 'Pilotage', 2, '1',
  'Console marque',
  'L''écran du franchiseur : ce que le réseau vend, et ce qu''il a fait.',
  'Le back office du siège. Il décide ce que le réseau vend — catalogue, formules, prix, promotions — et voit ce que le réseau a fait : chiffre consolidé, boutique par boutique, zone par zone. Les droits sont posés par rôle, avec un journal d''audit derrière.',
  'La question qui revient chez tout franchiseur : qu''est-ce qui se passe réellement dans mes points de vente ? Tant que la réponse suppose d''appeler douze franchisés et de recoller douze tableurs, le réseau n''est pas pilotable — et il n''est pas transmissible non plus, puisque tout le savoir tient dans la tête de celui qui passe les appels.

La console marque met les deux moitiés du métier sur le même écran. D''un côté ce que le siège décide : l''arbre du catalogue, les formules et leurs étapes, les règles de prix, les promotions réseau et leur périmètre. De l''autre ce que le réseau produit : indicateurs consolidés, détail par boutique, ventes rapportées aux codes postaux.

L''analyse géographique mérite qu''on s''y arrête. Les ventes projetées sur les zones de chalandise montrent les recouvrements entre boutiques et les secteurs vides. C''est l''écran qui sert à décider où ouvrir la suivante, plutôt qu''à justifier après coup une ouverture décidée à l''instinct.

La gouvernance est explicite : la fiche boutique dit ce que le franchisé a le droit de modifier chez lui et ce qui reste hérité du siège. C''est un interrupteur, pas une convention orale — et c''est précisément ce qui rend une procédure transmissible à un nouveau propriétaire.',
  'Direction du réseau, animation, marketing',
  '[{"titre":"Le siège découvre trop tard","texte":"Quand les chiffres remontent par tableur en fin de mois, l''écart entre deux boutiques se constate au lieu de se corriger. Un trimestre se perd vite."},{"titre":"Chacun sa règle du jeu","texte":"Sans frontière explicite entre ce que décide le siège et ce que décide le franchisé, chaque négociation se rejoue à chaque changement de propriétaire."},{"titre":"Les ouvertures se décident à l''instinct","texte":"Sans lecture géographique des ventes, on ouvre là où une opportunité se présente, quitte à cannibaliser une boutique existante."}]',
  '[{"titre":"Le réseau visible sur un écran","texte":"Indicateurs consolidés et détail par boutique au même endroit. L''écart se voit le jour où il apparaît, pas à la clôture."},{"titre":"Une source unique pour le catalogue","texte":"Webshop, écrans en magasin et back-offices franchisés lisent tous le même référentiel. Un changement de prix se fait une fois."},{"titre":"La gouvernance devient un réglage","texte":"Ce que le franchisé peut modifier est coché dans sa fiche. La règle survit au départ de celui qui l''avait négociée."},{"titre":"Des ouvertures documentées","texte":"Zones de chalandise, recouvrements et secteurs vides sur la carte. La décision d''ouverture s''appuie sur les ventes réelles."}]',
  '["React 18","JavaScript","API REST"]',
  '["back office","franchiseur","pilotage réseau","catalogue","zone de chalandise"]',
  'flowchart TD
  A[Siege] --> B[Catalogue et formules]
  A --> C[Promotions reseau]
  A --> D[Droits par boutique]
  B --> E[Webshop]
  B --> F[Ecrans en magasin]
  B --> G[Console franchise]
  E --> H[Ventes consolidees]
  G --> H
  H --> I[Analyse par boutique et par zone]',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'dashboard', 'Tableau de bord réseau',
  'Les indicateurs du réseau consolidés au siège, avec le détail par boutique en dessous : on voit l''écart entre les points de vente sans exporter quoi que ce soit.',
  'L''écart se traite dans la semaine, pas au trimestre.', 'bar-chart', 1
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'boutiques', 'Boutiques du réseau',
  'La fiche de chaque point de vente — ouverture, périmètre, réglages hérités du siège — et ce que le franchisé a le droit de modifier chez lui.',
  'La gouvernance est un interrupteur, pas une convention orale.', 'map-pin', 2
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'catalogue', 'Catalogue produits',
  'L''arbre catégories puis produits, avec la saison et la disponibilité. C''est la source unique que lisent le webshop, les écrans en magasin et les consoles franchisées.',
  'Un prix se change une fois et se propage partout.', 'book-open', 3
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'menus', 'Menus et formules',
  'Le constructeur de formules : une formule, ses étapes, les choix ouverts à chaque étape, et le prix résolu côté serveur avec sa marge.',
  'La marge d''une formule est connue avant de la lancer.', 'layers', 4
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'promotions', 'Promotions réseau',
  'Bons de réduction et règles de prix décidés au siège, avec le périmètre des boutiques concernées. Le franchisé garde ses promotions locales à côté, sans écraser celles de la marque.',
  'Une opération nationale se lance sans appeler chaque magasin.', 'credit-card', 5
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'geo', 'Analyse géographique',
  'Les ventes rapportées aux codes postaux : zones de chalandise, recouvrements entre boutiques, secteurs vides. C''est l''écran qui sert à décider où ouvrir.',
  'Une ouverture cesse d''être un pari.', 'map-pin', 6
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'tracabilite', 'Traçabilité clients',
  'Le parcours d''un client à travers le réseau : où il commande, à quelle fréquence, sous quelle enseigne. Utile quand plusieurs boutiques servent la même personne.',
  'Le client appartient au réseau, pas à une boutique.', 'search', 7
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'prospects', 'Prospects',
  'Les candidats franchisés et les demandes d''ouverture suivis au même endroit que le reste du réseau, plutôt que dans un tableur à part.',
  'Le développement du réseau se pilote comme le reste.', 'users', 8
FROM landing_modules WHERE slug = 'console-marque';

-- ── Console franchisé (console-franchise)
INSERT INTO landing_modules (slug, repo, ref, groupe, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid, modele_ia)
VALUES (
  'console-franchise', 'samsam2703MFC/back_office_ws_franchisee', 'main', 'Pilotage', 3, '1',
  'Console franchisé',
  'La journée du point de vente : préparation, livraison, stock, clients.',
  'Le pendant magasin de la console marque. Le franchisé y voit sa journée — ce qu''il faut préparer, ce qui part en tournée, ce qui manque — et gère ce qui lui appartient : clients professionnels, créneaux, frais de livraison, promotions locales.',
  'Un franchisé passe sa journée entre la production, les livraisons et le téléphone. Ce qu''il lui faut n''est pas un outil de reporting, c''est un écran qui lui dit ce qui se passe maintenant : combien de commandes à préparer, quelles tournées sont parties, quel produit manque, quel incident est ouvert.

La console franchisé sépare nettement deux choses. Ce qui vient du siège — le catalogue, les règles de prix, les formules — arrive d''en haut et ne se discute pas depuis le magasin. Ce qui est local — les clients B2B, les créneaux, les frais de livraison, les promotions du magasin — appartient au franchisé et se règle chez lui.

Le stock du jour mérite une mention particulière : c''est la même table que consulte le webshop avant d''accepter une commande. Fermer un produit ici le retire de la vente en ligne immédiatement. Il n''y a pas deux vérités, une pour le magasin et une pour le site.

Les incidents utilisent les mêmes motifs codifiés que l''application du chauffeur. Un colis manquant déclaré sur la route et un litige constaté au magasin portent la même étiquette, donc les chiffres se comparent d''une boutique à l''autre — condition pour que le siège puisse traiter un problème récurrent au lieu de le découvrir par hasard.',
  'Franchisés et responsables de point de vente',
  '[{"titre":"Deux vérités sur le stock","texte":"Quand le site et le magasin ne lisent pas la même disponibilité, la rupture se découvre au moment de produire. Le client l''apprend par téléphone."},{"titre":"Le franchisé bloqué sur son propre métier","texte":"S''il faut passer par le siège pour ajouter un client B2B ou fermer un créneau, le magasin perd des heures sur des décisions qui lui appartiennent."},{"titre":"Des incidents incomparables","texte":"Rédigés en texte libre, les problèmes ne se comptent pas. Un défaut récurrent dans le réseau reste invisible jusqu''à ce qu''il coûte cher."}]',
  '[{"titre":"La journée sur un écran","texte":"Commandes à préparer, tournées engagées, incidents ouverts, avec les compteurs qui disent où ça coince."},{"titre":"Un seul stock","texte":"La disponibilité vue au magasin est celle que consulte le webshop. Fermer un produit le retire de la vente immédiatement."},{"titre":"Le local reste local","texte":"Clients B2B, créneaux, frais de livraison et promotions du magasin se gèrent sans passer par le siège."},{"titre":"Des incidents qui se comptent","texte":"Les mêmes motifs codifiés que l''app chauffeur, donc des chiffres comparables entre boutiques."}]',
  '["React 18","JavaScript","API REST","Leaflet"]',
  '["back office","franchisé","préparation","stock","B2B"]',
  'flowchart TD
  A[Commandes du jour] --> B[Preparation]
  B --> C[Chargement verifie]
  C --> D[Tournee]
  D --> E[Livre ou incident]
  F[Stock du jour] --> G[Webshop]
  F --> B
  E --> H[Incidents et litiges]
  H --> I[Rentabilite par tournee]',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'dashboard', 'Tableau de bord du jour',
  'Commandes à préparer, tournées engagées, incidents ouverts : la journée du magasin sur un écran, avec les compteurs qui disent où ça coince.',
  'Le responsable sait où porter son attention en arrivant.', 'bar-chart', 1
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'preparation', 'Préparation des commandes',
  'Les commandes du jour regroupées par tournée ou à plat, avec le détail article par article. C''est la liste que suit l''équipe en cuisine et que le chauffeur contre-scanne au chargement.',
  'Une seule liste sert la production et le contrôle au départ.', 'clipboard-check', 2
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'livraison', 'Livraison du jour',
  'L''état des tournées en cours vu du magasin : ce qui est parti, ce qui est livré, ce qui traîne.',
  'Le magasin répond au client sans appeler le chauffeur.', 'truck', 3
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'stock', 'Stock du jour',
  'La disponibilité par produit et par jour, celle-là même que le webshop consulte avant d''accepter une commande.',
  'Fermer un produit ici le retire de la vente en ligne tout de suite.', 'package', 4
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'b2b', 'Clients et demandes B2B',
  'Les entreprises livrées : sociétés, services, sites de livraison, e-mails de facturation. Les demandes entrantes se traitent ici et alimentent les tournées.',
  'Le franchisé développe son B2B sans dépendre du siège.', 'users', 5
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'incidents', 'Incidents et litiges',
  'Les incidents remontés du terrain — colis manquant, client absent, litige de facturation — avec leur preuve et leur suite, sur les mêmes motifs codifiés que l''app chauffeur.',
  'Les problèmes se comptent au lieu de se raconter.', 'triangle-alert', 6
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'capacite', 'Capacité et remplissage',
  'Les créneaux, leur remplissage et les fermetures exceptionnelles.',
  'Ce qui est vendu en ligne reste produisible en cuisine.', 'clock', 7
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'rentabilite', 'Rentabilité',
  'Ce que rapporte réellement une tournée ou un client une fois les frais de livraison posés en face.',
  'La discussion sur les frais se fait sur des chiffres.', 'trending-up', 8
FROM landing_modules WHERE slug = 'console-franchise';

-- ── Fournisseur (fournisseurs)
INSERT INTO landing_modules (slug, repo, ref, groupe, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid, modele_ia)
VALUES (
  'fournisseurs', 'samsam2703MFC/supplier_atl', 'main', 'Approvisionnement', 4, '1',
  'Fournisseur',
  'L''atelier de production : matières, recettes, coût de revient et commandes du réseau.',
  'Le module que fait tourner l''atelier qui produit pour le réseau. Il tient la chaîne complète : matières premières, recettes et fiches techniques, coût de revient, puis catalogue et liste de prix négociée client par client. Les commandes des points de vente arrivent dedans, la logistique les expédie.',
  'Dans un réseau qui produit, la marge se joue en amont. Tant que le coût de revient d''un produit se devine, la grille tarifaire proposée aux points de vente est un pari — et personne ne peut dire si une référence est rentable.

Le module fournisseur remonte la chaîne jusqu''aux matières premières. Chaque ingrédient a son unité et son prix d''achat, chaque produit fabriqué a sa recette et sa fiche technique. Le coût de revient en découle mécaniquement, et sert de socle aux prix négociés.

Le catalogue fournisseur est exposé aux points de vente : le magasin commande sur le vrai référentiel, pas sur un PDF envoyé une fois en début d''année. Chaque client dispose de sa grille de prix, saisie à la main ou importée en JSON avec validation avant écriture — reprendre un tarif annuel ne veut plus dire retaper deux cents lignes.

Les commandes du réseau arrivent, sont préparées, expédiées et suivies au tarif du client qui les a passées. Les réclamations reviennent au même endroit, ce qui fait que le fournisseur et le point de vente parlent du même dossier au lieu d''échanger des courriels.',
  'Ateliers de production et fournisseurs du réseau',
  '[{"titre":"Un coût de revient approximatif","texte":"Sans lien entre les matières et les recettes, le prix de vente se fixe au ressenti. Une référence peut se vendre à perte pendant des mois."},{"titre":"Des tarifs qui vivent dans des fichiers","texte":"Chaque client a sa grille, dans un tableur, dans un PDF, parfois dans un courriel. La renégociation annuelle devient un chantier de ressaisie."},{"titre":"Les réclamations se perdent","texte":"Quand un retour se traite par téléphone, personne ne sait combien de fois le même défaut est revenu."}]',
  '[{"titre":"Une marge calculée, pas estimée","texte":"Matières, recettes et fiches techniques donnent un coût de revient à chaque produit fabriqué."},{"titre":"Un tarif par client, tenu à jour","texte":"La grille se saisit ou s''importe en JSON avec validation. Une renégociation annuelle prend une importation."},{"titre":"Le réseau commande sur le vrai catalogue","texte":"Le point de vente voit ce que l''atelier propose réellement, avec son propre tarif."},{"titre":"Un dossier partagé pour les litiges","texte":"Les réclamations sont tracées avec leur suite. Le fournisseur et le magasin parlent du même incident."}]',
  '["PHP","Twig","MySQL","FastRoute","JWT"]',
  '["fournisseur","recettes","coût de revient","tarifs","logistique"]',
  'flowchart TD
  A[Matieres premieres] --> B[Recettes et fiches techniques]
  B --> C[Cout de revient]
  C --> D[Catalogue fournisseur]
  D --> E[Liste de prix par client]
  E --> F[Commandes des points de vente]
  F --> G[Logistique et expedition]
  G --> H[Reclamations]
  H --> I[Analyse des ventes et des marges]',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'matieres', 'Matières premières et ingrédients',
  'Le référentiel amont : matières, ingrédients, unités et prix d''achat. C''est ce qui donne un coût de revient à chaque recette au lieu d''un prix décidé au doigt mouillé.',
  'La marge se calcule à partir de données, pas d''intuitions.', 'package', 1
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'recettes', 'Recettes et fiches techniques',
  'Chaque produit fabriqué a sa recette et sa fiche technique : composants, quantités, process. La fiche sert autant à produire qu''à répondre à un client sur ce qu''il y a dedans.',
  'Le savoir-faire est écrit, donc transmissible.', 'chef-hat', 2
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'catalogue', 'Catalogue fournisseur',
  'Ce que l''atelier propose au réseau, avec l''accès client au catalogue : le point de vente commande sur le vrai référentiel, pas sur un PDF envoyé une fois.',
  'Fini les commandes passées sur un tarif périmé.', 'book-open', 3
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'cennik', 'Liste de prix par client',
  'Chaque client a sa grille négociée. Elle se saisit à la main ou s''importe en JSON, validée avant écriture.',
  'Reprendre un tarif annuel ne veut plus dire retaper deux cents lignes.', 'credit-card', 4
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'commandes', 'Commandes des points de vente',
  'Les commandes arrivent du réseau, sont préparées et suivies jusqu''à l''expédition, au tarif du client qui les a passées.',
  'Le bon prix s''applique sans vérification manuelle.', 'clipboard-check', 5
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'logistique', 'Logistique et expéditions',
  'Les départs, les regroupements et ce qui part vers quel point de vente — l''écran qui dit ce qui est réellement sorti de l''atelier aujourd''hui.',
  'L''atelier sait ce qu''il a expédié sans compter les palettes.', 'truck', 6
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'reclamations', 'Réclamations',
  'Les retours du réseau sur un produit ou une livraison, tracés avec leur suite.',
  'Un défaut récurrent devient visible avant de coûter cher.', 'triangle-alert', 7
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'analytics', 'Analyse des ventes',
  'Ce qui se vend, à qui, à quelle marge, sur la base des vraies commandes et des vrais coûts de revient plutôt que d''un export retravaillé.',
  'Les décisions d''assortiment s''appuient sur la marge réelle.', 'trending-up', 8
FROM landing_modules WHERE slug = 'fournisseurs';

-- ── Cuisine (cuisine)
INSERT INTO landing_modules (slug, repo, ref, groupe, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid, modele_ia)
VALUES (
  'cuisine', 'samsam2703MFC/pwa_kitchen', 'main', 'Terrain', 5, '1',
  'Cuisine',
  'L''application du plan de travail : production du jour, checklists, fiches techniques.',
  'Une application installable, tenue à une main derrière le plan de travail. Elle dit à l''équipe ce qu''il faut produire aujourd''hui, dans quel ordre, avec les fiches produit et les recettes à portée. Les checklists remplacent les feuilles plastifiées.',
  'La cuisine d''un point de vente fonctionne encore, dans la plupart des réseaux, avec des feuilles imprimées le matin et un classeur de fiches techniques que personne ne rouvre. Quand le responsable change, la moitié du tour de main part avec lui.

L''application cuisine tient sur le téléphone ou la tablette du poste. Elle ouvre sur ce qu''il y a à produire aujourd''hui, avec l''avancement par tâche — à faire, en cours, terminé — plutôt que sur un menu. Les commandes réelles des clients sont là, pas une recopie.

Les checklists d''ouverture, de service et de fermeture se cochent dans l''app, horodatées et attribuées. La différence avec la feuille plastifiée n''est pas le confort : c''est qu''un contrôle coché sans nom ni heure ne prouve rien, et qu''un réseau qui veut être transmissible doit pouvoir montrer que ses procédures sont réellement suivies.

Les fiches produit et les recettes viennent du même référentiel que celui tenu par le fournisseur. Une nouvelle recette arrive au poste de travail sans réimpression, et un problème constaté en production se déclare sur place au lieu de rester dans un carnet.',
  'Équipes de production en point de vente',
  '[{"titre":"Le savoir-faire part avec la personne","texte":"Quand les recettes et les tours de main ne sont écrits nulle part, le départ d''un responsable coûte des mois de réapprentissage."},{"titre":"Des contrôles impossibles à prouver","texte":"Une case cochée sur une feuille plastifiée, sans nom ni heure, ne vaut rien le jour où il faut démontrer qu''une procédure est suivie."},{"titre":"La production travaille sur une recopie","texte":"Recopier les commandes du matin introduit des erreurs, et personne ne sait laquelle des deux listes fait foi."}]',
  '[{"titre":"Les procédures vivent dans l''outil","texte":"Recettes, fiches techniques et checklists sont au poste de travail. Le savoir-faire ne dépend plus d''une personne."},{"titre":"Des contrôles prouvables","texte":"Chaque tâche cochée porte un nom et une heure. Ce qui a été fait est démontrable sans classeur."},{"titre":"La commande réelle, pas sa copie","texte":"La cuisine travaille sur la commande du client telle qu''elle a été passée."},{"titre":"Aucune installation à gérer","texte":"L''app s''installe depuis le navigateur, sans boutique d''applications ni intervention informatique."}]',
  '["PHP","Twig","MySQL","PWA"]',
  '["cuisine","production","checklists","fiches techniques","PWA"]',
  'flowchart TD
  A[Commandes du jour] --> B[Production du jour]
  B --> C{Avancement par tache}
  C --> D[A faire]
  C --> E[En cours]
  C --> F[Termine]
  G[Recettes et fiches techniques] --> B
  B --> H[Checklists de poste horodatees]
  B --> I[Reclamation declaree au poste]',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'production', 'Production du jour',
  'Ce qu''il y a à faire aujourd''hui, avec l''avancement par tâche : à faire, en cours, terminé. Le tableau de bord ouvre sur cet état, pas sur un menu.',
  'L''équipe voit l''essentiel en déverrouillant l''écran.', 'chef-hat', 1
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'checklists', 'Checklists de poste',
  'Les contrôles d''ouverture, de service et de fermeture cochés dans l''app, horodatés et attribués.',
  'Ce qui a été fait est prouvable sans classeur.', 'clipboard-check', 2
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'fiches', 'Produits et recettes',
  'La base de connaissances de la cuisine : fiche produit, recette, fiche technique. Le même contenu que celui tenu par le fournisseur, consulté au poste de travail.',
  'Une recette nouvelle arrive au poste sans réimpression.', 'file-text', 3
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'commandes', 'Commandes à produire',
  'Les commandes qui concernent la cuisine, avec leur détail. La cuisine travaille sur la commande réelle du client, pas sur une recopie.',
  'Une erreur de recopie en moins entre le client et le four.', 'package', 4
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'clients', 'Clients servis',
  'Qui est livré, avec quelles particularités. Utile quand une commande B2B revient chaque semaine avec ses contraintes.',
  'Les habitudes d''un client régulier ne se redécouvrent pas.', 'users', 5
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'reclamations', 'Réclamations',
  'Un problème constaté en production se déclare sur place, avec son motif. Il part vers le fournisseur ou le siège au lieu de rester dans un carnet.',
  'Le défaut remonte le jour où il est vu.', 'triangle-alert', 6
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'hors-ligne', 'Installable et hors ligne',
  'L''app s''installe sur le téléphone ou la tablette de la cuisine depuis le navigateur, sans boutique d''applications ni intervention IT, et supporte les coupures réseau du magasin.',
  'Déployer un magasin de plus ne demande aucune informatique sur place.', 'smartphone', 7
FROM landing_modules WHERE slug = 'cuisine';

-- ── Panel consultant (consultant)
INSERT INTO landing_modules (slug, repo, ref, groupe, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid, modele_ia)
VALUES (
  'consultant', 'samsam2703MFC/pwa_consultant', 'main', 'Terrain', 6, '1',
  'Panel consultant',
  'L''application terrain des animateurs réseau : visites, checklists notées, comptes rendus.',
  'L''animateur réseau passe sa journée en magasin, pas devant un tableur. Le panel lui donne son agenda de visites, les checklists à passer point de vente par point de vente, et de quoi noter et commenter chaque tâche vérifiée — avec le nom du vérificateur et l''horodatage.',
  'L''animation réseau est le métier qui décide si une enseigne tient ses standards. C''est aussi celui qui se pratique le plus souvent sans outil : un carnet dans la voiture, un tableur le soir, et un compte rendu rédigé de mémoire trois jours plus tard.

Le panel consultant met la visite au centre. L''agenda liste les points de vente à voir, avec ce qui avait été laissé ouvert la fois précédente. Sur place, les checklists se passent tâche par tâche : chacune est vérifiée, notée et commentée, et la revue porte le nom de son auteur et son horodatage.

Ce détail est l''essentiel du module. « Vérifié » sans savoir par qui ni quand ne vaut rien — ni pour corriger, ni pour prouver, ni pour transmettre. Un réseau dont les contrôles sont datés et signés peut démontrer à un repreneur que ses standards existent ailleurs que dans le discours.

Les objectifs par indicateur, la tendance sur la période et les leviers identifiés sont sur le même écran : la conversation avec le franchisé s''appuie sur ces trois vues plutôt que sur une impression. Le compte rendu se construit à partir de ce qui a été réellement vérifié sur place, et se valide côté propriétaire. Personne ne retape la visite le soir.',
  'Animateurs réseau et responsables d''exploitation',
  '[{"titre":"Des visites sans trace exploitable","texte":"Un compte rendu rédigé de mémoire trois jours après la visite perd l''essentiel. Ce qui n''est pas noté sur place n''existe pas."},{"titre":"« Vérifié » par personne","texte":"Un contrôle sans nom ni horodatage ne prouve rien. Le jour où il faut démontrer qu''un standard est appliqué, il n''y a rien à montrer."},{"titre":"La discussion tourne au ressenti","texte":"Sans objectifs ni tendance sous les yeux, l''échange avec le franchisé se joue sur des impressions et se rejoue à chaque visite."}]',
  '[{"titre":"Le contrôle devient une preuve","texte":"Chaque tâche vérifiée porte une note, un commentaire, un nom et une heure."},{"titre":"Zéro ressaisie après la visite","texte":"Le compte rendu se construit à partir de ce qui a été relevé sur place, et se valide côté propriétaire."},{"titre":"Une conversation appuyée sur des chiffres","texte":"Objectifs, tendance et leviers sur le même écran que la checklist."},{"titre":"La mémoire du magasin se conserve","texte":"Ce qui restait ouvert à la visite précédente est retrouvé à la suivante, quel que soit l''animateur."}]',
  '["PHP","Twig","MySQL","PWA"]',
  '["animation réseau","visites","checklists","audit","terrain"]',
  'flowchart TD
  A[Agenda des visites] --> B[Preparation avant depart]
  B --> C[Visite en magasin]
  C --> D[Checklist notee et commentee]
  D --> E[Nom du verificateur et horodatage]
  C --> F[Objectifs tendances leviers]
  D --> G[Compte rendu]
  F --> G
  G --> H[Validation cote proprietaire]',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'agenda', 'Agenda des visites',
  'Les visites planifiées par point de vente, préparées avant de partir et retrouvées sur place. L''animateur sait ce qu''il va voir et ce qu''il a laissé ouvert la dernière fois.',
  'Rien ne se perd entre deux passages.', 'calendar', 1
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'checklists', 'Checklists de visite notées',
  'Chaque tâche du magasin est vérifiée, notée et commentée, et la revue porte le nom de son auteur et son horodatage.',
  'Le contrôle devient démontrable, pas déclaratif.', 'clipboard-check', 2
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'objectifs', 'Objectifs, tendances et leviers',
  'Les cibles par indicateur et par magasin, la tendance sur la période, et les leviers identifiés pour la corriger.',
  'La discussion avec le franchisé porte sur des chiffres.', 'trending-up', 3
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'reclamations', 'Réclamations matériel',
  'Ce qui est cassé ou manquant se déclare pendant la visite, sur plusieurs magasins d''un coup quand le même problème revient dans le réseau.',
  'Un défaut de série se traite en une fois.', 'triangle-alert', 4
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'rapports', 'Comptes rendus de visite',
  'Le compte rendu se construit à partir de ce qui a été vérifié sur place, et se valide côté propriétaire.',
  'Personne ne retape la visite le soir.', 'file-text', 5
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'notes', 'Notes de terrain',
  'Les remarques prises au passage, rattachées au magasin et retrouvées à la visite suivante — plutôt qu''un carnet qui reste dans la voiture.',
  'La mémoire du magasin survit au changement d''animateur.', 'pencil', 6
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'kiosque', 'Installable et plein écran',
  'L''app s''installe depuis le navigateur et s''ouvre sans barre d''adresse. Sur un écran fixe en magasin, elle se lance en mode kiosque.',
  'Un poste de plus se met en service en quelques minutes.', 'smartphone', 7
FROM landing_modules WHERE slug = 'consultant';

-- ── Tournées de livraison (livraison)
INSERT INTO landing_modules (slug, repo, ref, groupe, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid, modele_ia)
VALUES (
  'livraison', 'samsam2703MFC/pwa_delivery', 'main', 'Approvisionnement', 7, '1',
  'Tournées de livraison',
  'L''application tablette du chauffeur : chargement vérifié, tournée guidée, preuve de livraison.',
  'Une tablette partagée au dépôt, une session liée à la tournée du jour. Le chauffeur vérifie son chargement au scan, suit un ordre de passage qui ne bouge plus, et repart de chaque point avec une preuve datée. Tout fonctionne hors ligne.',
  'La livraison est l''endroit où un réseau perd de l''argent sans le voir. Un colis manquant se découvre chez le client, un litige se règle au téléphone contre la parole du chauffeur, et personne ne sait combien de fois le cas s''est reproduit ce mois-ci.

L''application impose deux points de contrôle. Au départ, le double scan : le chauffeur scanne ce qu''il embarque, l''app le confronte au bon préparé par le magasin, les manquants sont listés par client, et le départ reste bloqué tant que l''emport est incomplet — sauf dérogation, elle aussi journalisée avec son auteur.

À l''arrivée, la preuve : dépôt scanné, photo géolocalisée, puis un QR code qui tourne et que le client scanne pour confirmer la réception. Si le client n''a pas de téléphone, la preuve retombe sur un code PIN, une signature ou la photo seule. Les incidents se choisissent dans une liste fermée de motifs, jamais en texte libre, pour que le siège lise des chiffres comparables entre tournées.

Le tout fonctionne hors ligne par construction. La tournée entière tient dans la tablette ; sans réseau, le chauffeur continue à scanner, photographier et clôturer. Les écritures partent à la reconnexion, dans l''ordre, chacune avec une clé d''idempotence pour qu''un rejeu ne crée jamais de doublon.',
  'Chauffeurs livreurs, salariés ou sous-traitants',
  '[{"titre":"Le manquant se découvre chez le client","texte":"Sans contrôle au chargement, l''erreur se constate à l''arrivée. Le magasin refait la course ou perd la commande."},{"titre":"Un litige contre une parole","texte":"Sans preuve datée et localisée, chaque contestation de livraison se règle au bénéfice du doute — toujours le même qui paie."},{"titre":"Des motifs en texte libre","texte":"Quand chaque chauffeur décrit l''incident à sa façon, le siège ne peut ni compter ni comparer."},{"titre":"Le réseau coupe, la tournée s''arrête","texte":"Une application qui exige la connexion devient inutilisable en zone blanche, c''est-à-dire là où se font les livraisons."}]',
  '[{"titre":"Le départ bloqué sur emport incomplet","texte":"Le double scan confronte le chargement au bon préparé. L''erreur se corrige au dépôt, pas chez le client."},{"titre":"Une preuve à chaque point","texte":"Photo géolocalisée et confirmation du client par QR, avec repli sur PIN, signature ou photo seule."},{"titre":"Des incidents comparables","texte":"Motifs codifiés, décision et preuve jointe. Le siège lit des chiffres, pas des récits."},{"titre":"Utilisable en zone blanche","texte":"La tournée tient dans la tablette. Les écritures repartent à la reconnexion, sans doublon."}]',
  '["JavaScript","PWA","Service Worker"]',
  '["livraison","tournées","preuve de livraison","hors ligne","PWA"]',
  'flowchart TD
  A[Connexion chauffeur] --> B[Tournee du jour]
  B --> C[Chargement en double scan]
  C --> D{Emport complet}
  D -->|Non| C
  D -->|Oui| E[Ordre de passage figé]
  E --> F[Point de livraison]
  F --> G[Photo geolocalisee et QR client]
  F --> H[Incident avec motif codifie]
  G --> I[File hors ligne renvoyee a la reconnexion]
  H --> I',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'tournee', 'Tournée du jour',
  'La tournée assignée s''ouvre avec ses chiffres : colis à livrer, points de passage, heure de départ et ETA de fin. L''ordre de passage est figé, il ne se réordonne pas en cours de route.',
  'Le magasin et le client savent quand la livraison passe.', 'map-pin', 1
FROM landing_modules WHERE slug = 'livraison';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'chargement', 'Chargement en double scan',
  'Le chauffeur scanne ce qu''il embarque, l''app le confronte au bon préparé par le magasin. Les manquants sont listés par client et le départ reste bloqué tant que l''emport est incomplet.',
  'L''erreur se corrige au dépôt, pas chez le client.', 'package', 2
FROM landing_modules WHERE slug = 'livraison';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'livraison', 'Preuve de livraison',
  'À chaque point : dépôt scanné, photo géolocalisée, puis un QR qui tourne et que le client scanne pour confirmer. Repli sur code PIN, signature ou photo seule.',
  'Un litige se tranche sur une preuve datée.', 'clipboard-check', 3
FROM landing_modules WHERE slug = 'livraison';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'incident', 'Incidents codifiés',
  'Client absent, adresse fermée, colis abîmé : le chauffeur choisit un motif dans une liste fermée, décide de la suite et joint la preuve.',
  'Le siège lit des motifs comparables entre tournées.', 'triangle-alert', 4
FROM landing_modules WHERE slug = 'livraison';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'hors-ligne', 'Hors ligne par défaut',
  'La tournée entière tient dans la tablette. Sans réseau, le chauffeur continue à scanner, photographier et clôturer ; les écritures partent à la reconnexion, dans l''ordre, sans doublon.',
  'La zone blanche n''interrompt plus la tournée.', 'refresh-cw', 5
FROM landing_modules WHERE slug = 'livraison';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'contrat', 'Salarié ou sous-traitant',
  'Le même écran sert les deux statuts : le chauffeur salarié voit son pointage de service, le sous-traitant ne l''a pas. Le type de contrat est porté par la session.',
  'Une seule application à maintenir pour les deux modèles.', 'users', 6
FROM landing_modules WHERE slug = 'livraison';

-- ── Régie d'affichage (affichage)
INSERT INTO landing_modules (slug, repo, ref, groupe, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid, modele_ia)
VALUES (
  'affichage', 'samsam2703MFC/signage', 'main', 'Vente', 8, '1',
  'Régie d''affichage',
  'Les écrans du magasin pilotés depuis un seul back office, jusqu''au player.',
  'Un magasin affiche des prix, des promos et des menus sur ses écrans. La régie remplace le montage vidéo et la clé USB : on construit un film à partir de la base produits, on le planifie par période, on le pousse sur les écrans du réseau, et chaque écran remonte son état.',
  'Les écrans en magasin sont le dernier endroit où le prix affiché ne vient de nulle part. Quelqu''un monte une vidéo, la copie sur une clé USB, fait le tour des boutiques — et six semaines plus tard trois magasins affichent encore l''ancienne promotion.

La régie relie l''affichage à la base produits. Les listes de prix à l''écran sont liées à la table catalogue, pas retapées : un changement de tarif se propage au film suivant sans repasser par un logiciel de montage. Les jetons dynamiques — nom du magasin, date, saison — se résolvent à l''affichage, donc un même élément sert tout le réseau.

Le compositeur assemble une bibliothèque d''éléments en playlist : mise en page, mouvement, filigrane, réglés élément par élément. Les périodes décrivent les plages de la journée — le petit-déjeuner, le service du midi, le goûter n''affichent pas la même chose — et le planning dit quel film passe quand, sur l''horloge du magasin.

Chaque écran est un player authentifié par jeton qui envoie un battement de cœur et une capture. La supervision montre, magasin par magasin, ce qui est réellement affiché, et signale l''écran qui a décroché. La dernière playlist publiée est aussi consultable en plein écran à l''adresse publique, ce qui permet à un responsable de vérifier depuis son téléphone.',
  'Marketing réseau et responsables de point de vente',
  '[{"titre":"Le prix à l''écran est faux","texte":"Quand l''affichage est monté à la main, il dérive du catalogue dès la première promotion. Le client voit un prix, la caisse en applique un autre."},{"titre":"Une opération commerciale prend des semaines","texte":"Monter, copier et distribuer une vidéo par magasin fait qu''une campagne nationale n''est jamais lancée partout le même jour."},{"titre":"Personne ne sait ce qui est affiché","texte":"Sans remontée des écrans, un player éteint ou bloqué sur l''ancienne campagne passe inaperçu pendant des semaines."}]',
  '[{"titre":"Le tarif affiché vient du catalogue","texte":"Les listes de prix sont liées à la table produits. Un changement se propage sans ressaisie."},{"titre":"Une campagne bascule d''un coup","texte":"Les éléments taggés en campagne s''activent ensemble, sur les écrans choisis."},{"titre":"Ce qui est affiché est vérifiable","texte":"Chaque player remonte un battement de cœur et une capture. L''écran décroché est signalé."},{"titre":"L''affichage s''adapte à l''heure","texte":"Les périodes de la journée déclenchent le bon film sur l''horloge du magasin."}]',
  '["Node.js 22","SQLite","Preact"]',
  '["affichage dynamique","digital signage","écrans magasin","campagnes","playlist"]',
  'flowchart TD
  A[Base produits et tarifs] --> B[Elements du compositeur]
  B --> C[Playlist et film]
  D[Campagnes] --> C
  C --> E[Planning par periode]
  E --> F[Publication vers les players]
  F --> G[Ecrans en magasin]
  G --> H[Battement de coeur et capture]
  H --> I[Supervision du reseau]',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'compositeur', 'Compositeur de film',
  'La bibliothèque d''éléments — catégories, liaisons, promos — et la playlist qui en fait un film. Mise en page, mouvement, filigrane et jetons dynamiques se règlent élément par élément.',
  'Un montage vidéo de moins à sous-traiter.', 'layers', 1
FROM landing_modules WHERE slug = 'affichage';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'produits', 'Produits et tarifs affichés',
  'Les listes de prix à l''écran sont liées à la table produits, pas retapées. Un changement de prix se propage au prochain film.',
  'Le prix vu par le client est celui de la caisse.', 'book-open', 2
FROM landing_modules WHERE slug = 'affichage';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'campagnes', 'Campagnes et promotions',
  'Les opérations commerciales sont taguées en campagne : on active une campagne et tous les éléments qui la portent basculent d''un coup, sur les écrans choisis.',
  'Une opération nationale démarre partout le même matin.', 'bell', 3
FROM landing_modules WHERE slug = 'affichage';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'planning', 'Périodes et planning de diffusion',
  'Le petit-déjeuner, le service du midi et le goûter n''affichent pas la même chose. Les périodes décrivent ces plages et le planning dit quel film passe quand.',
  'L''écran vend ce qui est disponible à cette heure-là.', 'calendar', 4
FROM landing_modules WHERE slug = 'affichage';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'reseau', 'Réseau et supervision des écrans',
  'Chaque écran est un player authentifié par jeton qui envoie un battement de cœur et une capture. La supervision montre magasin par magasin ce qui est réellement affiché.',
  'Un écran décroché se voit le jour même.', 'monitor', 5
FROM landing_modules WHERE slug = 'affichage';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, ordre)
SELECT id, 'film', 'Visionneuse publique',
  'La dernière playlist publiée est consultable en plein écran sans connexion, à l''adresse /film.',
  'Le responsable vérifie l''affichage depuis son téléphone.', 'smartphone', 6
FROM landing_modules WHERE slug = 'affichage';

-- ── Page d'accueil
DELETE FROM landing_site;
INSERT INTO landing_site (titre, sous_titre, accroche, problemes, reponses, mermaid,
  cta_texte, cta_url, meta_description)
VALUES (
  'La valeur d''un réseau, c''est sa capacité à être transmis',
  'Un ERP qui met le savoir-faire dans l''outil plutôt que dans la tête de quelques personnes.',
  'Un réseau se vend sur ce qu''il peut transmettre. Tant que les procédures vivent dans la mémoire des fondateurs, dans des tableurs personnels et dans des habitudes prises en magasin, ce qui se transmet n''est qu''une enseigne et un bail. Le repreneur rachète un nom, pas une méthode.
Nos huit modules couvrent l''exploitation réelle d''un réseau : la vente en ligne, le pilotage du siège et du point de vente, l''approvisionnement, la production, l''animation terrain, la livraison et l''affichage. Chacun a la même exigence : ce qui est fait laisse une trace datée et attribuée, et ce qui est décidé est écrit quelque part d''autre que dans une conversation.',
  '[{"titre":"L''exécution en magasin est invisible","texte":"Le siège apprend qu''un standard n''est pas tenu quand un client se plaint, ou lors d''une visite. Entre les deux, personne ne sait. L''écart entre deux points de vente se creuse sans que rien ne le signale."},{"titre":"L''information remonte tard et déformée","texte":"Les chiffres arrivent par tableur en fin de mois, recopiés au moins deux fois. Quand ils arrivent, le trimestre est joué et la discussion porte sur la fiabilité du fichier plutôt que sur la décision à prendre."},{"titre":"Les procédures ne survivent pas au départ","texte":"Le savoir-faire tient dans quelques personnes. Un responsable qui part emporte le tour de main, la mémoire des clients difficiles et les raisons derrière chaque règle. Le successeur réapprend au prix d''une saison."},{"titre":"Chaque outil raconte une histoire différente","texte":"Le site annonce un stock, la cuisine en connaît un autre, le chauffeur découvre le troisième. La ressaisie entre ces mondes coûte des heures et introduit les erreurs qu''on passe ensuite à corriger."},{"titre":"« Vérifié » ne prouve rien","texte":"Une case cochée sans nom ni horodatage ne démontre rien — ni à un franchisé, ni à un contrôle, ni à un repreneur. Le réseau ne peut pas prouver que ses standards existent ailleurs que dans son discours."}]',
  '[{"titre":"Le terrain saisit là où il travaille","texte":"Les applications de la cuisine, de l''animateur et du chauffeur sont installables depuis un navigateur et fonctionnent hors ligne. La donnée naît au poste de travail, une seule fois, au moment où le geste est fait."},{"titre":"Chaque contrôle porte un nom et une heure","texte":"Checklists de poste, checklists de visite notées, preuve de livraison géolocalisée : ce qui est vérifié est attribué et daté. Un standard devient démontrable, donc transmissible."},{"titre":"Un seul référentiel produit","texte":"Le catalogue du siège alimente le webshop, les consoles franchisées et les écrans en magasin. Un prix se change une fois. Le stock du jour vu en cuisine est celui que le site consulte avant d''accepter une commande."},{"titre":"La frontière siège–franchisé est un réglage","texte":"La fiche de chaque boutique dit ce qui est hérité du siège et ce que le franchisé pilote chez lui. La règle ne se renégocie pas à chaque changement de propriétaire."},{"titre":"Les incidents se comptent","texte":"Motifs codifiés, partagés entre l''application du chauffeur et la console du magasin. Un défaut récurrent devient un chiffre comparable entre boutiques, donc un sujet qu''on traite."}]',
  'flowchart LR
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
  G --> K',
  'Demander une démonstration', '#contact',
  'ERP pour réseaux de franchise : vente en ligne, pilotage, approvisionnement, production, animation terrain, livraison et affichage — huit modules en production.'
);

COMMIT;
