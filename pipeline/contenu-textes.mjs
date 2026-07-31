/**
 * Le discours éditorial des pages.
 *
 * Tout ce qui était écrit en dur dans les gabarits — chapeaux de section,
 * libellés de bouton, phrases d'accompagnement — vit ici, puis en base, et se
 * modifie dans la console sans redéploiement.
 *
 * Les valeurs de ce fichier servent de repli : si une clé manque en base, la
 * page affiche celle-ci plutôt qu'un blanc. Ajouter un texte, c'est ajouter
 * une ligne ici puis relancer le seed.
 *
 * La clé se lit `page.emplacement` — elle sert de rangement dans la console,
 * pas d'identifiant public.
 */

export const TEXTES = [
  // ── Gabarit commun ──────────────────────────────────────────────────────
  { cle: 'nav.accueil', section: 'En-tête et pied', valeur: 'Accueil', aide: 'Menu principal.' },
  { cle: 'nav.modules', section: 'En-tête et pied', valeur: 'Modules', aide: 'Menu principal.' },
  { cle: 'nav.contact', section: 'En-tête et pied', valeur: 'Contact', aide: 'Menu principal.' },
  { cle: 'nav.onboarding', section: 'En-tête et pied', valeur: 'Onboarding', aide: 'Bouton braise de l’en-tête.' },
  { cle: 'nav.demo', section: 'En-tête et pied', valeur: 'Demander une démonstration', aide: 'Bouton principal, partout.' },
  { cle: 'pied.fiches', section: 'En-tête et pied', valeur: 'Fiches modules' },
  { cle: 'pied.leviers', section: 'En-tête et pied', valeur: 'Les 6 leviers' },
  { cle: 'pied.mention', section: 'En-tête et pied', valeur: '© 2026 The Franchise Buddy — ERP pour réseaux de franchise' },
  { cle: 'pied.note', section: 'En-tête et pied', valeur: 'Le contenu de ce site est généré depuis le code source des modules.' },

  // ── Accueil ─────────────────────────────────────────────────────────────
  { cle: 'accueil.oeil', section: 'Accueil', valeur: 'ERP pour réseaux de franchise', aide: 'Surtitre, au-dessus du grand titre.' },
  { cle: 'accueil.cta_secondaire', section: 'Accueil', valeur: 'Parcourir les modules' },

  { cle: 'accueil.problemes.oeil', section: 'Accueil', valeur: 'Vos problèmes d’abord' },
  { cle: 'accueil.problemes.titre', section: 'Accueil', valeur: 'Ce qu’un franchiseur ne voit pas lui coûte le plus' },
  { cle: 'accueil.reponses.oeil', section: 'Accueil', valeur: 'Nos réponses' },
  { cle: 'accueil.reponses.titre', section: 'Accueil', valeur: 'Ce que l’outil rend démontrable' },

  { cle: 'accueil.flux.oeil', section: 'Accueil', valeur: 'Vue d’ensemble' },
  { cle: 'accueil.flux.titre', section: 'Accueil', valeur: 'Comment l’information circule' },
  { cle: 'accueil.flux.chapo', section: 'Accueil', valeur: 'Une seule donnée d’un bout à l’autre. Choisissez un module : ses échanges s’allument.' },
  { cle: 'accueil.flux.lien', section: 'Accueil', valeur: 'Suivre le fil d’onboarding →' },

  { cle: 'accueil.leviers.oeil', section: 'Accueil', valeur: 'L’ossature' },
  { cle: 'accueil.leviers.titre', section: 'Accueil', valeur: 'Six leviers pour lire tout le réseau' },
  { cle: 'accueil.leviers.chapo', section: 'Accueil', valeur: 'Chaque module et chaque entrée de menu est rattachée à un ou deux leviers. Trois font le chiffre, trois font le coût.' },
  { cle: 'accueil.leviers.note', section: 'Accueil', valeur: 'En pastille sur chaque module et chaque entrée de menu :' },
  { cle: 'accueil.leviers.note2', section: 'Accueil', valeur: 'chaque levier garde sa couleur — la lettre fait l’identité' },

  { cle: 'accueil.modules.oeil', section: 'Accueil', valeur: 'Les modules' },
  { cle: 'accueil.modules.lien', section: 'Accueil', valeur: 'Suivre le fil d’onboarding' },

  { cle: 'accueil.ecrans.oeil', section: 'Accueil', valeur: 'À l’écran' },
  { cle: 'accueil.ecrans.titre', section: 'Accueil', valeur: 'Le produit tel qu’il tourne' },
  { cle: 'accueil.ecrans.chapo', section: 'Accueil', valeur: 'Des copies d’écran des applications en service, reprises directement dans les dépôts. Pas de maquette.' },

  { cle: 'accueil.clients.oeil', section: 'Accueil', valeur: 'Des réseaux qui travaillent avec TFB', aide: 'Ne s’affiche que si des réseaux sont saisis dans l’écran Clients.' },

  { cle: 'accueil.contact.chapo', section: 'Accueil', valeur: 'Une heure, sur vos cas réels : vos boutiques, votre catalogue, vos tournées. Nous revenons vers vous sous un jour ouvré.' },
  { cle: 'accueil.contact.email', section: 'Accueil', valeur: 'contact@thefranchisebuddy.eu', aide: 'Adresse affichée à côté du formulaire.' },
  { cle: 'accueil.contact.nom', section: 'Accueil', valeur: 'Votre nom' },
  { cle: 'accueil.contact.nom_exemple', section: 'Accueil', valeur: 'Prénom et nom' },
  { cle: 'accueil.contact.reseau', section: 'Accueil', valeur: 'Votre réseau' },
  { cle: 'accueil.contact.reseau_exemple', section: 'Accueil', valeur: 'Enseigne, nombre de points de vente' },
  { cle: 'accueil.contact.email_libelle', section: 'Accueil', valeur: 'E-mail' },
  { cle: 'accueil.contact.email_exemple', section: 'Accueil', valeur: 'vous@enseigne.eu' },
  { cle: 'accueil.contact.situation', section: 'Accueil', valeur: 'Votre situation' },
  { cle: 'accueil.contact.situation_exemple', section: 'Accueil', valeur: 'Ce qui vous fait chercher un outil aujourd’hui' },
  { cle: 'accueil.contact.merci_titre', section: 'Accueil', valeur: 'Demande enregistrée' },
  { cle: 'accueil.contact.merci', section: 'Accueil', valeur: 'Nous revenons vers vous sous un jour ouvré.' },

  // ── Onboarding ──────────────────────────────────────────────────────────
  { cle: 'onboarding.oeil', section: 'Onboarding', valeur: 'Onboarding' },
  { cle: 'onboarding.titre', section: 'Onboarding', valeur: 'De quoi votre réseau a-t-il besoin ?' },
  { cle: 'onboarding.chapo', section: 'Onboarding', valeur: 'Cochez ce qui vous ressemble — problèmes d’abord, besoins ensuite. Votre système s’assemble en bas de page, module par module.' },
  { cle: 'onboarding.cta', section: 'Onboarding', valeur: 'Voir mon système' },
  { cle: 'onboarding.note', section: 'Onboarding', valeur: 'Rien n’est envoyé : la sélection ne quitte pas votre navigateur.' },
  { cle: 'onboarding.systeme.oeil', section: 'Onboarding', valeur: 'Votre système' },
  { cle: 'onboarding.systeme.vide', section: 'Onboarding', valeur: 'Rien encore — cochez au moins un besoin ci-dessus, les modules correspondants apparaîtront ici.' },
  { cle: 'onboarding.systeme.fiche', section: 'Onboarding', valeur: 'Voir la fiche complète →' },
  { cle: 'onboarding.systeme.sans_capture', section: 'Onboarding', valeur: 'capture à venir' },
  { cle: 'onboarding.appel', section: 'Onboarding', valeur: 'On regarde votre système ensemble, sur vos cas réels ?' },

  // ── Fiche module ────────────────────────────────────────────────────────
  { cle: 'module.problemes', section: 'Fiche module', valeur: 'Fait disparaître' },
  { cle: 'module.benefices', section: 'Fiche module', valeur: 'Apporte' },
  { cle: 'module.liens', section: 'Fiche module', valeur: 'Échange avec' },
  { cle: 'module.vide', section: 'Fiche module', valeur: 'Non renseigné.' },
  { cle: 'module.sans_lien', section: 'Fiche module', valeur: 'Aucun échange déclaré.' },
  { cle: 'module.ecrans', section: 'Fiche module', valeur: 'Les écrans' },
  { cle: 'module.ecrans.note', section: 'Fiche module', valeur: 'faites défiler horizontalement' },
  { cle: 'module.menu', section: 'Fiche module', valeur: 'Le menu' },
  { cle: 'module.detail', section: 'Fiche module', valeur: 'Le module en détail' },
  { cle: 'module.entrees', section: 'Fiche module', valeur: 'À quoi sert chaque entrée' },
  { cle: 'module.flux', section: 'Fiche module', valeur: 'Le flux, en clair' },
  { cle: 'module.autres.oeil', section: 'Fiche module', valeur: 'Le reste du catalogue' },
  { cle: 'module.envoie', section: 'Fiche module', valeur: 'envoie vers' },
  { cle: 'module.recoit', section: 'Fiche module', valeur: 'reçoit de' },
];

