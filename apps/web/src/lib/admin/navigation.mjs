/**
 * La carte de la console : le rail, et les écrans qui s'y regroupent.
 *
 * Une seule déclaration pour deux choses qui doivent dire la même — le rail à
 * gauche, et les onglets en haut des écrans regroupés. Tenues séparément, elles
 * divergent au premier écran ajouté : le rail nomme un groupe que les onglets
 * ne connaissent pas, ou l'inverse, et l'un des deux ment sans que rien ne le
 * signale.
 *
 * ── Pourquoi regrouper ────────────────────────────────────────────────────
 *
 * Le rail portait trente entrées sur six rubriques, dont une sans titre qui
 * servait de fourre-tout : la charte d'un client y voisinait avec les endpoints
 * de l'API et les bases de données. Trente liens sur une hauteur d'écran, ça se
 * parcourt du regard sans rien trouver — et les entrées les plus ouvertes, les
 * clients et les demandes, étaient tout en bas.
 *
 * Cinq rubriques qui suivent le travail réel, une quinzaine d'entrées, et des
 * écrans à onglets. Ce qui disparaît du rail n'est pas supprimé : Prestations
 * vit sous « Modules et prix », à un clic et non à un scroll.
 *
 * ── Une rubrique peut être une chaîne ─────────────────────────────────────
 *
 * « Vendre » n'est pas une liste : on fait une offre, elle devient un contrat,
 * le contrat paie une commission. C'est un seul geste étalé dans le temps, et
 * l'aligner comme trois rubriques indépendantes cachait l'ordre — celui qu'on
 * a précisément besoin de connaître quand on ne connaît pas encore l'outil.
 * `chaine: true` fait numéroter les entrées et les relie d'un trait.
 *
 * ── La règle du regroupement ──────────────────────────────────────────────
 *
 * On ne regroupe que ce qui s'édite dans la même séance. « Tarifs, prestations,
 * étapes » vont ensemble parce qu'on les touche le même jour, en préparant une
 * grille. « Stripe » va avec « Société qui facture » parce que l'un porte la
 * clé de l'autre. En revanche « Modules » reste seul : c'est l'écran le plus
 * ouvert de la rubrique, et l'enterrer sous un onglet coûterait plus que la
 * ligne qu'il économise.
 *
 * Une entrée peut aussi « couvrir » des écrans qui ne sont pas ses onglets : la
 * fiche d'un client appartient au groupe Clients, mais elle porte déjà son
 * propre bandeau de six onglets et en empiler un second donnerait deux rangées
 * qui ne parlent pas de la même chose.
 *
 * ── Les droits ────────────────────────────────────────────────────────────
 *
 * Une rubrique, une entrée et un onglet ne s'affichent que si le rôle peut les
 * ouvrir. Une entrée de groupe pointe vers **le premier onglet permis**, jamais
 * vers le premier onglet déclaré : sans ça, un technique cliquerait sur un
 * groupe et tomberait sur un 403 alors qu'un autre de ses onglets lui est
 * ouvert. C'est un confort d'affichage et non une sécurité — le contrôle qui
 * compte est dans le middleware.
 */
import { cheminAutorise } from './session.mjs';

/**
 * Les écrans à onglets.
 *
 * `cle` sert au rail (l'entrée à surligner) ; chaque onglet garde la sienne,
 * celle que sa page passe déjà en `actif`. Aucune page n'a eu à changer de clé.
 */
