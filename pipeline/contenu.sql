-- Contenu de départ de la landing — 8 modules et la page d'accueil.
-- Généré par pipeline/seed-contenu.mjs. Compatible MySQL et PostgreSQL.
-- Rejouable : le contenu est remplacé, jamais dupliqué.
-- Prérequis : les tables existent (node bootstrap-db.mjs).

BEGIN;

DELETE FROM landing_fonctions;
DELETE FROM landing_modules;

-- ── Webshop (webshop)
INSERT INTO landing_modules (slug, repo, ref, groupe, icone, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid,
  leviers, liens, onboarding, modele_ia)
VALUES (
  'webshop', 'samsam2703MFC/WebShop', 'main', 'Vente', 'shopping-cart', 1, '1',
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
  '["trafic","recurrence","xp"]',
  '[{"slug":"console-marque","sens":"recoit","quoi":"le catalogue, les prix et les promotions du siège"},{"slug":"console-franchise","sens":"envoie","quoi":"les commandes du jour, prêtes à préparer"},{"slug":"console-franchise","sens":"recoit","quoi":"le stock du jour et les créneaux disponibles"}]',
  'Première semaine : vous choisissez une boutique pilote, vous vérifiez que son catalogue, ses créneaux et son heure limite sont justes, et vous ouvrez la vente. Ce que vous gagnez tout de suite : plus aucune commande acceptée que la cuisine ne peut produire.',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'catalogue', 'Catalogue par boutique',
  'Le même catalogue réseau, filtré et tarifé pour la boutique choisie : assortiment, prix local, saison, allergènes. Changer de boutique change la vitrine, pas le référentiel.',
  'Le siège garde la main sur l''offre sans imposer le même rayon à tous.', 'book-open', '["trafic"]', 1
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'creneaux', 'Créneaux et heure limite',
  'Le moteur de disponibilité croise les jours d''ouverture, le stock du jour et le remplissage du créneau. L''heure limite est lue dans la configuration de la boutique et réévaluée en continu.',
  'Plus d''annulation le lendemain matin faute de capacité.', 'clock', '["xp","labour"]', 2
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'tarifs', 'Tarifs, bons et remises',
  'Le devis du panier est calculé côté serveur : règles de prix du siège, promotions locales, bons validés à l''usage, offre croisée par portion. Le client voit un prix, pas une estimation.',
  'Le montant annoncé est le montant facturé, sans litige.', 'credit-card', '["food","recurrence"]', 3
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'b2b', 'Commande B2B',
  'Les entreprises commandent pour un bureau et un service, sur une tournée existante, avec leurs frais de livraison propres et leur numéro de TVA vérifié.',
  'La facture part au bon service sans ressaisie comptable.', 'users', '["recurrence","trafic"]', 4
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'compte', 'Compte et suivi de commande',
  'Inscription, session, historique et suivi : le client retrouve ses commandes passées et l''état de celle du jour, la même donnée que celle affichée en magasin.',
  'Le magasin et le client regardent le même écran quand ils s''appellent.', 'search', '["recurrence"]', 5
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'marque', 'Thème par enseigne',
  'Couleurs, logo et typographies viennent des jetons de la boutique servis par l''API. Une enseigne de plus dans le réseau ne demande pas un nouveau front.',
  'Une seconde marque se lance en paramétrage, pas en projet.', 'layers', '["trafic"]', 6
FROM landing_modules WHERE slug = 'webshop';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'langues', 'Quatre langues',
  'Français, néerlandais, anglais et allemand, choisis par le client — indispensable pour un réseau belge où deux boutiques voisines ne parlent pas la même langue.',
  'Le réseau s''étend sur une frontière linguistique sans dupliquer le site.', 'settings', '["trafic"]', 7
FROM landing_modules WHERE slug = 'webshop';

-- ── Console marque (console-marque)
INSERT INTO landing_modules (slug, repo, ref, groupe, icone, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid,
  leviers, liens, onboarding, modele_ia)
VALUES (
  'console-marque', 'samsam2703MFC/back_office_ws_franchisor', 'main', 'Pilotage', 'layout-dashboard', 2, '1',
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
  '["trafic","recurrence","food","overhead"]',
  '[{"slug":"webshop","sens":"envoie","quoi":"le catalogue, les formules et les règles de prix"},{"slug":"console-franchise","sens":"envoie","quoi":"ce que le franchisé peut modifier chez lui"},{"slug":"affichage","sens":"envoie","quoi":"les produits et tarifs affichés en magasin"},{"slug":"consultant","sens":"recoit","quoi":"les comptes rendus de visite et les écarts constatés"}]',
  'C''est par ici qu''on commence. Vous y déclarez vos boutiques, vous montez le catalogue une fois, et vous décidez ce que chaque franchisé peut modifier chez lui. Tout le reste du réseau lit ces décisions.',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'dashboard', 'Tableau de bord réseau',
  'Les indicateurs du réseau consolidés au siège, avec le détail par boutique en dessous : on voit l''écart entre les points de vente sans exporter quoi que ce soit.',
  'L''écart se traite dans la semaine, pas au trimestre.', 'bar-chart', '["trafic","food"]', 1
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'boutiques', 'Boutiques du réseau',
  'La fiche de chaque point de vente — ouverture, périmètre, réglages hérités du siège — et ce que le franchisé a le droit de modifier chez lui.',
  'La gouvernance est un interrupteur, pas une convention orale.', 'map-pin', '["overhead"]', 2
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'catalogue', 'Catalogue produits',
  'L''arbre catégories puis produits, avec la saison et la disponibilité. C''est la source unique que lisent le webshop, les écrans en magasin et les consoles franchisées.',
  'Un prix se change une fois et se propage partout.', 'book-open', '["food"]', 3
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'menus', 'Menus et formules',
  'Le constructeur de formules : une formule, ses étapes, les choix ouverts à chaque étape, et le prix résolu côté serveur avec sa marge.',
  'La marge d''une formule est connue avant de la lancer.', 'layers', '["food"]', 4
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'promotions', 'Promotions réseau',
  'Bons de réduction et règles de prix décidés au siège, avec le périmètre des boutiques concernées. Le franchisé garde ses promotions locales à côté, sans écraser celles de la marque.',
  'Une opération nationale se lance sans appeler chaque magasin.', 'credit-card', '["trafic","recurrence"]', 5
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'geo', 'Analyse géographique',
  'Les ventes rapportées aux codes postaux : zones de chalandise, recouvrements entre boutiques, secteurs vides. C''est l''écran qui sert à décider où ouvrir.',
  'Une ouverture cesse d''être un pari.', 'map-pin', '["trafic"]', 6
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'tracabilite', 'Traçabilité clients',
  'Le parcours d''un client à travers le réseau : où il commande, à quelle fréquence, sous quelle enseigne. Utile quand plusieurs boutiques servent la même personne.',
  'Le client appartient au réseau, pas à une boutique.', 'search', '["recurrence"]', 7
FROM landing_modules WHERE slug = 'console-marque';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'prospects', 'Prospects',
  'Les candidats franchisés et les demandes d''ouverture suivis au même endroit que le reste du réseau, plutôt que dans un tableur à part.',
  'Le développement du réseau se pilote comme le reste.', 'users', '["overhead"]', 8
FROM landing_modules WHERE slug = 'console-marque';

-- ── Console franchisé (console-franchise)
INSERT INTO landing_modules (slug, repo, ref, groupe, icone, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid,
  leviers, liens, onboarding, modele_ia)
VALUES (
  'console-franchise', 'samsam2703MFC/back_office_ws_franchisee', 'main', 'Pilotage', 'store', 3, '1',
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
  '["xp","food","labour","overhead"]',
  '[{"slug":"webshop","sens":"envoie","quoi":"la disponibilité qui autorise ou bloque une vente"},{"slug":"cuisine","sens":"envoie","quoi":"les commandes à produire dans la journée"},{"slug":"livraison","sens":"envoie","quoi":"les tournées et le bon de chargement à contre-scanner"},{"slug":"livraison","sens":"recoit","quoi":"les preuves de livraison et les incidents"}]',
  'À ouvrir le matin. La journée du magasin y tient sur un écran : ce qu''il faut préparer, ce qui part en tournée, ce qui manque. Le franchisé y gère ce qui lui appartient sans passer par le siège.',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'dashboard', 'Tableau de bord du jour',
  'Commandes à préparer, tournées engagées, incidents ouverts : la journée du magasin sur un écran, avec les compteurs qui disent où ça coince.',
  'Le responsable sait où porter son attention en arrivant.', 'bar-chart', '["labour","xp"]', 1
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'preparation', 'Préparation des commandes',
  'Les commandes du jour regroupées par tournée ou à plat, avec le détail article par article. C''est la liste que suit l''équipe en cuisine et que le chauffeur contre-scanne au chargement.',
  'Une seule liste sert la production et le contrôle au départ.', 'clipboard-check', '["labour"]', 2
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'livraison', 'Livraison du jour',
  'L''état des tournées en cours vu du magasin : ce qui est parti, ce qui est livré, ce qui traîne.',
  'Le magasin répond au client sans appeler le chauffeur.', 'truck', '["xp","labour"]', 3
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'stock', 'Stock du jour',
  'La disponibilité par produit et par jour, celle-là même que le webshop consulte avant d''accepter une commande.',
  'Fermer un produit ici le retire de la vente en ligne tout de suite.', 'package', '["food"]', 4
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'b2b', 'Clients et demandes B2B',
  'Les entreprises livrées : sociétés, services, sites de livraison, e-mails de facturation. Les demandes entrantes se traitent ici et alimentent les tournées.',
  'Le franchisé développe son B2B sans dépendre du siège.', 'users', '["recurrence"]', 5
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'incidents', 'Incidents et litiges',
  'Les incidents remontés du terrain — colis manquant, client absent, litige de facturation — avec leur preuve et leur suite, sur les mêmes motifs codifiés que l''app chauffeur.',
  'Les problèmes se comptent au lieu de se raconter.', 'triangle-alert', '["xp"]', 6
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'capacite', 'Capacité et remplissage',
  'Les créneaux, leur remplissage et les fermetures exceptionnelles.',
  'Ce qui est vendu en ligne reste produisible en cuisine.', 'clock', '["labour","xp"]', 7
FROM landing_modules WHERE slug = 'console-franchise';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'rentabilite', 'Rentabilité',
  'Ce que rapporte réellement une tournée ou un client une fois les frais de livraison posés en face.',
  'La discussion sur les frais se fait sur des chiffres.', 'trending-up', '["overhead","food"]', 8
FROM landing_modules WHERE slug = 'console-franchise';

-- ── Fournisseur (fournisseurs)
INSERT INTO landing_modules (slug, repo, ref, groupe, icone, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid,
  leviers, liens, onboarding, modele_ia)
VALUES (
  'fournisseurs', 'samsam2703MFC/supplier_atl', 'main', 'Approvisionnement', 'building-2', 4, '1',
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
  '["food","overhead"]',
  '[{"slug":"cuisine","sens":"envoie","quoi":"les recettes, fiches techniques et coûts de revient"},{"slug":"console-franchise","sens":"recoit","quoi":"les commandes des points de vente"}]',
  'Le point de départ de la marge. Vous saisissez les matières et les recettes, le coût de revient en découle, et la grille tarifaire de chaque point de vente cesse d''être un pari.',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'matieres', 'Matières premières et ingrédients',
  'Le référentiel amont : matières, ingrédients, unités et prix d''achat. C''est ce qui donne un coût de revient à chaque recette au lieu d''un prix décidé au doigt mouillé.',
  'La marge se calcule à partir de données, pas d''intuitions.', 'package', '["food"]', 1
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'recettes', 'Recettes et fiches techniques',
  'Chaque produit fabriqué a sa recette et sa fiche technique : composants, quantités, process. La fiche sert autant à produire qu''à répondre à un client sur ce qu''il y a dedans.',
  'Le savoir-faire est écrit, donc transmissible.', 'chef-hat', '["food","xp"]', 2
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'catalogue', 'Catalogue fournisseur',
  'Ce que l''atelier propose au réseau, avec l''accès client au catalogue : le point de vente commande sur le vrai référentiel, pas sur un PDF envoyé une fois.',
  'Fini les commandes passées sur un tarif périmé.', 'book-open', '["food"]', 3
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'cennik', 'Liste de prix par client',
  'Chaque client a sa grille négociée. Elle se saisit à la main ou s''importe en JSON, validée avant écriture.',
  'Reprendre un tarif annuel ne veut plus dire retaper deux cents lignes.', 'credit-card', '["food","overhead"]', 4
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'commandes', 'Commandes des points de vente',
  'Les commandes arrivent du réseau, sont préparées et suivies jusqu''à l''expédition, au tarif du client qui les a passées.',
  'Le bon prix s''applique sans vérification manuelle.', 'clipboard-check', '["food"]', 5
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'logistique', 'Logistique et expéditions',
  'Les départs, les regroupements et ce qui part vers quel point de vente — l''écran qui dit ce qui est réellement sorti de l''atelier aujourd''hui.',
  'L''atelier sait ce qu''il a expédié sans compter les palettes.', 'truck', '["overhead"]', 6
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'reclamations', 'Réclamations',
  'Les retours du réseau sur un produit ou une livraison, tracés avec leur suite.',
  'Un défaut récurrent devient visible avant de coûter cher.', 'triangle-alert', '["xp"]', 7
FROM landing_modules WHERE slug = 'fournisseurs';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'analytics', 'Analyse des ventes',
  'Ce qui se vend, à qui, à quelle marge, sur la base des vraies commandes et des vrais coûts de revient plutôt que d''un export retravaillé.',
  'Les décisions d''assortiment s''appuient sur la marge réelle.', 'trending-up', '["food","overhead"]', 8
FROM landing_modules WHERE slug = 'fournisseurs';

-- ── Cuisine (cuisine)
INSERT INTO landing_modules (slug, repo, ref, groupe, icone, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid,
  leviers, liens, onboarding, modele_ia)
VALUES (
  'cuisine', 'samsam2703MFC/pwa_kitchen', 'main', 'Terrain', 'chef-hat', 5, '1',
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
  '["xp","food","labour"]',
  '[{"slug":"console-franchise","sens":"recoit","quoi":"les commandes du jour et le stock"},{"slug":"fournisseurs","sens":"recoit","quoi":"les recettes et les fiches techniques"},{"slug":"livraison","sens":"envoie","quoi":"ce qui est prêt à charger"}]',
  'Installable depuis le navigateur, sans informatique sur place. L''équipe voit ce qu''il y a à produire et coche ses contrôles ; chaque case porte un nom et une heure.',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'production', 'Production du jour',
  'Ce qu''il y a à faire aujourd''hui, avec l''avancement par tâche : à faire, en cours, terminé. Le tableau de bord ouvre sur cet état, pas sur un menu.',
  'L''équipe voit l''essentiel en déverrouillant l''écran.', 'chef-hat', '["labour","food"]', 1
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'checklists', 'Checklists de poste',
  'Les contrôles d''ouverture, de service et de fermeture cochés dans l''app, horodatés et attribués.',
  'Ce qui a été fait est prouvable sans classeur.', 'clipboard-check', '["xp"]', 2
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'fiches', 'Produits et recettes',
  'La base de connaissances de la cuisine : fiche produit, recette, fiche technique. Le même contenu que celui tenu par le fournisseur, consulté au poste de travail.',
  'Une recette nouvelle arrive au poste sans réimpression.', 'file-text', '["xp","food"]', 3
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'commandes', 'Commandes à produire',
  'Les commandes qui concernent la cuisine, avec leur détail. La cuisine travaille sur la commande réelle du client, pas sur une recopie.',
  'Une erreur de recopie en moins entre le client et le four.', 'package', '["labour"]', 4
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'clients', 'Clients servis',
  'Qui est livré, avec quelles particularités. Utile quand une commande B2B revient chaque semaine avec ses contraintes.',
  'Les habitudes d''un client régulier ne se redécouvrent pas.', 'users', '["recurrence"]', 5
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'reclamations', 'Réclamations',
  'Un problème constaté en production se déclare sur place, avec son motif. Il part vers le fournisseur ou le siège au lieu de rester dans un carnet.',
  'Le défaut remonte le jour où il est vu.', 'triangle-alert', '["xp"]', 6
FROM landing_modules WHERE slug = 'cuisine';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'hors-ligne', 'Installable et hors ligne',
  'L''app s''installe sur le téléphone ou la tablette de la cuisine depuis le navigateur, sans boutique d''applications ni intervention IT, et supporte les coupures réseau du magasin.',
  'Déployer un magasin de plus ne demande aucune informatique sur place.', 'smartphone', '["overhead"]', 7
FROM landing_modules WHERE slug = 'cuisine';

-- ── Panel consultant (consultant)
INSERT INTO landing_modules (slug, repo, ref, groupe, icone, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid,
  leviers, liens, onboarding, modele_ia)
VALUES (
  'consultant', 'samsam2703MFC/pwa_consultant', 'main', 'Terrain', 'clipboard-check', 6, '1',
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
  '["trafic","recurrence","xp","food","labour","overhead"]',
  '[{"slug":"console-marque","sens":"envoie","quoi":"les visites notées et les leviers à travailler"},{"slug":"console-franchise","sens":"recoit","quoi":"les chiffres du magasin visité"}]',
  'L''outil de l''animateur réseau. Il prépare sa visite, la passe checklist par checklist, et repart avec un compte rendu déjà écrit. Les 6 leviers sont l''ossature de la conversation avec le franchisé.',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'agenda', 'Agenda des visites',
  'Les visites planifiées par point de vente, préparées avant de partir et retrouvées sur place. L''animateur sait ce qu''il va voir et ce qu''il a laissé ouvert la dernière fois.',
  'Rien ne se perd entre deux passages.', 'calendar', '["overhead"]', 1
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'checklists', 'Checklists de visite notées',
  'Chaque tâche du magasin est vérifiée, notée et commentée, et la revue porte le nom de son auteur et son horodatage.',
  'Le contrôle devient démontrable, pas déclaratif.', 'clipboard-check', '["xp"]', 2
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'objectifs', 'Objectifs, tendances et leviers',
  'Les cibles par indicateur et par magasin, la tendance sur la période, et les leviers identifiés pour la corriger.',
  'La discussion avec le franchisé porte sur des chiffres.', 'trending-up', '["trafic","recurrence"]', 3
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'reclamations', 'Réclamations matériel',
  'Ce qui est cassé ou manquant se déclare pendant la visite, sur plusieurs magasins d''un coup quand le même problème revient dans le réseau.',
  'Un défaut de série se traite en une fois.', 'triangle-alert', '["overhead"]', 4
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'rapports', 'Comptes rendus de visite',
  'Le compte rendu se construit à partir de ce qui a été vérifié sur place, et se valide côté propriétaire.',
  'Personne ne retape la visite le soir.', 'file-text', '["labour"]', 5
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'notes', 'Notes de terrain',
  'Les remarques prises au passage, rattachées au magasin et retrouvées à la visite suivante — plutôt qu''un carnet qui reste dans la voiture.',
  'La mémoire du magasin survit au changement d''animateur.', 'pencil', '["xp"]', 6
FROM landing_modules WHERE slug = 'consultant';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'kiosque', 'Installable et plein écran',
  'L''app s''installe depuis le navigateur et s''ouvre sans barre d''adresse. Sur un écran fixe en magasin, elle se lance en mode kiosque.',
  'Un poste de plus se met en service en quelques minutes.', 'smartphone', '["overhead"]', 7
FROM landing_modules WHERE slug = 'consultant';

-- ── Tournées de livraison (livraison)
INSERT INTO landing_modules (slug, repo, ref, groupe, icone, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid,
  leviers, liens, onboarding, modele_ia)
VALUES (
  'livraison', 'samsam2703MFC/pwa_delivery', 'main', 'Approvisionnement', 'truck', 7, '1',
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
  '["xp","labour","overhead"]',
  '[{"slug":"console-franchise","sens":"recoit","quoi":"la tournée assignée et le bon préparé"},{"slug":"console-franchise","sens":"envoie","quoi":"les preuves datées et les incidents codifiés"}]',
  'Une tablette au dépôt, une session par tournée. Le double scan bloque un départ incomplet et chaque point de livraison laisse une preuve datée. Fonctionne sans réseau.',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'tournee', 'Tournée du jour',
  'La tournée assignée s''ouvre avec ses chiffres : colis à livrer, points de passage, heure de départ et ETA de fin. L''ordre de passage est figé, il ne se réordonne pas en cours de route.',
  'Le magasin et le client savent quand la livraison passe.', 'map-pin', '["xp","labour"]', 1
FROM landing_modules WHERE slug = 'livraison';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'chargement', 'Chargement en double scan',
  'Le chauffeur scanne ce qu''il embarque, l''app le confronte au bon préparé par le magasin. Les manquants sont listés par client et le départ reste bloqué tant que l''emport est incomplet.',
  'L''erreur se corrige au dépôt, pas chez le client.', 'package', '["food","labour"]', 2
FROM landing_modules WHERE slug = 'livraison';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'livraison', 'Preuve de livraison',
  'À chaque point : dépôt scanné, photo géolocalisée, puis un QR qui tourne et que le client scanne pour confirmer. Repli sur code PIN, signature ou photo seule.',
  'Un litige se tranche sur une preuve datée.', 'clipboard-check', '["xp"]', 3
FROM landing_modules WHERE slug = 'livraison';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'incident', 'Incidents codifiés',
  'Client absent, adresse fermée, colis abîmé : le chauffeur choisit un motif dans une liste fermée, décide de la suite et joint la preuve.',
  'Le siège lit des motifs comparables entre tournées.', 'triangle-alert', '["xp","overhead"]', 4
FROM landing_modules WHERE slug = 'livraison';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'hors-ligne', 'Hors ligne par défaut',
  'La tournée entière tient dans la tablette. Sans réseau, le chauffeur continue à scanner, photographier et clôturer ; les écritures partent à la reconnexion, dans l''ordre, sans doublon.',
  'La zone blanche n''interrompt plus la tournée.', 'refresh-cw', '["labour"]', 5
FROM landing_modules WHERE slug = 'livraison';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'contrat', 'Salarié ou sous-traitant',
  'Le même écran sert les deux statuts : le chauffeur salarié voit son pointage de service, le sous-traitant ne l''a pas. Le type de contrat est porté par la session.',
  'Une seule application à maintenir pour les deux modèles.', 'users', '["overhead","labour"]', 6
FROM landing_modules WHERE slug = 'livraison';

-- ── Régie d'affichage (affichage)
INSERT INTO landing_modules (slug, repo, ref, groupe, icone, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid,
  leviers, liens, onboarding, modele_ia)
VALUES (
  'affichage', 'samsam2703MFC/signage', 'main', 'Vente', 'monitor', 8, '1',
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
  '["trafic","recurrence","xp"]',
  '[{"slug":"console-marque","sens":"recoit","quoi":"le catalogue, les tarifs et les campagnes"}]',
  'Vos écrans cessent d''être un montage vidéo. Le film se construit sur la base produits, se planifie par tranche horaire, et chaque écran remonte ce qu''il affiche vraiment.',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'compositeur', 'Compositeur de film',
  'La bibliothèque d''éléments — catégories, liaisons, promos — et la playlist qui en fait un film. Mise en page, mouvement, filigrane et jetons dynamiques se règlent élément par élément.',
  'Un montage vidéo de moins à sous-traiter.', 'layers', '["trafic"]', 1
FROM landing_modules WHERE slug = 'affichage';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'produits', 'Produits et tarifs affichés',
  'Les listes de prix à l''écran sont liées à la table produits, pas retapées. Un changement de prix se propage au prochain film.',
  'Le prix vu par le client est celui de la caisse.', 'book-open', '["trafic","food"]', 2
FROM landing_modules WHERE slug = 'affichage';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'campagnes', 'Campagnes et promotions',
  'Les opérations commerciales sont taguées en campagne : on active une campagne et tous les éléments qui la portent basculent d''un coup, sur les écrans choisis.',
  'Une opération nationale démarre partout le même matin.', 'bell', '["trafic","recurrence"]', 3
FROM landing_modules WHERE slug = 'affichage';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'planning', 'Périodes et planning de diffusion',
  'Le petit-déjeuner, le service du midi et le goûter n''affichent pas la même chose. Les périodes décrivent ces plages et le planning dit quel film passe quand.',
  'L''écran vend ce qui est disponible à cette heure-là.', 'calendar', '["trafic"]', 4
FROM landing_modules WHERE slug = 'affichage';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'reseau', 'Réseau et supervision des écrans',
  'Chaque écran est un player authentifié par jeton qui envoie un battement de cœur et une capture. La supervision montre magasin par magasin ce qui est réellement affiché.',
  'Un écran décroché se voit le jour même.', 'monitor', '["overhead"]', 5
FROM landing_modules WHERE slug = 'affichage';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'film', 'Visionneuse publique',
  'La dernière playlist publiée est consultable en plein écran sans connexion, à l''adresse /film.',
  'Le responsable vérifie l''affichage depuis son téléphone.', 'smartphone', '["xp"]', 6
FROM landing_modules WHERE slug = 'affichage';

-- ── Recrutement de franchisés (recrutement)
INSERT INTO landing_modules (slug, repo, ref, groupe, icone, ordre, actif, nom, accroche, resume,
  description, public_cible, problemes, benefices, stack, mots_cles, mermaid,
  leviers, liens, onboarding, modele_ia)
VALUES (
  'recrutement', 'samsam2703MFC/atelier-espace-candidat', 'main', 'Développement', 'handshake', 9, '1',
  'Recrutement de franchisés',
  'Du premier clic sur l''annonce à la signature, un seul dossier suivi.',
  'Recruter un franchisé prend six à dix-huit mois et passe par une trentaine d''échanges. Ce module tient les quatre faces de ce parcours au même endroit : la page publique qui capte les candidatures, le CRM qui suit les étapes, l''espace où le candidat avance seul, et la vue du propriétaire qui dit ce que tout cela coûte.',
  'Le recrutement de franchisés est le processus le plus mal outillé des réseaux, et le plus déterminant : c''est lui qui décide qui portera l''enseigne pendant dix ans. Dans la plupart des réseaux il vit dans une boîte mail, un tableur et la mémoire d''un consultant. Quand ce consultant part, la moitié des dossiers en cours devient illisible.

Ce module part du constat qu''un candidat traverse quatre surfaces, et qu''elles doivent raconter la même chose. La page publique présente l''enseigne, ses emplacements disponibles et son formulaire. Le CRM suit le dossier étape par étape, avec les documents attendus à chaque étape. L''espace candidat laisse la personne avancer seule — lire, regarder, simuler son financement, réserver un rendez-vous — sans mobiliser un consultant pour chaque question. Et la vue du propriétaire dit, en lecture seule, combien de candidats sont dans le tuyau, où ils bloquent, et ce que coûte une signature.

La liaison entre les quatre est l''adresse e-mail. Un envoi du formulaire crée d''un coup la trace brute du lead, le compte du portail candidat et la fiche CRM à l''étape « dossier reçu ». Aucune ressaisie, et surtout aucun candidat qui existe dans un outil mais pas dans l''autre.

Le parcours candidat n''est pas figé dans le code : les étapes, leur ordre, leur caractère bloquant, les documents qu''elles exigent et l''e-mail qu''elles déclenchent se paramètrent. Un réseau qui change sa méthode de recrutement change son paramétrage, pas son logiciel — et c''est précisément ce qui rend la méthode transmissible à un nouveau directeur du développement.

Les emplacements sont une table unique servie aux trois fronts : ils alimentent la liste déroulante du formulaire, les épingles de la carte publique et le carrousel d''opportunités du portail candidat. Une zone ouverte au recrutement se déclare une fois.',
  'Direction du développement, consultants recrutement, candidats franchisés',
  '[{"titre":"Le dossier vit dans une boîte mail","texte":"Les pièces d''un candidat sont éparpillées entre des mails, un dossier partagé et la mémoire du consultant. Personne d''autre ne peut reprendre le dossier, et le réseau ne sait pas dire où en est un candidat sans appeler quelqu''un."},{"titre":"Le candidat attend, et se refroidit","texte":"Entre deux rendez-vous, un candidat n''a rien à faire ni rien à lire. Le délai devient un signal négatif : celui qui abandonne au troisième mois est souvent celui qui n''avait simplement plus de nouvelles."},{"titre":"La méthode de recrutement ne se transmet pas","texte":"Les étapes, les questions à poser, les documents à réclamer sont dans la tête du recruteur. Un départ, et le réseau réapprend son propre processus — au moment précis où il voudrait accélérer son développement."},{"titre":"Le coût d''une signature est inconnu","texte":"Salons, publicité, temps consultant, primes : les dépenses de recrutement sont réelles mais jamais rapportées au nombre de signatures. Le réseau investit sans savoir ce qu''il paie pour un franchisé."}]',
  '[{"titre":"Un candidat, un dossier, quatre vues","texte":"La page publique, le CRM, l''espace candidat et la vue du propriétaire lisent la même donnée, reliée par l''adresse e-mail. Le formulaire crée les trois enregistrements d''un coup."},{"titre":"Le candidat avance sans vous","texte":"Vidéothèque, documents à lire, carte des emplacements, simulateur de financement, créneaux de rendez-vous : entre deux échanges, il progresse seul et vous le voyez progresser."},{"titre":"Le parcours est un paramétrage","texte":"Étapes, ordre, caractère bloquant, documents exigés et e-mail déclenché se règlent dans l''interface. La méthode du réseau est écrite quelque part, donc reprenable."},{"titre":"Le coût par signature est un chiffre","texte":"Fixe, primes, publicité, foires et campagnes sont additionnés et rapportés aux candidats et aux signatures. Le développement se pilote comme le reste du réseau."},{"titre":"Les documents se génèrent et se relisent","texte":"Publipostage à partir de modèles à variables, annexes fixes, signature électronique, puis lecture assistée des pièces reçues avec synthèse et alertes."}]',
  '["React","PHP","MySQL","Vite"]',
  '["recrutement franchisé","CRM","espace candidat","parcours","DIP","signature électronique"]',
  'flowchart TD
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
  N --> D',
  '["overhead","xp","trafic"]',
  '[{"slug":"console-marque","sens":"envoie","quoi":"le franchisé signé et sa zone, prêts à devenir un point de vente"},{"slug":"console-marque","sens":"recoit","quoi":"les emplacements ciblés par l''analyse géographique du réseau"},{"slug":"consultant","sens":"envoie","quoi":"le nouveau franchisé à accompagner sur ses premières visites"}]',
  'C''est ici qu''un réseau grandit. Le candidat entre par l''annonce, avance seul entre deux rendez-vous, et vous voyez à tout moment où il en est et ce qu''il vous coûte. Rien de tout cela ne dépend plus de la mémoire d''un recruteur.',
  'contenu-initial'
);
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'landing', 'Page franchise publique',
  'La page qui présente l''enseigne aux candidats : carrousels photos et vidéos, carte des emplacements, formulaire de contact. Tout son contenu vient de la base — aucune ligne à modifier pour changer une diapositive.',
  'Le développement publie son annonce sans passer par un développeur.', 'monitor', '["trafic"]', 1
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'leads', 'Candidatures entrantes',
  'Chaque envoi du formulaire est archivé tel quel, et crée en même temps le compte du portail et la fiche CRM. La trace brute n''est jamais effacée : c''est la sauvegarde de secours des candidatures.',
  'Aucune candidature ne se perd entre deux outils.', 'users', '["trafic","overhead"]', 2
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'parcours', 'Étapes du parcours',
  'Les étapes du recrutement, leur ordre, celles qui bloquent la suite, les documents qu''elles réclament et l''e-mail qu''elles déclenchent. Le processus du réseau est décrit ici, pas dans une note de service.',
  'La méthode de recrutement survit au départ du recruteur.', 'clipboard-check', '["overhead"]', 3
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'candidats', 'Fiches candidats',
  'Le dossier de chaque candidat : coordonnées, zone visée, étape courante, notes privées ou partagées, documents reçus par étape, motif de clôture.',
  'N''importe quel consultant reprend un dossier en trois minutes.', 'search', '["overhead"]', 4
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'emplacements', 'Emplacements et zones',
  'Une seule table sert les trois fronts : la liste déroulante du formulaire, les épingles de la carte publique et le carrousel d''opportunités du portail. Boutique existante, zone disponible ou zone ciblée sont distinguées.',
  'Une zone ouverte au recrutement se déclare une seule fois.', 'map-pin', '["trafic","overhead"]', 5
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'publipostage', 'Publipostage et contrats',
  'Des modèles de documents à variables — DIP, contrat, bail — remplis avec les données du candidat, avec leurs annexes PDF fixes. Le document part complet du premier coup.',
  'Une heure de mise en forme par dossier en moins.', 'book-open', '["overhead"]', 6
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'signature', 'Signature électronique',
  'Envoi à signer, relance et retour du document signé rattaché à l''étape. Le statut de signature est visible dans le dossier, pas dans la boîte mail de quelqu''un.',
  'Le délai de signature cesse d''être un angle mort.', 'clipboard-check', '["overhead","xp"]', 7
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'lecture-ia', 'Lecture assistée des documents',
  'Les pièces reçues sont analysées : synthèse, champs extraits, alertes sur ce qui manque ou détonne. Le consultant relit une synthèse au lieu de trente pages.',
  'Les pièces d''un dossier se contrôlent en quelques minutes.', 'search', '["overhead"]', 8
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'lexique', 'Lexique documentaire',
  'La bibliothèque des types de documents du réseau — ce qu''est un DIP, ce que contient un contrat, quelle pièce sert à quoi — organisée et consultable par les consultants.',
  'Un consultant qui arrive sait quoi demander, et pourquoi.', 'layers', '["overhead"]', 9
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'rdv', 'Rendez-vous et Google Calendar',
  'Les rendez-vous du parcours, leur lieu, leur statut, et leur synchronisation avec l''agenda du consultant. Le candidat réserve depuis son espace, le consultant les voit dans son calendrier.',
  'Plus d''aller-retour de dix messages pour caler une date.', 'calendar', '["overhead","xp"]', 10
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'messagerie', 'Messagerie intégrée',
  'Les e-mails envoyés et reçus sont journalisés dans le dossier du candidat, avec les modèles automatiques — dont l''accusé de réception sous 48 heures.',
  'L''historique de la relation est dans le dossier, pas dans une boîte personnelle.', 'bell', '["xp","overhead"]', 11
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'espace-candidat', 'Espace candidat',
  'Le portail du candidat, en deux niveaux : découverte à l''inscription, puis accès complet une fois le dossier validé. Ce que le candidat peut voir dépend de son avancement, pas d''un envoi manuel.',
  'Le candidat a quelque chose à faire entre deux rendez-vous.', 'smartphone', '["xp"]', 12
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'journey', 'Parcours en 8 étapes',
  'Le suivi visuel côté candidat : les huit étapes, la barre d''avancement, et surtout la prochaine action attendue de lui.',
  'Le candidat sait toujours ce qu''on attend de lui.', 'trending-up', '["xp"]', 13
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'videotheque', 'Vidéothèque et quiz',
  'Les vidéos de présentation du réseau, avec leur progression de visionnage, puis un quiz qui vérifie ce qui a été compris et débloque un badge.',
  'La présentation du concept ne repose plus sur une réunion.', 'monitor', '["xp"]', 14
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'badges', 'Collection de badges',
  'Neuf badges gagnés au fil du parcours. Un candidat engagé dans une collection est un candidat qui revient, et sa progression est un signal lisible pour le consultant.',
  'L''engagement du candidat devient mesurable.', 'bell', '["xp"]', 15
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'carte', 'Carte des emplacements',
  'La carte du territoire vue par le candidat : boutiques existantes, zones disponibles, zones ciblées, avec le détail de chaque emplacement et un carrousel des opportunités d''ouverture.',
  'Le candidat se projette sur un territoire réel, pas sur une promesse.', 'map-pin', '["xp","trafic"]', 16
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'investisseurs', 'Financement et investisseurs',
  'Les partenaires financiers du réseau et un simulateur d''apport et de mensualité. Le candidat teste son plan avant le premier rendez-vous bancaire.',
  'La question de l''argent se pose tôt, sur des chiffres.', 'credit-card', '["xp","overhead"]', 17
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'agenda', 'Créneaux réservables',
  'Les disponibilités du consultant groupées par jour, réservables depuis l''espace candidat, plus la journée découverte réservée aux dossiers validés.',
  'Le rendez-vous se prend quand le candidat y pense, pas trois jours plus tard.', 'clock', '["xp"]', 18
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'candidature', 'Dossier de candidature',
  'Le formulaire détaillé — apport, expérience, motivation, zone. Son envoi valide le dossier, débloque le niveau 2 du portail et bascule la fiche CRM.',
  'Le passage à l''étape suivante est déclenché par le candidat, pas relancé par vous.', 'clipboard-check', '["overhead","xp"]', 19
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'bilan', 'Bilan du propriétaire',
  'Une vue en lecture seule, sur téléphone : candidats actifs, en attente, signés, abandonnés, répartition par étape et par zone, motifs d''abandon, candidatures des 7 et 30 derniers jours.',
  'Le propriétaire suit son développement sans ouvrir le CRM.', 'bar-chart', '["overhead"]', 20
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'couts', 'Coût du recrutement',
  'Fixe, primes de signature, publicité, foires et salons, campagnes par prestataire — additionnés puis rapportés au nombre de candidats et de signatures.',
  'On sait enfin ce que coûte un franchisé recruté.', 'trending-up', '["overhead"]', 21
FROM landing_modules WHERE slug = 'recrutement';
INSERT INTO landing_fonctions (module_id, cle, nom, description, benefice, icone, leviers, ordre)
SELECT id, 'acces', 'Comptes et journal de connexion',
  'Les comptes consultants avec leur rôle, révocables, et le journal de chaque connexion, échec et déconnexion avec l''adresse et le navigateur.',
  'L''accès aux dossiers candidats est traçable.', 'settings', '["overhead"]', 22
FROM landing_modules WHERE slug = 'recrutement';

-- ── Page d'accueil
DELETE FROM landing_site;
INSERT INTO landing_site (titre, sous_titre, accroche, problemes, reponses, mermaid,
  cta_texte, cta_url, meta_description)
VALUES (
  'La valeur d''un réseau, c''est sa capacité à être transmis',
  'Un ERP qui met le savoir-faire dans l''outil plutôt que dans la tête de quelques personnes.',
  'Un réseau se vend sur ce qu''il peut transmettre. Tant que les procédures vivent dans la mémoire des fondateurs, dans des tableurs personnels et dans des habitudes prises en magasin, ce qui se transmet n''est qu''une enseigne et un bail. Le repreneur rachète un nom, pas une méthode.
Nos neuf modules couvrent l''exploitation réelle d''un réseau : le recrutement des franchisés, la vente en ligne, le pilotage du siège et du point de vente, l''approvisionnement, la production, l''animation terrain, la livraison et l''affichage. Chacun a la même exigence : ce qui est fait laisse une trace datée et attribuée, et ce qui est décidé est écrit quelque part d''autre que dans une conversation.',
  '[{"titre":"L''exécution en magasin est invisible","texte":"Le siège apprend qu''un standard n''est pas tenu quand un client se plaint, ou lors d''une visite. Entre les deux, personne ne sait. L''écart entre deux points de vente se creuse sans que rien ne le signale."},{"titre":"L''information remonte tard et déformée","texte":"Les chiffres arrivent par tableur en fin de mois, recopiés au moins deux fois. Quand ils arrivent, le trimestre est joué et la discussion porte sur la fiabilité du fichier plutôt que sur la décision à prendre."},{"titre":"Les procédures ne survivent pas au départ","texte":"Le savoir-faire tient dans quelques personnes. Un responsable qui part emporte le tour de main, la mémoire des clients difficiles et les raisons derrière chaque règle. Le successeur réapprend au prix d''une saison."},{"titre":"Chaque outil raconte une histoire différente","texte":"Le site annonce un stock, la cuisine en connaît un autre, le chauffeur découvre le troisième. La ressaisie entre ces mondes coûte des heures et introduit les erreurs qu''on passe ensuite à corriger."},{"titre":"« Vérifié » ne prouve rien","texte":"Une case cochée sans nom ni horodatage ne démontre rien — ni à un franchisé, ni à un contrôle, ni à un repreneur. Le réseau ne peut pas prouver que ses standards existent ailleurs que dans son discours."}]',
  '[{"titre":"Le terrain saisit là où il travaille","texte":"Les applications de la cuisine, de l''animateur et du chauffeur sont installables depuis un navigateur et fonctionnent hors ligne. La donnée naît au poste de travail, une seule fois, au moment où le geste est fait."},{"titre":"Chaque contrôle porte un nom et une heure","texte":"Checklists de poste, checklists de visite notées, preuve de livraison géolocalisée : ce qui est vérifié est attribué et daté. Un standard devient démontrable, donc transmissible."},{"titre":"Un seul référentiel produit","texte":"Le catalogue du siège alimente le webshop, les consoles franchisées et les écrans en magasin. Un prix se change une fois. Le stock du jour vu en cuisine est celui que le site consulte avant d''accepter une commande."},{"titre":"La frontière siège–franchisé est un réglage","texte":"La fiche de chaque boutique dit ce qui est hérité du siège et ce que le franchisé pilote chez lui. La règle ne se renégocie pas à chaque changement de propriétaire."},{"titre":"Les incidents se comptent","texte":"Motifs codifiés, partagés entre l''application du chauffeur et la console du magasin. Un défaut récurrent devient un chiffre comparable entre boutiques, donc un sujet qu''on traite."}]',
  'flowchart LR
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
  G --> K',
  'Demander une démonstration', '#contact',
  'ERP pour réseaux de franchise : vente en ligne, pilotage, approvisionnement, production, animation terrain, livraison et affichage — huit modules en production.'
);

COMMIT;
