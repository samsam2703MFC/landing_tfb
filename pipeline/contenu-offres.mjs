/**
 * Les valeurs de départ de la tarification commerciale.
 *
 * Rien de tout ceci n'est une constante du code : ce sont les valeurs semées
 * la première fois, ensuite modifiables dans la console sans redéploiement.
 * Le seed en mode « complète » (`--si-vide`) ne les réécrit jamais — un tarif
 * renégocié dans la console survit au déploiement suivant.
 *
 * Deux unités, et il faut les garder droites :
 *   · `cents` — un montant. 500 € s'écrit 50000.
 *   · `points` — un taux en centièmes de point. 5 % s'écrit 500, 21 % → 2100.
 * L'alternative — des flottants — finit par facturer 119,99999 €.
 */

import { CSS_COURRIEL } from '../apps/web/src/lib/offres/courriel.mjs';

export const TARIFS = [
  {
    cle: 'prix_par_vue',
    valeur: '100000',
    type: 'cents',
    libelle: 'Prix par vue et par mois',
    aide: "Location de l'application, option A. Sert aussi de base au calcul de l'achat.",
    ordre: 1,
  },
  {
    cle: 'multiplicateur_achat',
    valeur: '24',
    type: 'entier',
    libelle: "Multiplicateur d'achat, en mois",
    aide: "Achat ferme = prix mensuel × ce nombre. 24 = deux ans de location rachetés d'un coup.",
    ordre: 2,
  },
  {
    cle: 'taux_annuel',
    valeur: '500',
    type: 'points',
    libelle: 'Maintenance annuelle',
    aide: "Pourcentage du prix d'achat, facturé chaque année. 500 = 5 %.",
    ordre: 3,
  },
  {
    cle: 'prix_jour_formation',
    valeur: '50000',
    type: 'cents',
    libelle: 'Prix de la journée de formation',
    aide: 'Facturé au nombre de jours vendus, une seule fois.',
    ordre: 4,
  },
  {
    cle: 'prix_onboarding_poste',
    valeur: '150000',
    type: 'cents',
    libelle: "Onboarding d'un poste",
    aide: "Facturé une seule fois, pour chaque poste qu'on onboarde. Décrivez ce qu'il comprend dans le périmètre de l'offre.",
    ordre: 7,
  },
  {
    cle: 'prix_module',
    valeur: '4900',
    type: 'cents',
    libelle: "Prix d'un module, par mois",
    aide: "S'applique à tout module dont le prix propre vaut zéro. Un module peut avoir son propre prix depuis l'écran Modules.",
    ordre: 8,
  },
  {
    cle: 'tva_defaut',
    valeur: '2100',
    type: 'points',
    libelle: 'Taux de TVA par défaut',
    aide: 'Belgique : 2100 pour 21 %. Modifiable offre par offre.',
    ordre: 9,
  },
  {
    cle: 'validite_jours',
    valeur: '30',
    type: 'entier',
    libelle: "Durée de validité d'une offre, en jours",
    aide: 'Sert à proposer la date « valable jusqu’au » à la création.',
    ordre: 10,
  },
  {
    cle: 'mention_autoliquidation',
    valeur: 'Autoliquidation — TVA due par le preneur. À FAIRE VALIDER PAR VOTRE COMPTABLE.',
    type: 'texte',
    libelle: 'Mention en cas d’exonération',
    aide: "Imprimée sur l'offre quand la TVA est à zéro. Une exonération sans mention légale n'en est pas une — la formulation exacte et l'article cité dépendent de votre situation, faites-la valider.",
    ordre: 11,
  },
  {
    cle: 'courriel_sujet',
    valeur: 'Votre offre {reference} — The Franchise Buddy',
    type: 'texte',
    libelle: 'Sujet du courriel',
    aide: 'Jetons disponibles : {reference}, {client}, {commercial}, {valide_jusqu_au}.',
    ordre: 12,
  },
  {
    cle: 'courriel_corps',
    valeur: `Bonjour {contact},

Vous trouverez ci-dessous notre proposition pour {client}, valable jusqu'au {valide_jusqu_au}.

{recapitulatif}

Je reste à votre disposition pour en parler.

{commercial}
The Franchise Buddy`,
    type: 'texte',
    libelle: 'Corps du courriel',
    aide: 'Jetons : {contact}, {client}, {reference}, {commercial}, {valide_jusqu_au}, {recapitulatif}.',
    ordre: 13,
  },
  {
    cle: 'courriel_css',
    valeur: CSS_COURRIEL,
    type: 'texte',
    libelle: 'Feuille de style du courriel',
    aide: "Habille la version HTML de l'offre. Décorative : les largeurs et les marges sont posées dans le document, parce qu'un client de messagerie sur deux jette la feuille de style. Vider ce champ rend une lettre lisible, mais sans les couleurs de la marque.",
    ordre: 14,
  },
];

/**
 * Les modules d'onboarding vendables.
 *
 * Un seul pour l'instant, celui qui existe vraiment. En inventer d'autres
 * pour remplir l'écran donnerait un catalogue qu'aucun commercial ne peut
 * tenir devant un client — ils s'ajoutent dans la console au fur et à mesure
 * qu'ils existent.
 */