export const SECTIONS = [
  {
    cle: 'reseau',
    libelle: 'Clients',
    icone: 'building-2',
    // Deux listes de clients, et c'était une de trop : tout client est un
    // réseau ou en fait partie. « Réseaux clients » ne désigne d'ailleurs pas
    // d'autres clients — c'est la bande de logos affichée sur la landing, donc
    // une **vitrine**, une propriété de ces clients-là et pas une population
    // séparée. Le nom seul entretenait la confusion ; l'onglet la lève.
    onglets: [
      { cle: 'fiches-clients', libelle: 'Les clients', href: '/admin/prospects' },
      { cle: 'clients', libelle: 'Vitrine landing', href: '/admin/clients' },
      // La charte **maison** — les défauts dont tout le monde hérite. Celle
      // d'un client vit sur sa fiche, en onglet ; l'ancienne entrée « Chartes »
      // du rail n'était plus qu'une seconde liste de clients par-dessus la
      // première, et la seule chose qu'elle portait en propre était ce
      // lien-ci, qui ne se trouve nulle part ailleurs.
      { cle: 'charte-maison', libelle: 'Charte maison', href: '/admin/charte/0' },
    ],
    // Les six écrans d'un client ont déjà leur bandeau. En empiler un second
    // au-dessus donnerait deux rangées d'onglets qui ne parlent pas de la même
    // chose. `couvre` surligne le rail sans rien afficher.
    couvre: ['fiche-client'],
  },
  {
    cle: 'contenu',
    libelle: 'Modules et prix',
    icone: 'layers',
    // Un composant est une entrée de menu d'un module : la liste à plat sert à
    // repérer les trous — sans levier, sans gain, sans capture — sur les cent
    // six d'un coup. C'est la même matière vue de deux hauteurs.
    //
    // La grille tarifaire les rejoint parce qu'elle les chiffre : le prix d'un
    // module se saisit sur le module, celui d'un poste ou d'une vue sur la
    // grille, et les deux se relisent ensemble ou pas du tout. Rangée sous
    // « Vendre », elle obligeait à changer de rubrique au milieu d'un geste.
    onglets: [
      { cle: 'modules', libelle: 'Modules', href: '/admin/modules' },
      { cle: 'composants', libelle: 'Composants', href: '/admin/composants' },
      { cle: 'tarifs', libelle: 'Tarifs', href: '/admin/tarifs' },
      { cle: 'prestations', libelle: 'Prestations', href: '/admin/prestations' },
    ],
  },
  {
    cle: 'contractuel',
    libelle: 'Contrats',
    icone: 'handshake',
    // Le contrat et le gabarit dont il sort. On ouvre le second en se
    // demandant pourquoi le premier dit ce qu'il dit — les tenir sur deux
    // entrées du rail, c'était les éloigner de la seule question qui les relie.
    onglets: [
      { cle: 'contrats', libelle: 'Les contrats', href: '/admin/contrats' },
      // Hors de `/admin/contrats`, qui est ouvert en sous-arbre au commercial :
      // ranger les gabarits dessous lui donnerait le droit de réécrire les
      // clauses, sans qu'aucune règle ne soit violée.
      { cle: 'gabarits', libelle: 'Gabarits', href: '/admin/gabarits' },
    ],
  },
  {
    cle: 'vente',
    libelle: 'Offres',
    icone: 'receipt',
    // Les étapes ne sont pas un écran de plus : elles décrivent le chemin
    // qu'une offre parcourt. Les régler à côté des offres qu'elles rangent,
    // plutôt qu'entre la grille tarifaire et les prestations.
    onglets: [
      { cle: 'offres', libelle: 'Les offres', href: '/admin/offres' },
      { cle: 'etapes', libelle: 'Étapes du pipeline', href: '/admin/etapes' },
    ],
  },
  {
    cle: 'acces',
    libelle: 'Applications et accès',
    icone: 'smartphone',
    // L'API, prise par ses trois bouts : qui appelle, ce qui est appelable,
    // et avec quoi. Aucun des trois ne se règle sans regarder les deux autres.
    onglets: [
      { cle: 'applications', libelle: 'Applications', href: '/admin/applications' },
      { cle: 'endpoints', libelle: 'Endpoints', href: '/admin/endpoints' },
      { cle: 'jetons', libelle: 'Jetons d’accès', href: '/admin/jetons' },
    ],
  },
  {
    cle: 'branchements',
    libelle: 'Connexions',
    icone: 'arrow-up-down',
    onglets: [
      { cle: 'connexions', libelle: 'Connexions', href: '/admin/connexions' },
      { cle: 'connecteurs', libelle: 'Connecteurs', href: '/admin/connecteurs' },
    ],
  },
  {
    cle: 'vitrine',
    libelle: 'Page d’accueil',
    icone: 'panels-top-left',
    // Tout ce qui se voit sur la landing sans être un module : la page, ses
    // images, ses six leviers, et le questionnaire qui la termine.
    onglets: [
      { cle: 'site', libelle: 'La page', href: '/admin/site' },
      { cle: 'captures', libelle: 'Captures', href: '/admin/captures' },
      { cle: 'leviers', libelle: 'Leviers', href: '/admin/leviers' },
      { cle: 'questions', libelle: 'Questionnaire', href: '/admin/questions' },
    ],
  },
  {
    cle: 'mots',
    libelle: 'Textes et langues',
    icone: 'languages',
    // Un texte, la langue dans laquelle il est écrit, et sa traduction : trois
    // écrans pour une seule question, et on faisait l'aller-retour à chaque
    // chaîne corrigée.
    onglets: [
      { cle: 'textes', libelle: 'Textes', href: '/admin/textes' },
      { cle: 'langues', libelle: 'Langues', href: '/admin/langues' },
      { cle: 'traductions', libelle: 'Traductions', href: '/admin/traductions' },
    ],
  },
  {
    cle: 'encaissement',
    libelle: 'Facturation TFB',
    icone: 'credit-card',
    // L'entité qui facture porte la clé Stripe qui encaisse. Les séparer
    // faisait chercher dans « Système » pourquoi un paiement ne passe pas,
    // alors que la réponse est sur la société.
    onglets: [
      { cle: 'societe', libelle: 'Société qui facture', href: '/admin/societe' },
      { cle: 'stripe', libelle: 'Stripe', href: '/admin/stripe' },
    ],
  },
];

