# MASTER PROMPT — RESTRUCTURATION COMPLÈTE TFB LANDING / BACK OFFICE / ERP SaaS

## Mission

Transformer l'ERP actuel en une plateforme SaaS franchise internationale, scalable,
modulaire et multi-marques.

L'objectif est de construire une architecture capable de gérer :

- Plusieurs marques.
- Plusieurs franchises.
- Plusieurs pays.
- Plusieurs métiers.
- Des modules activables selon les licences.
- Des modules spécifiques métier.
- Des PWA opérationnelles.
- Des back-offices personnalisés dynamiquement.
- Une croissance internationale.

Le système doit être pensé comme un SaaS moderne avec :

- Une architecture microservices.
- Un Super Admin central TFB.
- Un Design System dynamique.
- Une gestion complète des clients, licences et modules.

---

# 0. Règles d'exécution — à lire avant d'écrire une ligne

Ces règles priment sur tout le reste du document. Une consigne fonctionnelle plus bas
qui entrerait en conflit avec l'une d'elles est à signaler, pas à appliquer.

## 0.1 Le Swagger fait foi

Le Swagger / OpenAPI du projet est le contrat d'API. Avant toute implémentation qui
appelle une API :

- Lis le Swagger en entier et dresse la liste des endpoints réellement disponibles.
- **N'utilise que ces endpoints.** N'invente aucune route, aucun paramètre, aucun
  champ de réponse. Un endpoint absent du Swagger n'existe pas, même s'il paraît
  évident et même si un nom voisin existe.
- S'il te manque un endpoint pour tenir une exigence de ce document : **arrête-toi sur
  ce point précis**, écris ce qui manque (méthode, chemin, corps attendu, réponse) et
  continue le reste. Ne bouche pas le trou avec un appel inventé, un mock silencieux
  ou une donnée en dur — un écran qui affiche de fausses données est pire qu'un écran
  qui affiche « indisponible ».
- Toute extension du Swagger passe par une mise à jour explicite du fichier, revue
  séparément.

## 0.2 Rien ne part en ligne tout seul

Tout ce qu'un traitement automatique crée — module, fonction, pack, page, client —
est créé **inactif** (`is_active = 0`). La publication est un geste humain dans le
back-office. Aucun script, aucune routine, aucun agent ne passe un enregistrement en
actif.

## 0.3 Pas de copy en dur, pas de média en base

Toute chaîne affichée passe par la table de traductions, avec le français comme
locale de repli. Tout fichier va sur le disque de stockage du serveur ; la base ne
conserve que le chemin relatif.

## 0.4 Migrations et données

Toute évolution de schéma est une migration versionnée. Aucune donnée de production
n'est supprimée par un traitement automatique : on désactive, on n'efface pas.

---

# 1. Architecture générale ERP — Microservices

Repenser entièrement l'architecture ERP vers une architecture microservices.

Objectifs :

- Séparer les domaines métiers.
- Réduire les dépendances.
- Permettre une évolution indépendante.
- Faciliter le scaling.
- Faciliter la maintenance.
- Permettre des déploiements indépendants.

Architecture possible :

**Option 1** — plusieurs repositories indépendants.

**Option 2** — monorepo avec séparation claire :

```
ERP
├── services
│   ├── crm
│   ├── marketing
│   ├── production
│   ├── webshop
│   ├── recruitment
│   ├── controlling
│   ├── commercial
│   ├── billing
│   ├── client-management
│   └── connectors
├── shared-components
├── shared-ui
├── api-gateway
└── documentation
```

Chaque microservice doit avoir :

- Une responsabilité métier claire.
- Ses propres modules.
- Ses propres composants.
- Ses propres APIs.
- Sa documentation.
- Une architecture indépendante.

---

# 2. TFB — The Franchise Buddy — Super Admin SaaS

TFB devient le centre de contrôle global du SaaS. Le Back Office TFB est le back
office central pour toutes les marques.

Le Super Admin doit gérer : marques, clients, franchises, magasins, licences,
modules, modules métiers, branding, API, PWA, connecteurs, facturation, paramètres
globaux.

```
TFB Super Admin
├── Brands Management
├── Client Management
├── Licenses Management
├── Modules SaaS
├── Business Modules
├── Branding
├── API Management
├── PWA Management
├── Billing
└── Global Configuration
```

---

# 3. Landing TFB

