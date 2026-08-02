#!/usr/bin/env node
/**
 * Création et mise à niveau des tables du site.
 *
 * Idempotent à deux niveaux : la table est créée si elle manque, et les
 * colonnes absentes d'une table déjà en place sont ajoutées. Sans ce second
 * niveau, `CREATE TABLE IF NOT EXISTS` ne fait rien sur une table existante et
 * une évolution du schéma passe silencieusement à la trappe.
 *
 * Les tables portent le préfixe DB_PREFIX (`landing_` par défaut) pour
 * cohabiter avec le reste de la base sans collision de noms.
 *
 * Usage : node bootstrap-db.mjs
 */

import { estPostgres, ouvrir, table } from './lib/db.mjs';

/** Types par dialecte : c'est tout ce qui change entre MySQL et PostgreSQL. */
function types(pg) {
  return {
    id: pg ? 'SERIAL PRIMARY KEY' : 'INT AUTO_INCREMENT PRIMARY KEY',
    texte: 'TEXT',
    chaine: (n = 255) => `VARCHAR(${n})`,
    objet: pg ? 'JSONB' : 'JSON',
    booleen: pg ? 'BOOLEAN' : 'TINYINT(1)',
    horodatage: pg ? 'TIMESTAMPTZ' : 'DATETIME',
    vrai: pg ? 'TRUE' : '1',
    // Un secret chiffré. Jamais du texte : on ne veut pas qu'un dump
    // s'ouvre dans un éditeur et montre quelque chose qui ressemble à
    // du base64 qu'on aurait envie de décoder.
    binaire: pg ? 'BYTEA' : 'VARBINARY(512)',
    // Un montant, jamais un flottant. Quatre décimales parce qu'un prix
    // unitaire hors taxes peut en demander trois, et qu'arrondir avant le
    // total fait perdre des centimes à l'échelle d'un réseau.
    montant: 'DECIMAL(14,4)',
    quantite: 'DECIMAL(12,3)',
  };
}

/**
 * Le modèle, colonne par colonne — la forme structurée permet d'engendrer
 * aussi bien le CREATE TABLE que les ALTER TABLE de rattrapage.
 */