const PAR_CLE = new Map(SECTIONS.map((s) => [s.cle, s]));
const SECTION_DE = new Map();
for (const s of SECTIONS) for (const o of s.onglets) SECTION_DE.set(o.cle, s);

/** La section qui contient cet écran, ou rien s'il vit seul. */
export function sectionDe(cleEcran) {
  return SECTION_DE.get(cleEcran) || null;
}

/**
 * Le rail, par rubrique.
 *
 * `compteurs` vient de la base : un rail qui annonce « Modules » sans dire
 * combien ne sert à rien. Une entrée sans compteur déclaré n'en affiche pas —
 * mieux vaut rien qu'un zéro qui ferait croire à une liste vide.
 */
export function rubriquesConsole(compteurs = {}) {
  const section = (cle, extra = {}) => {
    const s = PAR_CLE.get(cle);
    return { groupe: cle, libelle: s.libelle, icone: s.icone, onglets: s.onglets, couvre: s.couvre || [], ...extra };
  };

  return [
    {
      // Le tableau de bord n'appartient à aucune rubrique : c'est le point
      // d'entrée des trois rôles, et lui donner un titre créerait une rubrique
      // d'un seul lien.
      entrees: [
        { cle: 'accueil', href: '/admin', libelle: 'Tableau de bord', icone: 'layout-dashboard' },
      ],
    },
    {
      // En tête, parce que c'est là qu'on va en premier. Elle était en dernier,
      // donc sous la ligne de flottaison du rail : une entrée qu'il faut
      // chercher est une entrée qui n'existe pas.
      titre: 'Clients',
      entrees: [
        section('reseau', { compte: compteurs.prospects }),
        { cle: 'leads', href: '/admin/leads', libelle: 'Demandes', icone: 'mail', compte: compteurs.leads },
        { cle: 'onboarding', href: '/admin/onboarding', libelle: 'Mises en route', icone: 'play', compte: compteurs.parcours },
      ],
    },
    {
      // Une chaîne, et non une liste.
      //
      // Ces trois écrans sont un seul geste étalé dans le temps : on fait une
      // offre, elle devient un contrat, le contrat paie une commission. Les
      // aligner comme quatre rubriques indépendantes cachait l'ordre — et
      // l'ordre est ce qu'on a besoin de savoir quand on ne connaît pas
      // encore l'outil. Le rail les numérote et les relie.
      titre: 'Vendre',
      chaine: true,
      entrees: [
        section('vente', { compte: compteurs.offres }),
        section('contractuel', { compte: compteurs.contrats }),
        // L'alerte plutôt qu'un compte : le nombre de plans n'apprend rien,
        // alors qu'un commercial qui a signé sans plan ne se calcule pas — et
        // ne se verrait nulle part ailleurs.
        {
          cle: 'commissions', href: '/admin/commissions', libelle: 'Commissions', icone: 'wallet',
          alerte: compteurs.commissionsSansPlan > 0 ? compteurs.commissionsSansPlan : null,
        },
      ],
    },
    {
      titre: 'Plateforme',
      entrees: [
        section('contenu', {
          compte: compteurs.modules,
          alerte: compteurs.aValider > 0 ? compteurs.aValider : null,
        }),
        section('acces'),
        { cle: 'bases', href: '/admin/bases', libelle: 'Bases clientes', icone: 'store' },
        section('branchements', { compte: compteurs.connexions }),
      ],
    },
    {
      titre: 'Landing',
      entrees: [
        section('vitrine'),
        // Pas de compteur : un groupe de trois écrans n'a pas un nombre, il en
        // a trois, et en montrer un seul ferait lire le compte des langues
        // comme celui des textes.
        section('mots'),
      ],
    },
    {
      titre: 'Système',
      entrees: [
        { cle: 'utilisateurs', href: '/admin/utilisateurs', libelle: 'Comptes', icone: 'users' },
        section('encaissement'),
        { cle: 'sync', href: '/admin/sync', libelle: 'Sync GitHub', icone: 'arrow-up-down' },
        { cle: 'reglages', href: '/admin/reglages', libelle: 'Réglages', icone: 'settings' },
      ],
    },
  ];
}