Créer une Landing TFB structurée comme un catalogue SaaS.

## Section « Modules disponibles »

Classification : CRM, Marketing, Finance, RH, POS, Production, WebShop, Recruitment,
Controlling, Commercial, Billing.

Chaque module doit pouvoir être activé, désactivé, licencié, configuré par client et
configuré par marque.

## Section « Modules spécifiques métier »

Permettre l'ajout de modules verticaux selon les secteurs : point chaud, boulangerie,
restaurant, retail. Chaque métier peut disposer de modules spécifiques.

---

# 4. Design System / Branding dynamique

Le Back Office doit être entièrement brandé dynamiquement. La source du branding est
la table `brand` de la Landing TFB, qui devient la source centrale du Design System
SaaS.

Elle doit gérer : fonts, font-size, variables CSS, couleurs, tokens UI, styles,
thèmes, identité graphique.

Le CSS fourni de L'Atelier By sert **uniquement** de référence de structure. Ne pas
copier le design. Reprendre uniquement : organisation CSS, variables, tokens,
architecture graphique.

```
TFB Super Admin → Brand Configuration → CSS dynamique → Back Office personnalisé par marque
```

---

# 5. Architecture Frontend Back Office

Structure obligatoire :

```
Layout global → Modules → Composants
```

Objectifs : architecture claire, réutilisation maximale, maintenance facile,
cohérence avec la Landing TFB.

---

# 6. Client Management

Créer une fiche client complète. Chaque client possède une carte, avec les onglets :
Data, Logs, Factures, Charte graphique, API en fonction, Vue PWA Online, Stripe
Connection.

Types clients : franchiseur, franchisé.

Gestion :

- Un franchisé peut avoir plusieurs magasins.
- Chaque magasin possède sa propre licence.
- Chaque magasin peut avoir ses propres modules activés.

---

# 7. Gestion des licences

Créer un système de licences : licence client, licence franchise, licence magasin,
licence module, licence métier.

Possibilité d'activer un module, de le désactiver, et de limiter selon l'abonnement.

---

# 8. PWA CRM

Analyser la structure actuelle du PWA CRM et retrouver l'onglet « Analyze / Analyse ».

Actions : identifier son emplacement, vérifier s'il a été déplacé ou supprimé, le
réintégrer si nécessaire, en respectant l'architecture modulaire.

---

# 9. Module Controlling

```
Controlling
├── Client Mystère Back Office
├── Tasks
├── Checklists
├── PWA Consultant
└── PWA Client Mystère
```

**Client Mystère Back Office** — composant dédié : gestion des missions, contrôles,
feedback, historique.

**Tasks** — tâches, attribution, statut, historique.

**Checklists** — création, validation, score, historique.

---

# 10. PWA Consultant

Ajouter l'onglet **Budget** et corriger complètement le tableau Budget : structure,
colonnes, alignement, responsive, tri, filtres, calculs, affichage mobile.

---

# 11. Module Recruitment

```
Recruitment
├── CMS Landing Recruitment
├── CRM Recruitment
└── Candidate Space
```

**CMS Landing Recruitment** — pages, blocs, images, SEO, marketing.

**CRM Recruitment** — prospects, candidats, pipeline, étapes, historique.

**Candidate Space** — profil candidat, documents, progression, formation.

---

# 12. Module WebShop

```
WebShop
├── Back Office WebShop
├── PWA Livraison
└── Network Dashboard
```

**Back Office WebShop** — boutiques, produits, commandes, paramètres.

**PWA Livraison** — missions, livraisons, statuts, notifications.

**Dashboard réseau** — vue de tous les webshops, KPI, performances, comparaison
franchises.

---

# 13. Module Marketing

```
Marketing
├── Promotions
├── Campaigns
├── Expenses
└── Marketing Fees
```

**Promotions** — création, gestion, résultats.

**Campagnes** — création, planification, diffusion, analyse.

**Dépenses marketing** — budgets, dépenses, investissements, ROI.

**Redevances marketing** — calculs, historique, contributions réseau.

---

# 14. Module Production — Métier spécifique

Module vertical, activable selon le métier. Gestion par magasin : nombre de fours,
nombre d'étages, nombre de pousses, capacités de production, paramètres spécifiques.

Prévoir une PWA Production.

---

# 15. Module Commercial / Offres

Refondre le module commercial en séparant :

