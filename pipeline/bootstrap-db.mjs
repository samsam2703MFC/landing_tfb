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
        // Le socle auquel ce module appartient — `franchise`, `franchiseur`,
        // ou vide pour une option. Les modules d'un socle ne se vendent pas
        // à l'unité : ils viennent avec lui, et son prix les couvre. C'est
        // une donnée, pas une liste en dur, pour qu'un module puisse passer
        // d'un socle aux options sans redéploiement.
        ['socle', t.chaine(20)],
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
        // Le modèle de base, avant toute option. Le socle franchisé se
        // facture par point de vente — `nombre_postes` lui sert de quantité ;
        // le socle franchiseur est une ligne unique pour le réseau.
        //
        // `socle_pos` tranche entre notre caisse et l'intégration de celle
        // que le réseau a déjà : c'est un choix, pas deux modules.
        ['socle_franchise', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['socle_franchiseur', `${t.booleen} DEFAULT ${pg ? 'FALSE' : '0'}`],
        ['socle_pos', `${t.chaine(10)} DEFAULT 'pos'`],
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
        ['prix_socle_franchise_cents', 'INT DEFAULT 0'],
        ['prix_socle_franchiseur_cents', 'INT DEFAULT 0'],
        // Les deux tarifs que les socles remplacent. Conservés parce que les
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
        // prestation · formation · socle_franchise · socle_franchiseur ·
        // module · poste · poste_franchiseur · onboarding_poste · vue ·
        // achat · maintenance
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
