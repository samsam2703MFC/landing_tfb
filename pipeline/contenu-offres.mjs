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
    cle: 'prix_poste',
    valeur: '19900',
    type: 'cents',
    libelle: 'Prix par poste et par mois',
    aide: 'Un poste par point de vente. Facturé chaque mois, comme les vues.',
    ordre: 5,
  },
  {
    cle: 'prix_poste_franchiseur',
    valeur: '99900',
    type: 'cents',
    libelle: 'Prix du poste franchiseur, par mois',
    aide: 'Le poste du siège, distinct de ceux des magasins. Facturé chaque mois.',
    ordre: 6,
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
    cle: 'tva_defaut',
    valeur: '2100',
    type: 'points',
    libelle: 'Taux de TVA par défaut',
    aide: 'Belgique : 2100 pour 21 %. Modifiable offre par offre.',
    ordre: 8,
  },
  {
    cle: 'validite_jours',
    valeur: '30',
    type: 'entier',
    libelle: "Durée de validité d'une offre, en jours",
    aide: 'Sert à proposer la date « valable jusqu’au » à la création.',
    ordre: 9,
  },
  {
    cle: 'mention_autoliquidation',
    valeur: 'Autoliquidation — TVA due par le preneur. À FAIRE VALIDER PAR VOTRE COMPTABLE.',
    type: 'texte',
    libelle: 'Mention en cas d’exonération',
    aide: "Imprimée sur l'offre quand la TVA est à zéro. Une exonération sans mention légale n'en est pas une — la formulation exacte et l'article cité dépendent de votre situation, faites-la valider.",
    ordre: 10,
  },
  {
    cle: 'courriel_sujet',
    valeur: 'Votre offre {reference} — The Franchise Buddy',
    type: 'texte',
    libelle: 'Sujet du courriel',
    aide: 'Jetons disponibles : {reference}, {client}, {commercial}, {valide_jusqu_au}.',
    ordre: 11,
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
    ordre: 12,
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
export const PRESTATIONS = [
  {
    cle: 'design',
    nom: 'Design',
    description: "Reprise de l'identité du réseau : couleurs, logo, typographies, jetons servis par l'API.",
    prix_cents: 50_000,
    ordre: 1,
  },
];