function modele(pg) {
  const t = types(pg);
  return [
    {
      nom: table('modules'),
      colonnes: [
        ['id', t.id],
        ['slug', `${t.chaine(120)} NOT NULL UNIQUE`],
        ['repo', t.chaine(255)],
        ['ref', t.chaine(120)],
        ['groupe', t.chaine(120)],
        // L'icône du module dans le catalogue et le graphe de flux.
        ['icone', t.chaine(60)],
        ['ordre', 'INT DEFAULT 100'],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        ['nom', t.chaine(255)],
        ['accroche', t.texte],
        ['resume', t.texte],
        ['description', t.texte],
        ['public_cible', t.chaine(255)],
        ['problemes', t.objet],
        ['benefices', t.objet],
        ['stack', t.objet],
        ['mots_cles', t.objet],
        ['mermaid', t.texte],
        // Les 6 leviers HEXm que le module actionne, et les modules avec
        // lesquels il échange — la matière de la page d'onboarding.
        ['leviers', t.objet],
        ['liens', t.objet],
        ['onboarding', t.texte],
        // Le pack auquel ce module appartient, ou vide s'il se vend seul.
        // Un module empaqueté ne se facture pas à l'unité : il vient avec son
        // pack, et le prix du pack le couvre.
        ['pack', t.chaine(60)],
        // Prix du module, par mois, quand il est vendu dans une offre.
        // Zéro veut dire « le prix par défaut de la grille » : on ne recopie
        // pas 49 € treize fois pour devoir les changer treize fois.
        ['prix_cents', 'INT DEFAULT 0'],
        // Flux de validation : tout contenu produit par le pipeline arrive
        // en « nouveau » et attend une relecture dans la console.
        ['statut', `${t.chaine(20)} DEFAULT 'valide'`],
        // Empreinte de la fiche du dépôt : c'est elle qui dit si le contenu a
        // bougé depuis la dernière écriture, et donc s'il faut le représenter
        // à la relecture.
        ['empreinte', t.chaine(64)],
        ['commit_sha', t.chaine(64)],
        ['modele_ia', t.chaine(120)],
        ['genere_le', t.horodatage],
      ],
    },
    {
      nom: table('fonctions'),
      colonnes: [
        ['id', t.id],
        ['module_id', 'INT NOT NULL'],
        ['cle', `${t.chaine(120)} NOT NULL`],
        ['nom', t.chaine(255)],
        ['description', t.texte],
        ['benefice', t.texte],
        ['icone', t.chaine(60)],
        ['leviers', t.objet],
        ['ordre', 'INT DEFAULT 100'],
        // Un composant « nouveau » reste hors ligne : le commutateur est
        // verrouillé tant que la relecture n'a pas eu lieu.
        ['statut', `${t.chaine(20)} DEFAULT 'valide'`],
        ['en_ligne', `${t.booleen} DEFAULT ${t.vrai}`],
      ],
    },
    {
      nom: table('captures'),
      colonnes: [
        ['id', t.id],
        ['module_id', 'INT NOT NULL'],
        ['fonction_cle', t.chaine(120)],
        ['fichier', `${t.chaine(255)} NOT NULL`],
        ['titre', t.chaine(255)],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Les questions de l'onboarding : ce que le franchiseur coche pour
      // voir son système s'assembler. `slugs` porte les modules déclenchés.
      nom: table('questions'),
      colonnes: [
        ['id', t.id],
        ['cle', `${t.chaine(60)} NOT NULL UNIQUE`],
        ['tag', t.chaine(20)],
        ['texte', t.texte],
        ['cible', t.chaine(120)],
        ['slugs', t.objet],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Le discours éditorial des pages : chapeaux de section, libellés de
      // bouton, phrases d'accompagnement. Tout ce qui était écrit en dur dans
      // les gabarits vit ici, et se modifie dans la console.
      nom: table('textes'),
      colonnes: [
        ['id', t.id],
        ['cle', `${t.chaine(120)} NOT NULL UNIQUE`],
        ['valeur', t.texte],
        ['section', t.chaine(60)],
        ['aide', t.chaine(255)],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Les traductions, toutes tables confondues.
      //
      // Le français reste dans les colonnes d'origine : c'est la langue de
      // référence et le repli. Une traduction est une surcharge, désignée par
      // la table visée, la ligne, le champ et la langue. Rien à migrer, et une
      // langue qu'on abandonne se supprime d'une requête.
      //
      // `source` garde le français au moment de la traduction : quand le texte
      // français change, la traduction devient périmée et la console peut le
      // dire au lieu d'afficher en silence une phrase qui ne correspond plus.
      nom: table('traductions'),
      colonnes: [
        ['id', t.id],
        ['langue', `${t.chaine(5)} NOT NULL`],
        ['entite', `${t.chaine(20)} NOT NULL`],
        ['ligne_id', 'INT NOT NULL'],
        ['champ', `${t.chaine(40)} NOT NULL`],
        ['valeur', t.texte],
        ['source', t.texte],
      ],
    },
    {
      // Les demandes de démonstration reçues par le formulaire de contact.
      nom: table('leads'),
      colonnes: [
        ['id', t.id],
        ['nom', t.chaine(160)],
        ['reseau', t.chaine(200)],
        ['email', t.chaine(200)],
        ['situation', t.texte],
        ['source', t.chaine(80)],
        ['traite', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['recu_le', t.horodatage],
      ],
    },
    {
      // Les réseaux affichés sur la landing. Vide, le bandeau ne s'affiche
      // pas — mieux vaut rien que des noms inventés.
      nom: table('clients'),
      colonnes: [
        ['id', t.id],
        ['nom', `${t.chaine(160)} NOT NULL`],
        ['note', t.chaine(255)],
        // Le logo vit en base, en base64, et non dans `public/`.
        //
        // Le dossier `public/` est figé au build : un fichier déposé depuis la
        // console n'y survivrait pas au déploiement suivant. Les captures s'en
        // accommodent parce qu'elles arrivent par le pipeline, avant le build ;
        // un logo téléversé à la main, non. Une poignée de logos de quelques
        // dizaines de kilo-octets ne pèse rien face à la garantie qu'ils sont
        // sauvegardés avec le reste du contenu.
        ['logo', t.texte],
        ['logo_type', t.chaine(40)],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Les langues prévues. `part` dit où en est la traduction ; tant
      // qu'elle n'est pas faite, la langue reste non publiée.
      nom: table('langues'),
      colonnes: [
        ['id', t.id],
        ['code', `${t.chaine(8)} NOT NULL UNIQUE`],
        ['nom', t.chaine(80)],
        ['rtl', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['defaut', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['publiee', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    // ── Onboarding commercial ────────────────────────────────────────────
    //
    // Cinq tables pour un seul métier : un commercial crée un prospect,
    // configure ce qu'il achète, et sort une offre chiffrée.
    //
    // Tous les montants sont des **entiers en centimes**. Un prix en flottant
    // finit par facturer 119,99999 € — sur un document commercial signé, ce
    // n'est pas une coquille, c'est un litige.
    {
      // Les comptes de la console. Une offre porte le nom de qui l'a faite :
      // un mot de passe partagé ne saurait pas le dire.
      nom: table('utilisateurs'),
      colonnes: [
        ['id', t.id],
        ['identifiant', `${t.chaine(160)} NOT NULL UNIQUE`],
        ['nom', t.chaine(160)],
        // scrypt, sel compris — voir lib/admin/session.mjs. Jamais en clair.
        ['empreinte', t.chaine(255)],
        ['role', `${t.chaine(20)} DEFAULT 'commercial'`],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        ['cree_le', t.horodatage],
        ['vu_le', t.horodatage],
      ],
    },
    {
      // Le client démarché. Distinct de `clients`, qui est la vitrine des
      // réseaux affichés sur la page d'accueil : confondre les deux mettrait
      // un prospect en cours de négociation sur le site public.
      nom: table('prospects'),
      colonnes: [
        ['id', t.id],
        ['raison_sociale', `${t.chaine(200)} NOT NULL`],
        ['tva', t.chaine(20)],
        ['adresse', t.texte],
        ['pays', t.chaine(2)],
        ['site_web', t.chaine(255)],
        ['contact_nom', t.chaine(160)],
        ['contact_role', t.chaine(120)],
        ['contact_email', t.chaine(200)],
        ['contact_tel', t.chaine(40)],
        // ── Le dossier, au-delà du contact ────────────────────────────────
        //
        // Ce qu'il faut pour signer et facturer, et qu'on ne demande pas au
        // premier rendez-vous. Tout est facultatif en base : c'est au moment
        // d'éditer un contrat qu'on refuse d'avancer sans, et l'écran dit
        // alors précisément ce qui manque. Bloquer plus tôt ferait fuir un
        // prospect qu'on n'a pas encore convaincu.
        ['forme_juridique', t.chaine(80)],
        ['numero_registre', t.chaine(60)],
        ['adresse_siege', t.texte],
        // Qui signe, et de quel droit. « Gérant » ou « administrateur
        // délégué » ne se devine pas d'un prénom, et un contrat signé par
        // quelqu'un sans pouvoir n'engage personne.
        ['signataire_nom', t.chaine(160)],
        ['signataire_role', t.chaine(120)],
        ['signataire_email', t.chaine(200)],
        ['signataire_pouvoir', t.chaine(200)],
        // La facturation, qui n'est pas toujours à la même adresse que le
        // siège — franchiseur au centre, comptabilité ailleurs.
        ['facturation_adresse', t.texte],
        ['facturation_email', t.chaine(200)],
        ['iban', t.chaine(40)],
        ['bic', t.chaine(20)],
        ['delai_paiement_jours', 'INT DEFAULT 30'],
        // Ce que l'ingestion des ventes a besoin de savoir du réseau.
        //
        // La devise sert de garde-fou : une caisse qui renvoie des ventes
        // dans une autre devise que celle du réseau est refusée plutôt que
        // silencieusement additionnée. Le fuseau et la coupure de journée se
        // reprennent sur chaque boutique, qui peut les redéfinir.
        ['devise', `${t.chaine(3)} DEFAULT 'EUR'`],
        ['fuseau', `${t.chaine(60)} DEFAULT 'Europe/Brussels'`],
        ['mandat_sepa', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        // La demande de démonstration d'où vient le prospect, s'il en vient
        // une : de quoi éviter la ressaisie et garder le fil.
        ['lead_id', 'INT'],
        ['cree_par', 'INT'],
        ['cree_le', t.horodatage],
      ],
    },
    {
      nom: table('offres'),
      colonnes: [
        ['id', t.id],
        ['prospect_id', 'INT NOT NULL'],
        ['reference', `${t.chaine(40)} NOT NULL`],
        ['version', 'INT DEFAULT 1'],
        // brouillon · envoyee · acceptee · refusee · expiree
        ['statut', `${t.chaine(20)} DEFAULT 'brouillon'`],
        ['langue', `${t.chaine(5)} DEFAULT 'fr'`],
        ['devise', `${t.chaine(3)} DEFAULT 'EUR'`],
        ['cree_par', 'INT'],
        ['cree_le', t.horodatage],
        ['valide_jusqu_au', t.horodatage],
        ['envoyee_le', t.horodatage],
        // Remise : `pourcent` en centièmes de point (7,5 % = 750),
        // `fixe` en centimes. Deux unités dans une colonne, mais le type est
        // juste à côté et l'alternative serait deux colonnes dont une vide.
        ['remise_type', `${t.chaine(10)} DEFAULT 'pourcent'`],
        ['remise_valeur', 'INT DEFAULT 0'],
        // TVA en centièmes de point : 21 % = 2100.
        ['tva_taux', 'INT DEFAULT 2100'],
        ['tva_exoneree', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['tva_mention', t.chaine(255)],
        // aucune · par_vue · achat
        ['option_app', `${t.chaine(10)} DEFAULT 'aucune'`],
        // La formation se vend au jour, à part des prestations d'onboarding :
        // c'est le seul poste dont la quantité se négocie en fin d'entretien.
        ['jours_formation', 'INT DEFAULT 0'],
        // Les postes, en trois quantités distinctes parce qu'ils ne se
        // facturent pas pareil : les magasins ouverts et le siège au mois,
        // l'onboarding une seule fois.
        //
        // `postes_onboardes` est un sous-ensemble des postes équipés : on
        // n'onboarde pas forcément tout le réseau d'un coup.
        ['nombre_postes', 'INT DEFAULT 0'],
        ['postes_franchiseur', 'INT DEFAULT 0'],
        ['postes_onboardes', 'INT DEFAULT 0'],
        // Les packs retenus, recopiés avec leur prix et leur unité du jour —
        // même règle que les modules : une grille qui bouge ne doit pas
        // changer le montant d'une offre déjà chiffrée.
        //
        // `socle_pos` tranche entre notre caisse et l'intégration de celle
        // que le réseau a déjà : c'est un choix, pas deux modules.
        ['packs', t.objet],
        ['socle_pos', `${t.chaine(10)} DEFAULT 'pos'`],
        // Le suivi commercial : à quelle étape, depuis quand, et quand la
        // dernière relance est partie — sans cette date, une offre oubliée
        // relancerait le commercial tous les jours.
        ['etape', t.chaine(60)],
        ['etape_le', t.horodatage],
        ['relance_le', t.horodatage],
        // Le geste commercial : les N premiers mois ne sont pas facturés. Ce
        // n'est pas une remise — le prix mensuel ne bouge pas — donc ça ne
        // passe pas par les colonnes de remise.
        ['mois_offerts', 'INT DEFAULT 0'],
        // La configuration choisie, dont les lignes de devis sont calculées.
        //
        // Les prestations y sont recopiées **avec leur prix du jour** — même
        // règle que les tarifs : une remise de catalogue le mois prochain ne
        // doit pas changer le montant d'une offre déjà faite. Les vues y
        // restent même quand l'option est l'achat ferme, où elles ne
        // produisent pas de ligne : basculer d'une formule à l'autre ne doit
        // pas faire perdre au commercial ce qu'il vient de saisir.
        ['prestations', t.objet],
        ['modules', t.objet],
        ['vues', t.objet],
        // Les tarifs sont RECOPIÉS ici à la création. Une offre envoyée à
        // 1 000 € la vue ne doit pas changer de montant parce qu'un admin a
        // modifié le paramètre le lendemain.
        ['prix_par_vue_cents', 'INT DEFAULT 0'],
        ['multiplicateur_achat', 'INT DEFAULT 0'],
        ['taux_annuel', 'INT DEFAULT 0'],
        ['prix_jour_formation_cents', 'INT DEFAULT 0'],
        // Les deux tarifs que les packs remplacent. Conservés parce que les
        // offres déjà chiffrées les portent : les effacer changerait leurs
        // montants, ce qu'une offre envoyée ne doit jamais faire.
        ['prix_poste_cents', 'INT DEFAULT 0'],
        ['prix_poste_franchiseur_cents', 'INT DEFAULT 0'],
        ['prix_onboarding_poste_cents', 'INT DEFAULT 0'],
        ['prix_module_cents', 'INT DEFAULT 0'],
        ['portee', t.texte],
        ['delai', t.chaine(255)],
      ],
    },
    {
      // Une ligne du devis. `recurrence` est ce qui sépare les 120 000 € payés
      // une fois des 5 000 € payés tous les mois — la confusion des deux est
      // la seule façon de vendre à perte.
      nom: table('offre_lignes'),
      colonnes: [
        ['id', t.id],
        ['offre_id', 'INT NOT NULL'],
        // prestation · formation · pack · module · poste ·
        // poste_franchiseur · onboarding_poste · vue · achat · maintenance
        ['type', `${t.chaine(20)} NOT NULL`],
        ['libelle', t.chaine(255)],
        ['note', t.texte],
        ['quantite', 'INT DEFAULT 1'],
        ['prix_unitaire_cents', 'INT DEFAULT 0'],
        // unique · mensuel · annuel
        ['recurrence', `${t.chaine(10)} DEFAULT 'unique'`],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Le contrat né d'une offre acceptée.
      //
      // Son corps est **figé à la génération**, comme les lignes d'une offre :
      // un gabarit réécrit le mois prochain ne doit pas changer le texte de ce
      // qu'un client a signé. Rouvrir le contrat le régénère seulement tant
      // qu'il n'est pas parti.
      nom: table('contrats'),
      colonnes: [
        ['id', t.id],
        ['reference', `${t.chaine(40)} NOT NULL UNIQUE`],
        ['offre_id', 'INT NOT NULL'],
        ['prospect_id', 'INT NOT NULL'],
        // brouillon · envoye · signe · refuse · expire
        ['statut', `${t.chaine(20)} DEFAULT 'brouillon'`],
        ['corps', t.texte],
        ['genere_le', t.horodatage],
        ['envoye_le', t.horodatage],
        ['signe_le', t.horodatage],
        // Les conditions, recopiées des réglages du jour.
        ['date_effet', t.horodatage],
        ['duree_mois', 'INT DEFAULT 0'],
        ['preavis_jours', 'INT DEFAULT 0'],
        ['reconduction', t.chaine(120)],
        // La signature électronique : l'enveloppe chez le prestataire, son
        // état, et la dernière fois qu'on l'a demandé. Sans ces trois-là, on
        // ne saurait pas répondre à « où en est la signature ».
        ['signature_service', t.chaine(40)],
        ['signature_enveloppe', t.chaine(120)],
        ['signature_statut', t.chaine(40)],
        ['signature_maj_le', t.horodatage],
        ['cree_par', 'INT'],
      ],
    },
    {
      // Une pièce du dossier : ce qui se téléverse et qu'on doit pouvoir
      // ressortir. Stockée en base, comme les logos des réseaux clients :
      // elle survit ainsi au déploiement et part avec la sauvegarde.
      nom: table('pieces'),
      colonnes: [
        ['id', t.id],
        ['prospect_id', 'INT NOT NULL'],
        ['contrat_id', 'INT'],
        // contrat_signe · annexe · cgv · grille · identite · registre ·
        // assurance · licence · autre
        ['type', `${t.chaine(30)} NOT NULL`],
        ['nom', `${t.chaine(255)} NOT NULL`],
        ['type_mime', t.chaine(120)],
        ['taille', 'INT DEFAULT 0'],
        // En base64, comme les logos des réseaux : un seul type de colonne à
        // porter dans les deux dialectes, et un contenu qui se relit sans
        // pilote binaire. Le tiers de poids en plus est le prix de la
        // simplicité.
        ['contenu', t.texte],
        ['depose_le', t.horodatage],
        ['depose_par', 'INT'],
      ],
    },

    // ══════════════════════════════════════════════════════════════════════
    // Onboarding : brancher la caisse d'un client et lire ses ventes
    // ══════════════════════════════════════════════════════════════════════
    //
    // Le flux est **unidirectionnel et en lecture seule**. On lit des ventes
    // et le référentiel qui permet de les lire ; on n'écrit jamais rien dans
    // la caisse d'un client, et l'on n'ingère aucune donnée de son client
    // final. Tout le reste — indicateurs, leviers, food cost, objectifs — se
    // calcule chez nous à partir de ces seules lignes.
    {
      // Une capacité : une brique de donnée dont un module a besoin.
      //
      // C'est le pivot du moteur. Quatre modules qui demandent tous les
      // ventes ne font qu'une seule connexion à faire — c'est l'union
      // dédupliquée des capacités qui décide des étapes, pas le nombre de
      // modules cochés.
      nom: table('capacites'),
      colonnes: [
        ['id', t.id],
        ['cle', `${t.chaine(40)} NOT NULL UNIQUE`],
        ['libelle', t.chaine(160)],
        ['description', t.texte],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Ce dont un module a besoin pour fonctionner.
      //
      // `requis` faux veut dire « la fonctionnalité marche sans, en moins
      // bien » : `note_degradee` dit alors ce qu'on perd, et l'écran de
      // prérequis le montre au client plutôt que de le découvrir après coup.
      nom: table('module_capacites'),
      colonnes: [
        ['id', t.id],
        ['module_id', 'INT NOT NULL'],
        ['capacite_id', 'INT NOT NULL'],
        ['requis', `${t.booleen} DEFAULT ${t.vrai}`],
        ['note_degradee', t.texte],
      ],
    },
    {
      // Une source de données, décrite par son manifest.
      //
      // Le manifest porte tout : les champs du formulaire, les adresses
      // interrogées, la pagination, l'authentification, le mapping par
      // défaut. C'est ce qui permet d'ajouter une caisse **sans
      // redéploiement** — on insère une ligne, l'assistant sait afficher le
      // bon formulaire et tester la connexion.
      //
      // Le code n'est nécessaire que pour une API vraiment exotique : on
      // écrit alors un adaptateur qui implémente la même interface.
      nom: table('connecteurs'),
      colonnes: [
        ['id', t.id],
        ['cle', `${t.chaine(60)} NOT NULL UNIQUE`],
        ['nom', `${t.chaine(160)} NOT NULL`],
        ['type', `${t.chaine(20)} DEFAULT 'api'`],
        ['manifest', `${t.objet} NOT NULL`],
        ['version_manifest', 'INT DEFAULT 1'],
        ['logo', t.texte],
        ['logo_type', t.chaine(40)],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        ['beta', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // L'historique des manifests : un connecteur se corrige, et l'on veut
      // pouvoir dire avec quelle version une connexion a été configurée.
      nom: table('connecteur_versions'),
      colonnes: [
        ['id', t.id],
        ['connecteur_id', 'INT NOT NULL'],
        ['version', 'INT NOT NULL'],
        ['manifest', `${t.objet} NOT NULL`],
        ['note', t.texte],
        ['ecrit_le', t.horodatage],
        ['ecrit_par', 'INT'],
      ],
    },
    {
      nom: table('connecteur_capacites'),
      colonnes: [
        ['id', t.id],
        ['connecteur_id', 'INT NOT NULL'],
        ['capacite_id', 'INT NOT NULL'],
      ],
    },
    {
      // Une boutique du réseau, telle que le client la connaît.
      //
      // `coupure_jour` est le petit réglage qui évite le plus gros malentendu :
      // une vente à 01h30 appartient à la journée d'exploitation de la veille.
      // Réglable par boutique parce qu'un glacier ferme à 23h et un bar à 4h.
      nom: table('boutiques'),
      colonnes: [
        ['id', t.id],
        ['prospect_id', 'INT NOT NULL'],
        ['nom', `${t.chaine(200)} NOT NULL`],
        ['adresse', t.texte],
        ['fuseau', `${t.chaine(60)} DEFAULT 'Europe/Brussels'`],
        ['coupure_jour', 'INT DEFAULT 4'],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Une connexion : ce client, cette caisse, ces boutiques-là.
      //
      // Il y en a **plusieurs par client**. Un réseau qui a grandi par
      // rachats n'a pas la même caisse partout : quarante boutiques sur
      // quatre caisses font quatre connexions, pas quarante. Le groupement se
      // fait une fois, et ajouter une boutique ensuite, c'est la ranger dans
      // un groupe existant.
      //
      // `config` ne contient **que du non-secret**. Les clés vivent dans la
      // table d'à côté, chiffrées.
      nom: table('connexions'),
      colonnes: [
        ['id', t.id],
        ['prospect_id', 'INT NOT NULL'],
        ['connecteur_id', 'INT NOT NULL'],
        ['libelle', t.chaine(200)],
        // brouillon · test · active · erreur · pause
        ['statut', `${t.chaine(20)} DEFAULT 'brouillon'`],
        ['config', t.objet],
        ['version_manifest', 'INT DEFAULT 1'],
        ['dernier_test_le', t.horodatage],
        ['dernier_test', t.objet],
        ['derniere_sync_le', t.horodatage],
        ['dernier_curseur', t.chaine(255)],
        ['cree_par', 'INT'],
        ['cree_le', t.horodatage],
        ['maj_le', t.horodatage],
      ],
    },
    {
      // Un secret, et rien d'autre.
      //
      // Chiffré en AES-256-GCM, clé maître en variable d'environnement et
      // jamais en base. `version_cle` permet la rotation sans interruption :
      // on déchiffre avec l'ancienne, on rechiffre avec la nouvelle, ligne
      // par ligne. `quatre` sert au seul affichage autorisé — « ••••4f2a ».
      //
      // Aucune route ne relit un secret. Même un administrateur ne le revoit
      // pas : il le remplace.
      nom: table('connexion_secrets'),
      colonnes: [
        ['id', t.id],
        ['connexion_id', 'INT NOT NULL'],
        ['champ', `${t.chaine(60)} NOT NULL`],
        ['chiffre', `${t.binaire} NOT NULL`],
        ['iv', `${t.binaire} NOT NULL`],
        ['sceau', `${t.binaire} NOT NULL`],
        ['version_cle', 'INT DEFAULT 1'],
        ['quatre', t.chaine(8)],
        ['cree_le', t.horodatage],
        ['tourne_le', t.horodatage],
      ],
    },
    {
      // Les adresses réellement interrogées pour CE client.
      //
      // Recopiées du manifest à la création, puis modifiables par lui — c'est
      // le cas « une adresse pour les ventes, une autre pour le catalogue ».
      // Faire évoluer un manifest ne doit jamais écraser une connexion déjà
      // active : c'est pourquoi ces valeurs vivent ici et non dans le JSON du
      // connecteur.
      nom: table('connexion_points'),
      colonnes: [
        ['id', t.id],
        ['connexion_id', 'INT NOT NULL'],
        // ventes · produits · categories · boutiques
        ['genre', `${t.chaine(20)} NOT NULL`],
        ['methode', `${t.chaine(10)} DEFAULT 'GET'`],
        ['gabarit', `${t.chaine(500)} NOT NULL`],
        ['entetes', t.objet],
        ['pagination', t.objet],
        ['verifie', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
      ],
    },
    {
      // Le mapping : quel champ de la caisse alimente quel champ canonique.
      //
      // `confiance` dit d'où vient la proposition — trouvée par alias,
      // devinée, ou posée à la main. C'est ce qui permet à l'écran de
      // demander confirmation seulement là où il y a un doute.
      nom: table('connexion_correspondances'),
      colonnes: [
        ['id', t.id],
        ['connexion_id', 'INT NOT NULL'],
        ['cible', `${t.chaine(60)} NOT NULL`],
        ['source', t.chaine(255)],
        ['transform', t.objet],
        // auto · suggeree · manuelle
        ['confiance', `${t.chaine(20)} DEFAULT 'auto'`],
      ],
    },
    {
      // Le rapprochement des boutiques : celle de la caisse, la nôtre.
      //
      // `ignoree` est un choix explicite, pas un oubli. Un entrepôt qui
      // enregistre des sorties de stock fausserait le chiffre — mieux vaut
      // l'écarter sciemment que le découvrir dans trois mois.
      nom: table('boutique_correspondances'),
      colonnes: [
        ['id', t.id],
        ['connexion_id', 'INT NOT NULL'],
        ['externe_id', `${t.chaine(120)} NOT NULL`],
        ['externe_libelle', t.chaine(200)],
        ['boutique_id', 'INT'],
        ['ignoree', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
      ],
    },
    {
      // Le parcours de mise en route d'un client, reprenable.
      //
      // L'état vit en base et non dans le navigateur : fermer l'onglet à
      // l'étape 6 et revenir par le lien de reprise rend le même écran.
      nom: table('parcours'),
      colonnes: [
        ['id', t.id],
        ['prospect_id', 'INT NOT NULL'],
        // en_cours · termine · abandonne
        ['statut', `${t.chaine(20)} DEFAULT 'en_cours'`],
        ['etape_courante', t.chaine(60)],
        ['etat', t.objet],
        ['jeton_reprise', `${t.chaine(64)} UNIQUE`],
        ['debut_le', t.horodatage],
        ['fin_le', t.horodatage],
        ['activite_le', t.horodatage],
      ],
    },
    {
      // Une étape du parcours.
      //
      // `connexion_id` est vide pour les étapes du client (entreprise,
      // modules, prérequis) et renseigné pour celles qui se répètent par
      // caisse (configuration, test, mapping, boutiques, import, cohérence,
      // synchro). C'est ce qui fait du parcours une colonne par caisse plutôt
      // qu'une seule ligne.
      nom: table('parcours_etapes'),
      colonnes: [
        ['id', t.id],
        ['parcours_id', 'INT NOT NULL'],
        ['connexion_id', 'INT'],
        ['cle', `${t.chaine(60)} NOT NULL`],
        ['ordre', 'INT DEFAULT 100'],
        // attente · courante · faite · sautee · bloquee
        ['statut', `${t.chaine(20)} DEFAULT 'attente'`],
        ['charge', t.objet],
        ['fait_le', t.horodatage],
        ['fait_par', 'INT'],
      ],
    },
    {
      // Le journal du parcours : qui a fait quoi, et quand.
      //
      // C'est la première question qu'on se pose quand un chiffre change sans
      // raison — et la seule façon d'y répondre trois mois plus tard.
      nom: table('parcours_journal'),
      colonnes: [
        ['id', t.id],
        ['parcours_id', 'INT NOT NULL'],
        ['connexion_id', 'INT'],
        ['type', `${t.chaine(40)} NOT NULL`],
        ['texte', t.texte],
        ['detail', t.objet],
        ['quand', t.horodatage],
        ['utilisateur_id', 'INT'],
      ],
    },
    {
      // Une tâche de synchronisation, et son verrou.
      //
      // Pas de file d'attente : une table et un verrou en base. Le verrou est
      // une date d'expiration plutôt qu'un drapeau — un processus tué au
      // milieu ne laisse pas une tâche bloquée pour toujours.
      nom: table('sync_taches'),
      colonnes: [
        ['id', t.id],
        ['connexion_id', 'INT NOT NULL'],
        // reprise · incrementale · catalogue · reparation
        ['genre', `${t.chaine(20)} NOT NULL`],
        ['active', `${t.booleen} DEFAULT ${t.vrai}`],
        ['frequence_heures', 'INT DEFAULT 24'],
        ['heure_locale', 'INT DEFAULT 5'],
        // La fenêtre glissante relue à chaque passage : les caisses corrigent
        // et annulent des tickets après coup, et une synchro qui ne lirait que
        // le delta ne verrait jamais ces corrections.
        ['rattrapage_jours', 'INT DEFAULT 7'],
        ['plage_de', t.horodatage],
        ['plage_a', t.horodatage],
        ['prochain_le', t.horodatage],
        ['verrou_jusqu_a', t.horodatage],
        ['verrou_par', t.chaine(80)],
      ],
    },
    {
      // Un passage : ce qu'une exécution a lu, écrit, ignoré et rejeté.
      //
      // Les quatre compteurs sont le minimum pour répondre à « pourquoi
      // manque-t-il des ventes ». Une ligne rejetée n'est jamais perdue en
      // silence : elle part au rebut avec sa raison.
      nom: table('sync_passages'),
      colonnes: [
        ['id', t.id],
        ['tache_id', 'INT'],
        ['connexion_id', 'INT NOT NULL'],
        // file · en_cours · succes · partiel · echec
        ['statut', `${t.chaine(20)} DEFAULT 'file'`],
        ['debut_le', t.horodatage],
        ['fin_le', t.horodatage],
        ['plage_de', t.horodatage],
        ['plage_a', t.horodatage],
        ['curseur_de', t.chaine(255)],
        ['curseur_a', t.chaine(255)],
        ['lues', 'INT DEFAULT 0'],
        ['inserees', 'INT DEFAULT 0'],
        ['doublons', 'INT DEFAULT 0'],
        ['rejetees', 'INT DEFAULT 0'],
        ['code_erreur', t.chaine(40)],
        ['detail_erreur', t.objet],
      ],
    },
    {
      // Le rebut : ce qu'on n'a pas su lire, avec la raison.
      nom: table('sync_rebut'),
      colonnes: [
        ['id', t.id],
        ['connexion_id', 'INT NOT NULL'],
        ['passage_id', 'INT'],
        ['charge', t.objet],
        ['code_erreur', t.chaine(40)],
        ['detail', t.texte],
        ['essais', 'INT DEFAULT 0'],
        ['cree_le', t.horodatage],
      ],
    },
    {
      // La ligne telle que la caisse l'a rendue, sans retouche.
      //
      // On la garde pour pouvoir renormaliser sans réinterroger le POS le
      // jour où l'on corrige un mapping. `empreinte` est l'empreinte du
      // contenu canonicalisé : c'est elle qui rend un rejeu idempotent.
      //
      // Ce qui n'y entre jamais : les données personnelles du client final.
      // L'adaptateur les retire **avant** l'écriture, pas après.
      nom: table('ventes_brutes'),
      colonnes: [
        ['id', t.id],
        ['connexion_id', 'INT NOT NULL'],
        ['passage_id', 'INT'],
        ['charge', `${t.objet} NOT NULL`],
        ['empreinte', `${t.chaine(64)} NOT NULL`],
        ['recue_le', t.horodatage],
      ],
    },
    {
      // Le seul contrat que les modules du SaaS consomment.
      //
      // Tout adaptateur, quelle que soit la caisse, produit exactement ces
      // colonnes. C'est ce qui permet à un réseau de mélanger trois caisses
      // et de n'avoir qu'un seul tableau de bord.
      //
      // Pas de partitionnement en v1, et c'est un choix : MySQL exige que
      // toute clé unique contienne la colonne de partitionnement, ce qui
      // ferait entrer deux fois une vente dont la caisse corrige la date
      // après coup. L'idempotence vaut mieux que la partition tant que le
      // volume ne l'impose pas.
      nom: table('ventes'),
      colonnes: [
        ['id', t.id],
        ['prospect_id', 'INT NOT NULL'],
        ['connexion_id', 'INT NOT NULL'],
        ['boutique_id', 'INT'],
        ['externe_id', `${t.chaine(191)} NOT NULL`],
        ['commande_externe_id', t.chaine(191)],
        ['boutique_externe_id', t.chaine(120)],
        ['vendu_le', t.horodatage],
        // La journée d'exploitation, et non la date calendaire : une vente à
        // 01h30 compte pour la veille. C'est cette colonne que lisent tous
        // les indicateurs, jamais `vendu_le`.
        ['jour_exploitation', 'DATE'],
        ['heure', 'SMALLINT'],
        ['produit_externe_id', t.chaine(191)],
        ['produit_libelle', t.chaine(255)],
        ['categorie_externe_id', t.chaine(191)],
        ['categorie_libelle', t.chaine(255)],
        ['quantite', t.quantite],
        ['prix_unitaire_ht', t.montant],
        ['prix_unitaire_ttc', t.montant],
        ['taux_tva', 'DECIMAL(5,2)'],
        ['remise', t.montant],
        ['total_ht', t.montant],
        ['total_ttc', t.montant],
        ['devise', t.chaine(3)],
        ['moyen_paiement', t.chaine(60)],
        // sur_place · emporter · livraison · autre
        ['canal', t.chaine(20)],
        ['connecteur', t.chaine(60)],
        ['brute_id', 'INT'],
        ['recue_le', t.horodatage],
      ],
    },
    {
      nom: table('produits_ref'),
      colonnes: [
        ['id', t.id],
        ['prospect_id', 'INT NOT NULL'],
        ['connexion_id', 'INT NOT NULL'],
        ['externe_id', `${t.chaine(191)} NOT NULL`],
        ['libelle', t.chaine(255)],
        ['categorie_externe_id', t.chaine(191)],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        ['maj_le', t.horodatage],
      ],
    },
    {
      nom: table('categories_ref'),
      colonnes: [
        ['id', t.id],
        ['prospect_id', 'INT NOT NULL'],
        ['connexion_id', 'INT NOT NULL'],
        ['externe_id', `${t.chaine(191)} NOT NULL`],
        ['libelle', t.chaine(255)],
        ['parent_externe_id', t.chaine(191)],
        ['maj_le', t.horodatage],
      ],
    },
    {
      // Une étape du suivi commercial : où en est la négociation.
      //
      // Distincte du **statut** de l'offre, et c'est délibéré. Le statut est
      // technique — il décide si l'offre est encore modifiable — et ne prend
      // que cinq valeurs connues du code. L'étape est commerciale : elle
      // s'invente, se renomme et se réordonne dans la console sans qu'une
      // ligne change ici.
      nom: table('etapes'),
      colonnes: [
        ['id', t.id],
        ['cle', `${t.chaine(60)} NOT NULL UNIQUE`],
        ['nom', `${t.chaine(160)} NOT NULL`],
        ['description', t.texte],
        ['ordre', 'INT DEFAULT 100'],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        // Le statut que l'étape entraîne.
        //
        // Étape et statut disent la même chose vue de deux endroits : l'étape
        // raconte où en est la négociation, le statut décide si l'offre se
        // modifie encore. Les tenir séparés obligeait à faire deux fois le
        // même geste, et à vivre avec les moments où ils se contredisent —
        // une offre « Gagnée » restée « brouillon ». Vide : l'étape ne touche
        // pas au statut, pour celles qui n'en impliquent aucun.
        ['statut', t.chaine(20)],
        // Le gabarit de courriel proposé à cette étape, et l'interrupteur qui
        // décide s'il est proposé du tout : une étape peut exister sans qu'on
        // écrive quoi que ce soit au client.
        ['gabarit_actif', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['gabarit_sujet', t.chaine(255)],
        ['gabarit_corps', t.texte],
        // La relance : au bout de combien de jours sans bouger, et faut-il
        // prévenir le commercial. Zéro jour = pas de relance, quelle que soit
        // la case — deux façons de dire non, mais aucune ne surprend.
        ['relance_active', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['relance_jours', 'INT DEFAULT 0'],
      ],
    },
    {
      // Le journal d'une offre : ce qui lui est arrivé, dans l'ordre.
      //
      // Une ligne par événement, jamais modifiée. C'est ce qui permet de
      // répondre à « où en est-on, et depuis quand » sans reconstituer
      // l'histoire de mémoire — et de savoir qui a fait quoi.
      nom: table('suivi'),
      colonnes: [
        ['id', t.id],
        ['offre_id', 'INT NOT NULL'],
        ['quand', t.horodatage],
        ['utilisateur_id', 'INT'],
        // etape · statut · courriel · note · relance
        ['type', `${t.chaine(20)} NOT NULL`],
        ['texte', t.texte],
      ],
    },
    {
      // Un pack : un groupe de modules qui se vend d'un bloc, à son prix.
      //
      // Deux d'entre eux forment le **modèle de base** que tout réseau prend
      // — le pack franchisé et le pack franchiseur ; les autres s'ajoutent.
      // La distinction est une donnée (`base`) et non une liste en dur : un
      // pack peut entrer dans le modèle de base ou en sortir sans toucher au
      // code.
      nom: table('packs'),
      colonnes: [
        ['id', t.id],
        ['cle', `${t.chaine(60)} NOT NULL UNIQUE`],
        ['nom', `${t.chaine(160)} NOT NULL`],
        ['description', t.texte],
        ['prix_cents', 'INT DEFAULT 0'],
        // `mois` — une ligne pour le réseau ; `poste_mois` — multiplié par le
        // nombre de points de vente. C'est toute la différence entre 199 € et
        // 99 € × douze magasins.
        ['unite', `${t.chaine(20)} DEFAULT 'mois'`],
        ['base', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Les modules d'onboarding vendables — Design, et les suivants.
      // Nom distinct de `modules`, qui désigne les modules ERP du catalogue
      // public : ce sont deux choses sans rapport.
      nom: table('prestations'),
      colonnes: [
        ['id', t.id],
        ['cle', `${t.chaine(60)} NOT NULL UNIQUE`],
        ['nom', `${t.chaine(160)} NOT NULL`],
        ['description', t.texte],
        ['prix_cents', 'INT DEFAULT 0'],
        ['actif', `${t.booleen} DEFAULT ${t.vrai}`],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      // Les paramètres de tarification, éditables dans la console. `type` dit
      // comment lire `valeur` : rien n'est deviné à l'affichage.
      nom: table('tarifs'),
      colonnes: [
        ['id', t.id],
        ['cle', `${t.chaine(60)} NOT NULL UNIQUE`],
        ['valeur', t.texte],
        // cents · entier · points · texte
        ['type', `${t.chaine(10)} DEFAULT 'texte'`],
        ['libelle', t.chaine(160)],
        ['aide', t.chaine(255)],
        ['ordre', 'INT DEFAULT 100'],
      ],
    },
    {
      nom: table('site'),
      colonnes: [
        ['id', t.id],
        ['titre', t.chaine(255)],
        ['sous_titre', t.chaine(255)],
        ['accroche', t.texte],
        ['problemes', t.objet],
        ['reponses', t.objet],
        ['mermaid', t.texte],
        ['cta_texte', t.chaine(120)],
        ['cta_url', t.chaine(255)],
        ['meta_description', t.texte],
        ['genere_le', t.horodatage],
      ],
    },
  ];
}

/** Index secondaires, créés séparément pour rester portables. */
const INDEX = [
  { suffixe: 'fonctions_module', table: 'fonctions', colonnes: 'module_id' },
  { suffixe: 'fonctions_cle', table: 'fonctions', colonnes: 'module_id, cle' },
  { suffixe: 'modules_actif', table: 'modules', colonnes: 'actif, ordre' },
  { suffixe: 'captures_module', table: 'captures', colonnes: 'module_id, ordre' },
  // Une page charge toutes les traductions d'une langue d'un coup.
  { suffixe: 'traductions_langue', table: 'traductions', colonnes: 'langue' },
  { suffixe: 'traductions_cle', table: 'traductions', colonnes: 'langue, entite, ligne_id, champ' },
  // La liste des offres se filtre par client, par statut et par commercial.
  { suffixe: 'offres_prospect', table: 'offres', colonnes: 'prospect_id' },
  { suffixe: 'offres_statut', table: 'offres', colonnes: 'statut' },
  { suffixe: 'offres_auteur', table: 'offres', colonnes: 'cree_par' },
  // Une référence porte plusieurs versions : c'est le couple qui est unique.
  { suffixe: 'offres_reference', table: 'offres', colonnes: 'reference, version', unique: true },
  { suffixe: 'lignes_offre', table: 'offre_lignes', colonnes: 'offre_id, ordre' },
  // Le journal se lit toujours par offre, du plus récent au plus ancien.
  { suffixe: 'suivi_offre', table: 'suivi', colonnes: 'offre_id, id' },
  { suffixe: 'contrats_offre', table: 'contrats', colonnes: 'offre_id' },
  { suffixe: 'contrats_statut', table: 'contrats', colonnes: 'statut' },
  { suffixe: 'pieces_prospect', table: 'pieces', colonnes: 'prospect_id, type' },
  // ── Onboarding ────────────────────────────────────────────────────────
  //
  // Les deux clés uniques qui portent toute l'idempotence : rejouer un import
  // deux fois ne doit jamais dupliquer une vente. Sans elles, une coupure
  // réseau au milieu d'une reprise d'historique double douze mois de chiffre.
  { suffixe: 'brutes_empreinte', table: 'ventes_brutes', colonnes: 'connexion_id, empreinte', unique: true },
  { suffixe: 'ventes_externe', table: 'ventes', colonnes: 'connexion_id, externe_id', unique: true },
  // Les trois lectures que font tous les indicateurs, toujours par journée
  // d'exploitation — jamais par date calendaire.
  { suffixe: 'ventes_jour', table: 'ventes', colonnes: 'prospect_id, jour_exploitation' },
  { suffixe: 'ventes_boutique', table: 'ventes', colonnes: 'prospect_id, boutique_id, jour_exploitation' },
  { suffixe: 'ventes_categorie', table: 'ventes', colonnes: 'prospect_id, categorie_externe_id, jour_exploitation' },
  { suffixe: 'ventes_connexion', table: 'ventes', colonnes: 'connexion_id, vendu_le' },
  { suffixe: 'produits_externe', table: 'produits_ref', colonnes: 'connexion_id, externe_id', unique: true },
  { suffixe: 'categories_externe', table: 'categories_ref', colonnes: 'connexion_id, externe_id', unique: true },
  { suffixe: 'connexions_prospect', table: 'connexions', colonnes: 'prospect_id' },
  { suffixe: 'connexions_statut', table: 'connexions', colonnes: 'statut' },
  { suffixe: 'secrets_connexion', table: 'connexion_secrets', colonnes: 'connexion_id, champ', unique: true },
  { suffixe: 'points_connexion', table: 'connexion_points', colonnes: 'connexion_id, genre', unique: true },
  { suffixe: 'corresp_connexion', table: 'connexion_correspondances', colonnes: 'connexion_id, cible', unique: true },
  { suffixe: 'boutiq_corresp', table: 'boutique_correspondances', colonnes: 'connexion_id, externe_id', unique: true },
  { suffixe: 'boutiques_prospect', table: 'boutiques', colonnes: 'prospect_id, ordre' },
  { suffixe: 'mod_capacites', table: 'module_capacites', colonnes: 'module_id, capacite_id', unique: true },
  { suffixe: 'conn_capacites', table: 'connecteur_capacites', colonnes: 'connecteur_id, capacite_id', unique: true },
  { suffixe: 'parcours_prospect', table: 'parcours', colonnes: 'prospect_id' },
  { suffixe: 'parcours_pas', table: 'parcours_etapes', colonnes: 'parcours_id, ordre' },
  { suffixe: 'parcours_jrn', table: 'parcours_journal', colonnes: 'parcours_id, id' },
  // Le cron réveille les tâches dues : c'est la seule requête qu'il fait.
  { suffixe: 'taches_dues', table: 'sync_taches', colonnes: 'active, prochain_le' },
  { suffixe: 'passages_conn', table: 'sync_passages', colonnes: 'connexion_id, id' },
  { suffixe: 'rebut_conn', table: 'sync_rebut', colonnes: 'connexion_id, id' },
  // Le script de relance balaie les offres par étape.
  { suffixe: 'offres_etape', table: 'offres', colonnes: 'etape' },
];

/** Colonnes réellement présentes, en minuscules. */
async function colonnesExistantes(db, pg, nomTable) {
  const lignes = await db.requete(
    pg
      ? 'SELECT column_name AS c FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ?'
      : 'SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
    [nomTable],
  );
  return new Set(lignes.map((l) => String(l.c ?? l.C).toLowerCase()));
}

/** MySQL ne connaît pas `CREATE INDEX IF NOT EXISTS` : on tolère le doublon. */
async function creerIndex(db, pg, index) {
  const nom = `idx_${table(index.suffixe)}`;
  const cible = table(index.table);
  const unique = index.unique ? 'UNIQUE ' : '';
  const sql = pg
    ? `CREATE ${unique}INDEX IF NOT EXISTS ${nom} ON ${cible} (${index.colonnes})`
    : `CREATE ${unique}INDEX ${nom} ON ${cible} (${index.colonnes})`;
  try {
    await db.executer(sql);
    console.log(`  + index ${nom}`);
  } catch (err) {
    if (!/duplicate key name|already exists/i.test(err.message)) throw err;
  }
}

async function principal() {
  const pg = estPostgres();
  console.log(`→ base ${process.env.DB_NAME} sur ${process.env.DB_HOST} (${pg ? 'PostgreSQL' : 'MySQL'})`);

  const db = await ouvrir();
  try {
    for (const def of modele(pg)) {
      const presentes = await colonnesExistantes(db, pg, def.nom);

      if (presentes.size === 0) {
        const corps = def.colonnes.map(([nom, type]) => `${nom} ${type}`).join(', ');
        await db.executer(`CREATE TABLE IF NOT EXISTS ${def.nom} (${corps})`);
        console.log(`✓ ${def.nom} créée (${def.colonnes.length} colonnes)`);
        continue;
      }

      // Table déjà là : on ne rattrape que ce qui manque. La clé primaire et
      // les contraintes d'unicité ne se rejouent pas en ALTER.
      const manquantes = def.colonnes.filter(([nom]) => !presentes.has(nom.toLowerCase()));
      if (manquantes.length === 0) {
        console.log(`• ${def.nom} à jour`);
        continue;
      }
      for (const [nom, type] of manquantes) {
        const propre = type.replace(/\s*(PRIMARY KEY|UNIQUE|AUTO_INCREMENT|NOT NULL)/gi, '').trim();
        await db.executer(`ALTER TABLE ${def.nom} ADD COLUMN ${nom} ${propre || 'TEXT'}`);
        console.log(`  + colonne ${def.nom}.${nom}`);
      }
    }

    for (const index of INDEX) await creerIndex(db, pg, index);

    // La table site ne contient qu'une ligne : on l'amorce si besoin.
    const lignes = await db.requete(`SELECT id FROM ${table('site')} LIMIT 1`);
    if (lignes.length === 0) {
      await db.executer(
        `INSERT INTO ${table('site')} (cta_texte, cta_url) VALUES (?, ?)`,
        ['Demander une démonstration', '#contact'],
      );
      console.log(`✓ ligne unique de ${table('site')} créée`);
    }

    console.log('\nSchéma à jour.');
  } finally {
    await db.fermer();
  }
}

/** Un refus d'accès est de loin l'erreur la plus fréquente : on donne la main. */
function conseil(message) {
  if (!/access denied|authentication failed|password/i.test(message)) return null;

  const base = process.env.DB_NAME || 'tfb_landing';
  const login = process.env.DB_LOGIN || 'tfb_landing';

  if (estPostgres()) {
    return [
      "Le compte n'existe pas ou le mot de passe ne correspond pas. Depuis psql en superutilisateur :",
      `  CREATE DATABASE ${base};`,
      `  CREATE USER ${login} WITH PASSWORD '<le DB_PASS du .env>';`,
      `  GRANT ALL PRIVILEGES ON DATABASE ${base} TO ${login};`,
    ].join('\n');
  }

  return [
    "Le compte n'existe pas ou le mot de passe ne correspond pas. Depuis mysql en root :",
    `  CREATE DATABASE IF NOT EXISTS \`${base}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    `  CREATE USER IF NOT EXISTS '${login}'@'localhost' IDENTIFIED BY '<le DB_PASS du .env>';`,
    `  GRANT ALL PRIVILEGES ON \`${base}\`.* TO '${login}'@'localhost';`,
    '  FLUSH PRIVILEGES;',
    "Sinon, corriger DB_LOGIN, DB_NAME ou DB_PASS dans infra/.env.",
  ].join('\n');
}

principal().catch((err) => {
  console.error(`\n✗ Bootstrap interrompu : ${err.message}`);
  const aide = conseil(err.message);
  if (aide) console.error(`\n${aide}`);
  process.exit(1);
});