- **Onboarding** — paiement unique.
- **Abonnement** — paiement récurrent.
- **Achat application** — achat définitif.

Landing : afficher les packs commerciaux.

Gestion : création d'offre, modification, archivage.

---

# 16. Paramètres commerciaux

`Paramètres → Commercial`, avec les sous-modules :

- **Étapes** — cycle commercial.
- **Tarifs** — prix.
- **Prestations** — services inclus.
- **Société facturation** — société utilisée.

---

# 17. Agents B2B

Types : agents commerciaux, agents techniques.

Fonctions : attribution client, attribution offre, calcul des commissions.

Créer un système de split négocié — par exemple 30 %, ou 90 % la première année puis
20 %. Le split doit être configurable, sauvegardé et appliqué automatiquement.

---

# 18. Billing Stripe Connect

Ajouter Stripe Connect : paiements clients, abonnements, répartition des paiements,
commissions, splits agents.

---

# 19. Système / Connexions / Connecteurs

`Système → Connexions → Connecteurs` : gestion des APIs, services externes,
intégrations.

---

# 20. Création client simplifiée

Simplifier l'onboarding client : réduire le nombre d'étapes, réutiliser les données
existantes, créer automatiquement les relations client / offre / licence / modules.

---

# 21. Packs Stripe — la chaîne d'accès aux modules

C'est le mécanisme central du SaaS : **un pack est un produit Stripe, et c'est lui qui
ouvre ou ferme les modules dans les admin.**

## 21.1 La chaîne

```
Produit Stripe (le pack)
   └── Prix Stripe (mensuel / annuel / paiement unique)
        └── Abonnement ou paiement d'un client
             └── Licence (client / franchise / magasin)
                  └── Modules autorisés
                       ├── Back Office : le module s'affiche, ou pas
                       └── PWA : la tuile du module s'affiche, ou pas
```

## 21.2 Règles

- **Un pack = un produit Stripe.** Le produit Stripe est la référence ; le pack en
  base porte son `stripe_product_id`. Un pack sans produit Stripe rattaché ne peut
  pas être vendu et n'apparaît pas sur la landing.
- **Les variantes de prix sont des prix Stripe**, pas des packs distincts : mensuel,
  annuel et paiement unique sont trois prix d'un même produit.
- **La composition d'un pack** — la liste des modules qu'il ouvre — vit **dans notre
  base**, pas dans les métadonnées Stripe. Stripe dit ce qui est payé ; nous disons
  ce que ça donne. Les métadonnées Stripe peuvent porter la clé du pack pour le
  rapprochement, jamais la liste des droits.
- **Le webhook Stripe est la seule source de vérité de l'état de paiement.** Un
  abonnement `active` ou `trialing` ouvre les modules du pack ; `past_due`,
  `canceled`, `unpaid` les ferment selon la règle de grâce configurée. Aucun autre
  chemin ne modifie l'état d'une licence.
- **Le contrôle d'accès est côté serveur.** Masquer un menu ne protège rien : chaque
  endpoint vérifie que la licence du contexte appelant couvre le module demandé, et
  répond 403 sinon. Le masquage d'interface n'est qu'un confort par-dessus.
- **Surcharge manuelle possible, traçable.** Le Super Admin peut ouvrir ou fermer un
  module hors pack pour un client donné ; cette dérogation est une ligne datée,
  motivée, visible dans la fiche client, et le webhook ne l'écrase pas.
- **Un module fermé ne détruit rien.** Fermer un accès masque le module et bloque ses
  endpoints ; les données restent, et un réabonnement les retrouve intactes.

## 21.3 Écrans à produire

- **Super Admin → Packs** : liste des packs, produit Stripe rattaché, prix, modules
  inclus, nombre de clients actifs.
- **Super Admin → Pack → Composition** : cocher les modules et modules métier
  qu'ouvre le pack.
- **Fiche client → Licences** : pack souscrit, état Stripe, modules effectivement
  ouverts, dérogations en cours.
- **Landing → Tarifs** : les packs vendables, alimentés par les produits Stripe.

---

# 22. Emplacements de prompts dans le Swagger

Réserver dans le Swagger **deux emplacements**, et deux seulement, pour stocker et
relire des prompts. Aucun autre endpoint de ce type n'est à créer.

```
GET  /admin/prompts/{slot}     → { slot, content, updatedAt, updatedBy }
PUT  /admin/prompts/{slot}     → { content }
```