/**
 * Le rail tel qu'un rôle le voit, avec l'entrée courante marquée.
 *
 * Trois choses s'y règlent, et chacune est un piège si on l'oublie :
 *
 *   1. une entrée de groupe pointe vers le **premier onglet permis** ;
 *   2. un groupe dont aucun onglet n'est permis disparaît, comme une entrée
 *      simple interdite ;
 *   3. un groupe est marqué courant dès que **l'un de ses onglets** l'est —
 *      sinon le rail se dépeuple dès qu'on ouvre un écran regroupé, et l'on ne
 *      sait plus où l'on est.
 */
export function railPour(role, actif, compteurs = {}) {
  return rubriquesConsole(compteurs)
    .map((r) => ({
      ...r,
      entrees: r.entrees
        .map((e) => {
          if (!e.onglets) {
            return cheminAutorise(e.href, role) ? { ...e, courant: e.cle === actif } : null;
          }
          const permis = e.onglets.filter((o) => cheminAutorise(o.href, role));
          if (permis.length === 0) return null;
          return {
            ...e,
            cle: e.groupe,
            // Les onglets rendus sont ceux que ce rôle peut ouvrir, et non la
            // déclaration entière. Le bandeau les refiltrait de son côté, donc
            // l'écran était juste — mais tout autre lecteur de cette structure
            // aurait cru le groupe plus large qu'il ne l'est pour ce rôle.
            onglets: permis,
            href: permis[0].href,
            // `couvre` : des écrans qui appartiennent au groupe sans être un de
            // ses onglets — la fiche d'un client, qui porte déjà son propre
            // bandeau. Ils surlignent le rail et n'affichent rien de plus.
            courant: permis.some((o) => o.cle === actif) || (e.couvre || []).includes(actif),
          };
        })
        .filter(Boolean),
    }))
    .filter((r) => r.entrees.length > 0);
}

/**
 * Les onglets d'un écran regroupé, tels que ce rôle les voit.
 *
 * Rien du tout si l'écran ne fait partie d'aucun groupe, ou s'il n'en reste
 * qu'un onglet une fois les droits appliqués : un bandeau d'un seul onglet
 * n'offre aucun déplacement et prend une ligne pour le dire.
 */
export function ongletsSection(cleEcran, role) {
  const s = sectionDe(cleEcran);
  if (!s) return null;
  const onglets = s.onglets.filter((o) => cheminAutorise(o.href, role));
  if (onglets.length < 2) return null;
  return { libelle: s.libelle, onglets };
}
