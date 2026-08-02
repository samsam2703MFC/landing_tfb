/**
 * Les valeurs de départ de l'onboarding : capacités, connecteurs, manifests.
 *
 * Rien ici n'est une constante du code. C'est semé la première fois, puis
 * modifiable dans la console — et surtout, **ajouter une caisse plus tard ne
 * demandera qu'une insertion en base**, pas un déploiement.
 */

/**
 * Les briques de donnée dont un module peut avoir besoin.
 *
 * Quatre pour la version 1, et pas une de plus. Le stock, les employés et les
 * commandes fournisseurs sont hors périmètre : les déclarer « au cas où »
 * ferait apparaître des étapes que rien ne sait remplir.
 */
export const CAPACITES = [
  {
    cle: 'ventes',
    libelle: 'Vos ventes',
    description: 'Les lignes de vente : date, produit, quantité, montant, boutique. Le socle de tout le reste.',
    ordre: 1,
  },
  {
    cle: 'produits',
    libelle: 'Votre catalogue produits',
    description: 'De quoi donner un nom aux lignes de vente, et suivre un produit dans le temps.',
    ordre: 2,
  },
  {
    cle: 'categories',
    libelle: 'Vos catégories',
    description: 'De quoi regrouper : viennoiserie, boissons, plats du jour.',
    ordre: 3,
  },
  {
    cle: 'boutiques',
    libelle: 'La liste de vos boutiques',
    description: 'Pour rapprocher les boutiques de votre caisse de celles que vous avez déclarées.',
    ordre: 4,
  },
];

/**
 * Ce dont chaque module de l'ERP a besoin.
 *
 * Écrit par slug de module : c'est le catalogue existant qu'on annote, pas un
 * second catalogue parallèle qui divergerait au premier ajout.
 *
 * `requis: false` veut dire « ça marche sans, en moins bien » — et la note dit
 * quoi. C'est ce que l'écran de prérequis montre au client, plutôt que de le
 * lui laisser découvrir après coup.
 */
export const BESOINS = [
  // Le pilotage : tout part des ventes.
  { module: 'console-marque', capacite: 'ventes', requis: true },
  { module: 'console-marque', capacite: 'boutiques', requis: true },
  { module: 'console-marque', capacite: 'categories', requis: false,
    note_degradee: 'Sans catégories, le réseau se lit boutique par boutique mais pas famille par famille.' },
  { module: 'console-franchise', capacite: 'ventes', requis: true },
  { module: 'console-franchise', capacite: 'produits', requis: true },

  // Le food cost : les ventes, et le catalogue pour les rattacher aux recettes.
  { module: 'recettes', capacite: 'ventes', requis: true },
  { module: 'recettes', capacite: 'produits', requis: true },

  // Les redevances se calculent sur le chiffre : rien d'autre n'est nécessaire.
  { module: 'redevances', capacite: 'ventes', requis: true },
  { module: 'redevances', capacite: 'boutiques', requis: true },

  // La facturation suit les redevances.
  { module: 'facturation', capacite: 'ventes', requis: true },

  // La caisse est la source, pas un consommateur : elle ne demande rien.
  // Le webshop non plus — il produit des ventes, il n'en lit pas.

  { module: 'affichage', capacite: 'ventes', requis: false,
    note_degradee: "Sans ventes, l'affichage montre le catalogue mais pas ce qui marche." },
  { module: 'affichage', capacite: 'produits', requis: true },

  { module: 'fournisseurs', capacite: 'produits', requis: true },
  { module: 'fournisseurs', capacite: 'ventes', requis: false,
    note_degradee: 'Sans ventes, pas de suggestion de commande fondée sur ce qui se vend.' },
];

/** La pagination la plus répandue : par numéro de page, éléments sous `data`. */
const PAGE = {
  mode: 'page',
  page_param: 'page',
  size_param: 'limit',
  size_default: 200,
  items_path: 'data',
  total_path: 'meta.total',
};

const SANS_PAGINATION = { mode: 'aucune', items_path: 'data' };

/**
 * Le mapping proposé par défaut.
 *
 * Une liste d'alias par champ canonique, essayés dans l'ordre. C'est ce qui
 * permet à l'écran de mapping d'arriver déjà rempli sur la plupart des caisses
 * — et de ne demander confirmation que là où il a hésité.
 */
const ALIAS = {
  externe_id: ['id', 'line_id', 'uuid', 'item_uuid'],
  commande_externe_id: ['order_id', 'receipt_id', 'ticket_id', 'transaction_id'],
  boutique_externe_id: ['location_id', 'store_id', 'shop_id', 'venue_id'],
  vendu_le: ['closed_at', 'created_at', 'date', 'timestamp', 'sold_at'],
  produit_externe_id: ['product_id', 'item_id', 'sku', 'article_id'],
  produit_libelle: ['product_name', 'name', 'label', 'title'],
  categorie_externe_id: ['category_id', 'group_id', 'family_id'],
  categorie_libelle: ['category_name', 'category', 'group_name'],
  quantite: ['quantity', 'qty', 'count'],
  prix_unitaire_ttc: ['unit_price', 'price', 'price_gross', 'unit_price_gross'],
  total_ttc: ['total', 'total_gross', 'gross_amount', 'amount'],
  total_ht: ['total_net', 'net_amount'],
  taux_tva: ['vat', 'tax_rate', 'vat_rate'],
  remise: ['discount', 'discount_amount'],
  devise: ['currency', 'currency_code'],
  moyen_paiement: ['payment_method', 'payment_type'],
  canal: ['order_type', 'channel', 'service_type', 'sale_type'],
};