- `slot` est une énumération fermée de **deux valeurs**, déclarée comme telle dans le
  Swagger : `landing` et `module`. Toute autre valeur répond 400.
- Le contenu est du texte, stocké dans la table de paramètres globaux (clé/valeur),
  pas dans une nouvelle table.
- Les deux routes sont sous l'authentification Super Admin, comme le reste de
  `/admin/*`.
- Le Swagger documente les deux slots, leur usage et un exemple de contenu.

Un prompt stocké ici est **de la donnée éditée par un administrateur**, pas une
instruction que le système exécute aveuglément : tout traitement qui le consomme
applique ses propres règles métier et refuse ce qui les contredit.

---

# 23. PWA opérationnelle unique et modulaire

Créer **une PWA**, pas une par métier. Son écran d'accueil est une grille de tuiles :
une tuile par module ouvert par la licence du magasin connecté. Un module fermé n'a
pas de tuile — il n'est ni grisé, ni annoncé.

## 23.1 Règles

- La grille se construit à partir des droits renvoyés par le serveur au login, jamais
  d'une liste en dur dans le client.
- Chaque tuile affiche le nom du module, son icône et **sa description courte**,
  reprise de la même source que le catalogue de la landing — une seule définition du
  module, affichée à trois endroits (landing, back office, PWA).
- Hors ligne : la PWA garde en cache les écrans consultés et met en file les actions
  saisies, qu'elle rejoue à la reconnexion. Une action en attente est visible comme
  telle, jamais présentée comme validée.
- Chaque appel serveur reste soumis au contrôle de licence : une tuile obtenue par
  un cache périmé ne donne accès à rien.

## 23.2 Les modules et leur description

Chaque module ci-dessous existe en trois endroits — catalogue landing, back office,
tuile PWA — avec **la même description**, tenue dans les traductions.

| Module | Description |
| --- | --- |
| **CRM** | Suivi des prospects et des clients du réseau : fiches, interactions, pipeline commercial et historique complet des échanges. |
| **Marketing** | Promotions, campagnes, budgets et redevances marketing : ce que le réseau dépense, ce que ça rapporte, réseau par réseau. |
| **Finance** | Facturation, encaissements, marges et exports comptables, consolidés du magasin au réseau. |
| **RH** | Contrats, plannings, absences et formations des équipes en magasin. |
| **POS** | Caisse et encaissements en point de vente : sessions, tickets, moyens de paiement, clôtures. |
| **Production** | Pilotage de la production en magasin : fours, étages, pousses, capacités et plans de fabrication. Module métier. |
| **WebShop** | Boutique en ligne du réseau : catalogue, commandes, livraison et tableau de bord comparatif des franchises. |
| **Recruitment** | Recrutement de bout en bout : landing candidats, pipeline de candidatures et espace candidat avec documents et formation. |
| **Controlling** | Contrôle qualité du réseau : missions client mystère, tâches, checklists et scores, terrain comme back office. |
| **Commercial** | Offres et packs du réseau : onboarding, abonnements, achats définitifs, agents B2B et commissions. |
| **Billing** | Licences, abonnements et paiements Stripe Connect : ce qui est dû, ce qui est payé, ce qui est reversé. |

## 23.3 PWA métier existantes

Les PWA déjà en place — CRM, Consultant, Client Mystère, Livraison, Kitchen,
Production — deviennent des **modules de cette PWA unique**, pas des applications
séparées. Leur code est repris tel quel dans un premier temps ; seule l'entrée change.

---

# 24. Livrable attendu

À la fin du travail, produire **un fichier Markdown téléchargeable** récapitulant :

- L'architecture retenue, microservice par microservice.
- La liste des modules, avec la description effectivement écrite en base.
- La table des packs, leur produit Stripe et les modules qu'ils ouvrent.
- La liste des endpoints du Swagger utilisés, et **ceux qui ont manqué** (§0.1).
- Les migrations créées.
- Ce qui reste à faire à la main.

---

# OBJECTIF FINAL

```
TFB Super Admin
   ↓
ERP Microservices
   ↓
Modules SaaS
   ↓
Modules métiers
   ↓
PWA opérationnelles
   ↓
Back Offices brandés dynamiquement
```

Le résultat doit être scalable, multi-marques, multi-franchises, multi-pays,
modulaire, facilement extensible et prêt pour une croissance internationale.