/**
 * Les packs : des modules qui se vendent d'un bloc, à leur propre prix.
 *
 * Un module empaqueté n'est pas une option — il vient avec son pack, et le
 * prix du pack le couvre. Les deux packs marqués `base` forment le modèle de
 * base que tout réseau prend ; les autres s'y ajoutent.
 *
 * `pos` est un cas à part : le pack franchisé prend **ou bien** notre caisse
 * **ou bien** l'intégration de celle que le réseau utilise déjà. C'est un
 * choix qui se fait sur l'offre, pas deux modules à cocher.
 *
 * Semé une seule fois. Ensuite tout — le prix, l'unité, la composition — se
 * règle dans la console, sans redéploiement.
 */
export const PACKS = [
  {
    cle: 'franchise',
    nom: 'Pack franchisé',
    description: 'Le modèle de base côté magasin : la caisse, la console du franchisé, la facturation et la cuisine.',
    prix_cents: 9_900,
    unite: 'poste_mois',
    base: true,
    ordre: 1,
    modules: ['pos', 'console-franchise', 'facturation', 'cuisine'],
  },
  {
    cle: 'franchiseur',
    nom: 'Pack franchiseur',
    description: "Le modèle de base côté siège : ce que le réseau vend, ce qu'il achète, ses recettes et ses redevances.",
    prix_cents: 19_900,
    unite: 'mois',
    base: true,
    ordre: 2,
    modules: ['console-marque', 'fournisseurs', 'recettes', 'redevances'],
  },
  {
    cle: 'webshop',
    nom: 'Pack webshop',
    // Prix de départ : la somme de ce que les deux modules coûtaient à
    // l'unité. Les empaqueter ne fait pas baisser le prix tout seul — c'est
    // une décision commerciale, qui se prend dans la console.
    description: 'La boutique en ligne du réseau et les tournées qui livrent ce qu’elle vend.',
    prix_cents: 9_800,
    unite: 'mois',
    base: false,
    ordre: 3,
    modules: ['webshop', 'livraison'],
  },
];

/**
 * Les étapes du suivi commercial, telles qu'elles se présentent au départ.
 *
 * Semées une seule fois : ensuite elles se renomment, se réordonnent, se
 * suppriment et s'inventent dans la console. Une équipe qui vend autrement
 * doit pouvoir décrire sa façon de faire sans qu'on redéploie.
 *
 * `relance_jours` est le silence toléré avant qu'on prévienne le commercial.
 * Il est court en début de cycle, où l'oubli coûte le plus cher, et long à la
 * fin, où c'est le client qu'on attend.
 */
export const ETAPES = [
  {
    cle: 'a-qualifier',
    nom: 'À qualifier',
    description: "Le besoin n'est pas encore cerné : on ne sait pas ce qu'on vend, ni à qui exactement.",
    ordre: 1,
    // Sans statut, volontairement : une offre déjà partie qu'on ramènerait
    // ici redeviendrait modifiable, et l'on réécrirait un document que le
    // client a dans sa boîte. Un brouillon l'est déjà de naissance.
    relance_active: true,
    relance_jours: 3,
  },
  {
    cle: 'offre-envoyee',
    nom: 'Offre envoyée',
    description: 'Le client a reçu le chiffrage et son annexe. La balle est dans son camp.',
    ordre: 2,
    statut: 'envoyee',
    gabarit_actif: true,
    gabarit_sujet: 'Votre offre {reference} — avez-vous pu la regarder ?',
    gabarit_corps: `Bonjour {contact},

Je reviens vers vous au sujet de l'offre {reference}, envoyée il y a quelques jours.

Avez-vous eu l'occasion de la parcourir ? Je reste disponible pour en détailler
n'importe quel poste, ou pour l'ajuster si le périmètre a bougé.

{commercial}
The Franchise Buddy`,
    relance_active: true,
    relance_jours: 7,
  },
  {
    cle: 'en-discussion',
    nom: 'En discussion',
    description: 'Le client a réagi. On négocie le périmètre, le prix ou le calendrier.',
    ordre: 3,
    statut: 'envoyee',
    relance_active: true,
    relance_jours: 5,
  },
  {
    cle: 'en-attente-decision',
    nom: 'En attente de décision',
    description: "Tout est dit, le client tranche. C'est le moment où l'on relance sans insister.",
    ordre: 4,
    statut: 'envoyee',
    gabarit_actif: true,
    gabarit_sujet: 'Offre {reference} — où en êtes-vous ?',
    gabarit_corps: `Bonjour {contact},

L'offre {reference} reste valable jusqu'au {valide_jusqu_au}.

Un mot me suffit pour savoir où en est votre réflexion — y compris si ce n'est
pas le bon moment.

{commercial}
The Franchise Buddy`,
    relance_active: true,
    relance_jours: 14,
  },
  {
    cle: 'gagnee',
    nom: 'Gagnée',
    description: "L'offre est acceptée. La suite se joue sur le contrat et l'onboarding.",
    ordre: 5,
    statut: 'acceptee',
    relance_active: false,
    relance_jours: 0,
  },
  {
    cle: 'perdue',
    nom: 'Perdue',
    description: 'Refusée, sans suite, ou partie ailleurs. On note pourquoi dans le journal.',
    ordre: 6,
    statut: 'refusee',
    relance_active: false,
    relance_jours: 0,
  },
];

export const PRESTATIONS = [
  {
    cle: 'design',
    nom: 'Design',
    description: "Reprise de l'identité du réseau : couleurs, logo, typographies, jetons servis par l'API.",
    prix_cents: 50_000,
    ordre: 1,
  },
];