export const CONNECTEURS = [
  {
    cle: 'generic_rest',
    nom: 'Autre caisse (API REST)',
    ordre: 90,
    capacites: ['ventes', 'produits', 'categories', 'boutiques'],
    manifest: {
      code: 'generic_rest',
      name: 'Autre caisse (API REST)',
      type: 'api',
      auth: { mode: 'bearer', modes: ['bearer', 'entete', 'basic', 'aucun'] },
      fields: [
        {
          code: 'base_url', type: 'url', required: true, group: 'connexion', order: 10,
          label: "Adresse de l'API",
          help: 'Fournie par votre prestataire caisse. Doit commencer par https://.',
          placeholder: 'https://api.ma-caisse.com/v1',
        },
        {
          code: 'api_key', type: 'secret', required: true, group: 'connexion', order: 20,
          label: 'Clé API',
          help: 'Demandez une clé en lecture seule : nous n’écrivons jamais dans votre caisse.',
        },
        {
          code: 'auth_header_name', type: 'string', required: false, group: 'avance', order: 30,
          label: "Nom de l'en-tête d'authentification", default: 'Authorization',
          help: 'À changer seulement si votre caisse attend la clé sous un autre nom.',
        },
        {
          code: 'org_id', type: 'string', required: false, group: 'connexion', order: 40,
          label: "Identifiant d'organisation",
          help: 'Certaines caisses en demandent un. Laissez vide si la vôtre n’en parle pas.',
        },
      ],
      endpoints: [
        { kind: 'ventes', required: true, method: 'GET', label: 'Ventes',
          path_template: '/sales?from={from}&to={to}&page={page}', pagination: PAGE },
        { kind: 'produits', required: true, method: 'GET', label: 'Produits',
          path_template: '/products?page={page}', pagination: PAGE },
        { kind: 'categories', required: true, method: 'GET', label: 'Catégories',
          path_template: '/categories', pagination: SANS_PAGINATION },
        { kind: 'boutiques', required: false, method: 'GET', label: 'Boutiques',
          path_template: '/locations', pagination: SANS_PAGINATION },
      ],
      alias: ALIAS,
      rate_limit: { par_minute: 120 },
    },
  },
  {
    cle: 'gopos',
    nom: 'GoPOS',
    ordre: 10,
    capacites: ['ventes', 'produits', 'categories', 'boutiques'],
    manifest: {
      code: 'gopos',
      name: 'GoPOS',
      type: 'api',
      auth: { mode: 'bearer' },
      fields: [
        {
          code: 'base_url', type: 'url', required: true, group: 'connexion', order: 10,
          label: "Adresse de l'API", default: 'https://api.gopos.pl/v3',
          help: 'Celle de votre installation. La valeur proposée est la plus courante.',
        },
        {
          code: 'api_key', type: 'secret', required: true, group: 'connexion', order: 20,
          label: 'Clé API',
          help: 'Dans votre back-office GoPOS, section Intégrations. Une clé en lecture suffit.',
        },
        {
          code: 'org_id', type: 'string', required: true, group: 'connexion', order: 30,
          label: "Identifiant d'organisation",
          help: 'En haut de votre back-office GoPOS, du type go_13410.',
          placeholder: 'go_13410',
        },
      ],
      endpoints: [
        { kind: 'ventes', required: true, method: 'GET', label: 'Ventes',
          path_template: '/organizations/{org_id}/sales?date_from={from}&date_to={to}&page={page}',
          pagination: { ...PAGE, items_path: 'data', total_path: 'meta.total' } },
        { kind: 'produits', required: true, method: 'GET', label: 'Produits',
          path_template: '/organizations/{org_id}/products?page={page}', pagination: PAGE },
        { kind: 'categories', required: true, method: 'GET', label: 'Catégories',
          path_template: '/organizations/{org_id}/product_categories', pagination: SANS_PAGINATION },
        { kind: 'boutiques', required: false, method: 'GET', label: 'Boutiques',
          path_template: '/organizations/{org_id}/venues', pagination: SANS_PAGINATION },
      ],
      alias: ALIAS,
      rate_limit: { par_minute: 60 },
      // Ce qu'on sait de GoPOS et qui se voit à l'écran de mapping : les prix
      // sont en centimes. La transformation est proposée, jamais imposée —
      // c'est au client de confirmer qu'un pain à 160 vaut bien 1,60 €.
      transforms_proposees: {
        prix_unitaire_ttc: { type: 'diviser', par: 100 },
        total_ttc: { type: 'diviser', par: 100 },
        total_ht: { type: 'diviser', par: 100 },
        remise: { type: 'diviser', par: 100 },
      },
    },
  },
];
