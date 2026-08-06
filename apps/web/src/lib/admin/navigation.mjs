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
 * Cinq rubriques qui suivent le travail réel, dix-neuf entrées, et cinq écrans
 * à onglets. Ce qui disparaît du rail n'est pas supprimé : Prestations vit
 * maintenant sous « Catalogue et prix », à un clic et non à un scroll.
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
    cle: 'catalogue',
    libelle: 'Catalogue et prix',
    icone: 'percent',
    // Ce qu'on prépare le même jour : la grille, ce qu'on y vend à la
    // prestation, et les étapes par lesquelles une offre passe.
    onglets: [
      { cle: 'tarifs', libelle: 'Tarifs', href: '/admin/tarifs' },
      { cle: 'prestations', libelle: 'Prestations', href: '/admin/prestations' },
      { cle: 'etapes', libelle: 'Étapes', href: '/admin/etapes' },
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
    return { groupe: cle, libelle: s.libelle, icone: s.icone, onglets: s.onglets, ...extra };
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
        { cle: 'fiches-clients', href: '/admin/prospects', libelle: 'Clients', icone: 'building-2', compte: compteurs.prospects },
        { cle: 'leads', href: '/admin/leads', libelle: 'Demandes', icone: 'mail', compte: compteurs.leads },
        { cle: 'onboarding', href: '/admin/onboarding', libelle: 'Mises en route', icone: 'play', compte: compteurs.parcours },
        { cle: 'charte', href: '/admin/charte', libelle: 'Chartes', icone: 'sparkles' },
      ],
    },
    {
      titre: 'Vendre',
      entrees: [
        { cle: 'offres', href: '/admin/offres', libelle: 'Offres', icone: 'receipt', compte: compteurs.offres },
        { cle: 'contrats', href: '/admin/contrats', libelle: 'Contrats', icone: 'handshake', compte: compteurs.contrats },
        // L'alerte plutôt qu'un compte : le nombre de plans n'apprend rien,
        // alors qu'un commercial qui a signé sans plan ne se calcule pas — et
        // ne se verrait nulle part ailleurs.
        {
          cle: 'commissions', href: '/admin/commissions', libelle: 'Commissions', icone: 'wallet',
          alerte: compteurs.commissionsSansPlan > 0 ? compteurs.commissionsSansPlan : null,
        },
        section('catalogue'),
      ],
    },
    {
      titre: 'Plateforme',
      entrees: [
        section('acces'),
        { cle: 'bases', href: '/admin/bases', libelle: 'Bases clientes', icone: 'store' },
        section('branchements', { compte: compteurs.connexions }),
      ],
    },
    {
      titre: 'Landing',
      entrees: [
        {
          cle: 'modules', href: '/admin/modules', libelle: 'Modules', icone: 'layers', compte: compteurs.modules,
          alerte: compteurs.aValider > 0 ? compteurs.aValider : null,
        },
        { cle: 'composants', href: '/admin/composants', libelle: 'Composants', icone: 'panels-top-left', compte: compteurs.fonctions },
        section('vitrine'),
        // Pas de compteur : un groupe de trois écrans n'a pas un nombre, il en
        // a trois, et en montrer un seul ferait lire le compte des langues
        // comme celui des textes.
        section('mots'),
        { cle: 'clients', href: '/admin/clients', libelle: 'Réseaux clients', icone: 'building', compte: compteurs.clients },
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
            href: permis[0].href,
            courant: permis.some((o) => o.cle === actif),
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