/** Les langues prévues. Seul le français est publié tant que rien n'est traduit. */
export const LANGUES = [
  { code: 'fr', nom: 'Français', rtl: false, defaut: true, publiee: true },
  { code: 'en', nom: 'English', rtl: false, defaut: false, publiee: false },
  { code: 'nl', nom: 'Nederlands', rtl: false, defaut: false, publiee: false },
  { code: 'de', nom: 'Deutsch', rtl: false, defaut: false, publiee: false },
  { code: 'it', nom: 'Italiano', rtl: false, defaut: false, publiee: false },
  { code: 'pl', nom: 'Polski', rtl: false, defaut: false, publiee: false },
  { code: 'uk', nom: 'Українська', rtl: false, defaut: false, publiee: false },
  { code: 'ru', nom: 'Русский', rtl: false, defaut: false, publiee: false },
  { code: 'ar', nom: 'العربية', rtl: true, defaut: false, publiee: false },
];

/**
 * Les réseaux du bandeau, tels que la maquette les propose.
 *
 * Ils arrivent **non publiés** : ce sont des exemples de mise en page, pas des
 * références réelles. Les afficher tels quels reviendrait à annoncer des
 * clients qui n'en sont pas. Un clic dans la console les active, une fois
 * remplacés par de vrais réseaux.
 */
export const CLIENTS = [
  { nom: 'Belleville Bistro', note: 'Exemple repris de la maquette — à remplacer par un vrai réseau.' },
  { nom: 'Kebab House', note: 'Exemple repris de la maquette — à remplacer par un vrai réseau.' },
  { nom: 'Sushi Loop', note: 'Exemple repris de la maquette — à remplacer par un vrai réseau.' },
  { nom: 'Café Nord', note: 'Exemple repris de la maquette — à remplacer par un vrai réseau.' },
];
