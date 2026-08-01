# landing-tfb

Landing d'un ERP destiné aux réseaux de franchise, **alimentée automatiquement
par le code source des modules**.

Aucune fiche produit n'est écrite à la main : un pipeline lit chaque dépôt
GitHub (code + README), demande à Claude d'en tirer une fiche éditoriale
structurée, et l'écrit **directement dans quatre tables SQL**. La landing, en
rendu serveur, lit ces tables à chaque visite — le site suit donc le
développement sans qu'on y touche.

---

## Comment ça marche

```
Dépôt module (push sur main)
        │  repository_dispatch
        ▼
GitHub Actions « Ingérer un module »
        │  se connecte au serveur en SSH et y lance le pipeline
        ▼
Pipeline (Node, sur le serveur)
        │  1. lit le dépôt via l'API GitHub (README, arborescence, code)
        │  2. appelle l'API Anthropic en tool-use forcé → JSON structuré
        │  3. écrit dans landing_modules / landing_fonctions / landing_site
        ▼
   Base SQL existante  ──►  Landing Astro SSR (systemd)  ──►  visiteur
```

L'ingestion tourne **sur le serveur**, pas sur le runner GitHub : la base n'a
donc pas à être exposée sur Internet, et la clé Anthropic reste dans
`infra/.env`.

- **Idempotent** : rejouer une ingestion produit exactement le même état. Un
  module est identifié par son `slug`, une fonction par le couple
  (`module_id`, `cle`). Les fonctions disparues du code disparaissent du site.
- **Économe** : si le commit du dépôt n'a pas bougé depuis la dernière
  ingestion, rien n'est régénéré (`--force` pour passer outre).
- **Tolérant** : un dépôt vide, inaccessible ou une réponse IA invalide sont
  signalés et ignorés — le lot continue.

---

## Arborescence

```
.
├── modules.json                  # la liste des dépôts à ingérer — le seul fichier à éditer
├── .env.example                  # toutes les variables, à copier en infra/.env sur le serveur
├── pipeline/                     # Node 20, ESM, .mjs pur — aucun TypeScript
│   ├── bootstrap-db.mjs          # crée les tables et les colonnes manquantes (idempotent)
│   ├── contenu-initial.mjs       # les 13 fiches rédigées, sans appel IA
│   ├── contenu-textes.mjs        # le discours éditorial français des gabarits
│   ├── contenu-traductions.mjs   # les surcharges EN/IT — le français reste la référence
│   ├── contenu-offres.mjs        # tarifs et prestations de départ, ensuite éditables en console
│   ├── seed-contenu.mjs          # les charge en base, ou produit contenu.sql
│   ├── contenu.sql               # le même contenu en SQL portable
│   ├── ingest.mjs                # ingère un module
│   ├── ingest-all.mjs            # ingère tout + régénère la page d'accueil
│   ├── sync-captures.mjs         # récupère les captures publiées par les dépôts
│   ├── exporter-contenu.mjs      # sort le contenu réel en Markdown lisible
│   ├── Dockerfile                # image lancée à la demande sur le serveur
│   └── lib/
│       ├── repo.mjs              # lecture GitHub et construction du digest
│       ├── ai.mjs                # appel Anthropic en tool-use forcé + validation
│       └── db.mjs                # accès SQL, MySQL ou PostgreSQL
├── apps/web/                     # Astro 7 en SSR (adaptateur Node standalone)
│   ├── src/design-system/        # les jetons TFB, repris tels quels
│   ├── src/lib/db.mjs            # lecture des tables — côté serveur uniquement
│   ├── src/lib/admin/            # session et écritures de la console
│   ├── src/lib/offres/           # calcul, saisie des montants, courriel — testés
│   ├── src/middleware.js         # garde /admin, contrôle d'origine, préfixe de langue
│   ├── src/components/Layout.astro
│   ├── src/components/Console.astro
│   ├── src/pages/index.astro
│   ├── src/pages/onboarding.astro
│   ├── src/pages/modules/[slug].astro
│   ├── src/pages/admin/          # la console : modules, textes, traductions, tarifs, offres
│   ├── tests/                    # node:test — aucune dépendance (npm test)
│   └── Dockerfile
├── deploy/
│   ├── landing-tfb.service       # gabarit du service systemd
│   └── apache-landing.conf       # gabarit du montage sous /landing_tfb/
├── infra/                        # variante conteneurs, facultative
│   ├── docker-compose.yml        # landing + Caddy
│   └── Caddyfile                 # HTTPS automatique
├── .github/
│   ├── actions/preparer-ssh/     # écriture et contrôle de la clé, partagés par les workflows
│   └── workflows/
│       ├── ingest.yml            # un module (repository_dispatch ou manuel)
│       ├── sync-all.yml          # tout, chaque lundi 04:00 UTC + manuel
│       └── deploy.yml            # déploiement SSH
├── docs/
│   ├── brief-ux.md               # ce qu'une maquette doit respecter
│   └── contenu-reel.md           # GÉNÉRÉ — les vrais textes du site
└── examples/
    └── module-publish.yml        # à copier dans chaque dépôt de module
```

---

## Le modèle de données

Seize tables ordinaires, préfixées `landing_` pour cohabiter avec le reste de
la base sans risque de collision — le préfixe se change avec `DB_PREFIX`. Elles
sont créées par `bootstrap-db.mjs`, qui ajoute aussi les colonnes manquantes
d'une table déjà en place, et sont interrogeables directement en SQL.

| Table | Contenu |
| --- | --- |
| `landing_modules` | une ligne par dépôt : `slug`, `nom`, `accroche`, `resume`, `description` (markdown), `public_cible`, `problemes`, `benefices`, `stack`, `mots_cles`, `mermaid`, `leviers`, `liens`, `onboarding`, `commit_sha`, `modele_ia`, `genere_le`, `ordre`, `actif` |
| `landing_fonctions` | une ligne par fonction : `module_id`, `cle`, `nom`, `description`, `benefice`, `icone`, `leviers`, `ordre` |
| `landing_captures` | une ligne par copie d'écran : `module_id`, `fonction_cle`, `fichier`, `titre`, `ordre` |
| `landing_site` | une seule ligne : le contenu de la page d'accueil (`titre`, `accroche`, `problemes`, `reponses`, `mermaid`, `cta_*`, `meta_description`) |
| `landing_textes` | le discours éditorial des pages : chapeaux de section, libellés de bouton, phrases d'accompagnement — **rien n'est écrit en dur dans les gabarits** |
| `landing_questions` | les questions de l'onboarding et les modules qu'elles déclenchent |
| `landing_leads` | les demandes de démonstration reçues par le formulaire |
| `landing_clients` | les réseaux affichés sur la landing, logo compris (`logo` en base64, `logo_type`) — vide, le bandeau ne s'affiche pas |
| `landing_langues` | les neuf langues prévues et leur état de publication |
| `landing_traductions` | les surcharges de traduction : `langue`, `entite`, `ligne_id`, `champ`, `valeur`, `source` |
| `landing_utilisateurs` | les comptes de la console : `identifiant`, `nom`, `empreinte`, `role` |
| `landing_prospects` | le client démarché — **à ne pas confondre avec `landing_clients`**, la vitrine de l'accueil |
| `landing_offres` | une proposition chiffrée : référence, version, statut, remise, TVA, prestations et vues retenues, **et une copie des tarifs du jour** |
| `landing_offre_lignes` | les lignes du devis : `type`, `quantite`, `prix_unitaire_cents`, `recurrence` |
| `landing_prestations` | les modules d'onboarding vendables — **à ne pas confondre avec `landing_modules`**, les modules ERP |
| `landing_tarifs` | la grille tarifaire, clé/valeur typée (`cents`, `points`, `entier`, `texte`) |

Les colonnes `problemes`, `benefices`, `stack`, `mots_cles`, `leviers`,
`liens` et `reponses` sont de type JSON.

`leviers` contient les clés des six leviers de gestion — `trafic`,
`recurrence`, `xp`, `food`, `labour`, `overhead` — que le module ou la
fonction actionne. `liens` décrit les échanges avec les autres modules
(`{ slug, sens: "envoie" | "recoit", quoi }`) : c'est la matière de la page
d'onboarding.

**Corriger un texte** se fait dans la console `<BASE_PATH>/admin` (voir plus
bas) ou, à défaut, en SQL :

```sql
UPDATE landing_modules SET accroche = 'Nouvelle phrase.' WHERE slug = 'consultant';
```

Attention : une nouvelle ingestion du même module écrase les champs générés.
Pour figer un texte retouché, retirer le dépôt de `modules.json`.

**Masquer un module** sans le supprimer — bouton « Masquer » dans la console,
ou :

```sql
UPDATE landing_modules SET actif = 0 WHERE slug = 'consultant';   -- TRUE/FALSE en PostgreSQL
```

Les diagrammes sont stockés en texte Mermaid et rendus **dans le navigateur**
(Mermaid 11 chargé depuis jsDelivr) : rien à installer côté serveur.

---

## Variables et secrets

### Secrets GitHub — les six déjà en place suffisent, un septième est facultatif

| Secret | Usage |
| --- | --- |
| `SSH_HOST` | serveur de déploiement |
| `SSH_USER` | compte de déploiement |
| `SSH_KEY` | clé privée OpenSSH, ou son encodage base64 (`base64 -w0 ~/.ssh/id_deploy`), plus sûr à copier |
| `DB_LOGIN`, `DB_NAME`, `DB_PASS` | non utilisés par les workflows — ce sont les mêmes valeurs à reporter dans `infra/.env` |

| `ADMIN_PASSWORD` | *(facultatif)* mot de passe de la console. Présent, il est écrit dans `infra/.env` à chaque déploiement ; absent, le fichier du serveur n'est pas touché |

Deux autres secrets facultatifs : `SSH_PORT` (22 par défaut) et `DEPLOY_PATH`
(`/var/www/landing_tfb` par défaut).

### Variables de dépôt GitHub (non secrètes, onglet *Variables*)

| Variable | Rôle |
| --- | --- |
| `SITE_DOMAIN` | domaine de la landing — sert au contrôle qui suit le déploiement |

### Fichier `infra/.env` sur le serveur

Copié depuis `.env.example`. C'est le seul endroit où vivent les identifiants.

| Variable | Rôle |
| --- | --- |
| `DB_CLIENT` | `mysql` (MySQL / MariaDB) ou `pg` (PostgreSQL) |
| `DB_HOST`, `DB_PORT` | accès à la base (`127.0.0.1` si elle tourne sur le serveur) |
| `DB_LOGIN`, `DB_NAME`, `DB_PASS` | identifiants de la base |
| `DB_PREFIX` | *(facultatif)* préfixe des tables, `landing_` par défaut |
| `BASE_PATH` | chemin de montage, `/landing_tfb` par défaut — `/` pour un domaine dédié |
| `SITE_DOMAIN` | domaine, vide tant qu'aucun DNS ne pointe vers le serveur |
| `HTTP_PORT` | port d'écoute de la landing, `8090` par défaut |
| `ACME_EMAIL` | adresse pour les alertes de certificat |
| `ADMIN_PASSWORD` | ouvre la console `<BASE_PATH>/admin` — vide, elle reste fermée. Écrasé à chaque déploiement si le secret GitHub du même nom existe |
| `ADMIN_SECRET` | *(facultatif)* clé de signature du cookie de session |
| `ANTHROPIC_API_KEY` | clé API, nécessaire seulement pour l'ingestion |
| `GH_INGEST_TOKEN` | jeton de lecture GitHub, seulement si des dépôts modules sont privés |

**Aucune clé n'est écrite en dur dans le code.** Tout passe par l'environnement.

---

## Mise en route

### 1. Prérequis serveur

- Node.js 20 ou plus (le déploiement le vérifie)
- La base SQL joignable en local, avec une base dédiée
- Un port libre pour la landing (8090 par défaut)

Créer la base et le compte si besoin — sur Debian/Ubuntu, `debian-sys-maint`
évite d'avoir à connaître le mot de passe root MySQL :

```sql
CREATE DATABASE IF NOT EXISTS tfb_landing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'tfb_landing'@'localhost' IDENTIFIED BY 'un-mot-de-passe';
GRANT ALL PRIVILEGES ON tfb_landing.* TO 'tfb_landing'@'localhost';
FLUSH PRIVILEGES;
```

### 2. Premier déploiement

Lancer le workflow *Déployer sur le serveur*. Il clone le dépôt dans
`/var/www/landing_tfb`, y dépose `infra/.env` à partir du gabarit, puis
s'arrête en demandant de le remplir :

```bash
$EDITOR /var/www/landing_tfb/infra/.env
```

Relancer le workflow. Il fait alors tout le reste, sans intervention :

1. installe les dépendances et vérifie Node
2. crée les trois tables `landing_*`
3. crée les fiches des modules encore absents de la base (13 aujourd’hui)
4. construit la landing et (re)démarre le service `landing-tfb`

La landing répond sur `https://<serveur>/landing_tfb/`, à côté des autres
applications du serveur : le déploiement dépose un fichier dans
`conf-available` d'Apache et l'active, sans toucher aux vhosts existants.
Vérifier :

```bash
systemctl status landing-tfb
journalctl -u landing-tfb -f
```

### 3. Passer en HTTPS sur un domaine

Dès qu'un enregistrement DNS pointe vers le serveur, deux voies :

- **derrière le serveur web existant** — ajouter un proxy vers
  `http://127.0.0.1:8090` dans Apache ou nginx ;
- **avec Caddy en conteneur** — `infra/docker-compose.yml` et `infra/Caddyfile`
  sont prêts, avec HTTPS automatique, si Docker est installé plus tard.

### 4. Régénération automatique du contenu

Le contenu de départ est figé. Pour qu'il suive le code, renseigner
`ANTHROPIC_API_KEY` dans `infra/.env`, puis :

```bash
cd /var/www/landing_tfb && set -a && . ./infra/.env && set +a
node pipeline/ingest-all.mjs
```

Ou depuis GitHub → **Actions** → *Régénérer tous les modules*. Compter environ
une minute et quelques centimes par module. L'ingestion remplace le contenu de
départ module par module — les clés de fonctions étant les mêmes, rien n'est
dupliqué.

---

## Utilisation courante

Sur le serveur, après avoir chargé l'environnement
(`set -a && . ./infra/.env && set +a`) :

```bash
# un module précis, à partir de son slug ou de son dépôt
node pipeline/ingest.mjs consultant
node pipeline/ingest.mjs consultant --force

# voir ce que l'IA produirait, sans rien écrire en base
node pipeline/ingest.mjs consultant --dry-run

# tout le catalogue
node pipeline/ingest-all.mjs --only=consultant,cuisine

# recharger toutes les fiches de départ (sans IA) — écrase ce qui existe
node pipeline/seed-contenu.mjs

# ne créer que les modules encore absents de la base (le mode du déploiement)
node pipeline/seed-contenu.mjs --si-vide

# récupérer les captures publiées par les dépôts modules
node pipeline/sync-captures.mjs

# sortir tout le contenu en Markdown lisible (docs/contenu-reel.md)
node pipeline/exporter-contenu.mjs          # depuis les fiches de départ
node pipeline/exporter-contenu.mjs --base   # depuis la base, retouches comprises
```

Les tests du calcul commercial tournent sans base ni serveur, depuis
`apps/web` :

```bash
npm test    # node:test — aucune dépendance à installer
```

### La console d'administration

Le contenu se modifie aussi depuis le navigateur, sans redéploiement, à
l'adresse `<BASE_PATH>/admin` — par exemple
`https://185.180.206.46/landing_tfb/admin`.

Huit écrans, sur la même densité que la maquette : **Tableau de bord**
(ce qui manque au contenu publié), **Modules** (fiche, leviers, liens,
ordre, publication, icône), **Composants** (les entrées de menu à plat,
filtrables par module — la vue qui sert à repérer les trous), **Leviers**
(la répartition réelle du catalogue sur les six), **Captures** (titre,
rattachement, ordre), **Page d'accueil** (titre, accroche, problèmes du
franchiseur et réponses), **Langues** (publier ou retirer une langue du
sélecteur) et **Traductions** (le français à gauche, la langue choisie à
droite, entité par entité).

Deux écrans de plus servent l'onboarding commercial : **Tarifs** (prix par
vue, multiplicateur d'achat, maintenance annuelle, journée de formation, TVA
par défaut, mentions et gabarit de courriel) et **Prestations** (le catalogue
des modules d'onboarding vendables), **Offres** (la liste, les filtres, la
fiche où l'on configure et lit le chiffrage) et **Comptes** (qui entre, avec
quel rôle).

Toute écriture vide le cache de lecture : le site montre la modification
immédiatement.

#### L'onboarding commercial

Un commercial crée un client, configure ce qu'il achète, et sort une offre
chiffrée. Trois principes tiennent tout le reste :

**Trois rythmes, pas deux.** Le prix par vue est **mensuel** : l'option
« location » est donc entièrement récurrente. La mettre dans la même colonne
que les 120 000 € payés une fois de l'achat ferme serait la façon exacte de
vendre à perte. Le récapitulatif tient `une fois`, `par mois` et `par an`
côte à côte, chacun avec son sous-total, sa remise, sa TVA et son TTC.

**Une offre garde une copie des tarifs de sa date.** Prix par vue,
multiplicateur, maintenance, journée de formation et prix des prestations
sont recopiés sur la ligne à la création. Modifier la grille ne change donc
aucune offre existante. Une **nouvelle version**, elle, repart des tarifs
d'aujourd'hui : rouvrir une offre de l'an dernier pour la renégocier au prix
de l'an dernier n'aurait pas de sens.

**Une offre envoyée ne se modifie plus.** Le formulaire passe en lecture
seule ; le seul geste possible est d'en faire une nouvelle version. Sans
cette règle, le document dans la boîte du client et celui en base finiraient
par dire deux prix différents — et c'est nous qui aurions tort. Les
coordonnées du client, en revanche, restent corrigeables : un numéro de TVA
faux reste faux quel que soit le statut de l'offre.

Ce qui se vend, avec les prix par défaut :

| Poste | Prix | Rythme |
| --- | --- | --- |
| Modules de l'ERP | 49 € par module | par mois — prix propre possible par module |
| Prestations d'onboarding (Design…) | catalogue | une fois |
| Lignes libres, propres à une offre | saisi | une fois |
| Journée de formation | 500 € | une fois |
| Onboarding d'un poste | 1 500 € | une fois, par poste onboardé |
| Poste en magasin | 199 € | par mois, × magasins ouverts |
| Poste franchiseur | 999 € | par mois |
| Application, louée à la vue | 1 000 € | par mois et par vue |
| Application, achetée ferme | 24 mois de location | une fois, + 5 %/an |

Les **mois offerts** ne sont pas une remise : le prix mensuel ne bouge pas, on
renonce aux N premières échéances. Les confondre ferait apparaître un
abonnement moins cher qu'il ne l'est, et le client s'en apercevrait à la
première facture pleine.

Tous les montants sont des **entiers en centimes**, tous les taux des
**centièmes de point** (21 % = 2100). La conversion depuis ce qu'un humain
tape — « 1 000,50 », l'espace insécable collé depuis un tableur, le symbole —
vit dans `lib/offres/montants.mjs`, seule et testée. Un taux au-delà de 100
est refusé : c'est toujours une saisie en points là où on attendait des
pourcents, et le laisser passer facturerait 2 100 % de TVA.

Le récapitulatif se recalcule par **aller-retour serveur** (POST → 303 → GET)
et non dans le navigateur. Recopier la formule en JavaScript pour gagner cent
millisecondes reviendrait à pouvoir afficher un prix et en facturer un autre.

#### L'envoi de l'offre

**Le serveur n'a aucun service d'envoi** — ni SMTP, ni passerelle. La fiche
d'offre montre le courriel tel qu'il partirait, gabarit appliqué et jetons
remplacés, puis « Envoyer » l'écrit dans le **journal du service** et marque
l'offre comme envoyée. L'écran le dit en toutes lettres : rien ne part, le
texte est à copier dans votre messagerie.

C'est volontairement inconfortable. Une offre marquée « envoyée » qui n'est
jamais partie se relit dans la liste comme un travail fait, et c'est pire
qu'un brouillon.

Pour un envoi réel, il suffit d'écrire un second service respectant
l'interface de `lib/offres/courriel.mjs` et de le brancher dans
`serviceCourriel()` — un seul endroit. `nodemailer` est le candidat évident,
mais c'est une dépendance à ajouter et une configuration SMTP à fournir.

#### Les comptes et les rôles

La console connaît deux rôles :

- **Commercial** — le tableau de bord, ses prospects, ses offres et les
  demandes reçues par le formulaire de contact.
- **Administrateur** — tout, dont la grille tarifaire, les traductions et les
  comptes eux-mêmes.

La liste des droits dit ce qui est **permis** au commercial, jamais ce qui
lui est interdit : un écran ajouté demain lui est fermé tant que personne ne
l'a ouvert explicitement. L'inverse laisserait chaque nouveauté ouverte par
oubli — et c'est la grille tarifaire qui serait modifiable par tout le monde.
Le contrôle est fait dans `src/middleware.js`, en amont de chaque page ; le
rail masque en plus ce que le rôle ne peut pas ouvrir, par confort.

Le rôle voyage **signé dans le cookie de session** : aucune page ne dépend
d'un aller-retour en base pour savoir ce qu'elle a le droit de faire, et le
réécrire à la main casse la signature. Un changement de rôle ne prend donc
effet qu'à la prochaine connexion de la personne. Un compte désactivé ou
supprimé, lui, voit sa session coupée à la requête suivante.

Le mot de passe d'un compte est haché en **scrypt** avec un sel tiré au
hasard ; il n'est jamais stocké en clair, et une empreinte ne permet pas de
le retrouver. Le dernier administrateur actif ne peut être ni supprimé, ni
désactivé, ni rétrogradé.

#### La clé de secours

`ADMIN_PASSWORD` reste la clé du serveur : **identifiant laissé vide** sur
l'écran de connexion, elle ouvre toujours la console en administrateur. Sans
elle, une base vide ou un dernier compte perdu fermeraient la porte à tout le
monde. En contrepartie, ce qui est fait sous cette clé ne porte aucun nom —
la console le dit en clair dans le rail et sur l'écran des comptes.

Elle s'ouvre de deux façons, au choix.

**Par un secret GitHub** — rien à faire sur le serveur. Créer le secret de
dépôt `ADMIN_PASSWORD` (Settings → Secrets and variables → Actions), dix
caractères au minimum et sans apostrophe, puis relancer le déploiement : le
workflow écrit la valeur dans `infra/.env` et redémarre le service. Changer
le secret et redéployer coupe toutes les sessions ouvertes.

**À la main sur le serveur**, si le secret n'existe pas :

```bash
sed -i 's/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=<un mot de passe long>/' infra/.env
systemctl restart landing-tfb
```

Sans cette variable — ou avec la valeur du gabarit — la console répond `503`
et le site public continue d'être servi normalement. Le déploiement le
signale en avertissement plutôt que d'échouer.

**Console et pipeline se partagent la même base.** Une ingestion IA du dépôt
écrase les champs qu'elle régénère : ce qui est écrit à la main dans la
console tient jusqu'à la prochaine ingestion de ce module. Les leviers, les
liens et la phrase d'onboarding, eux, ne sont pas touchés par l'ingestion.

### Les langues

Une langue publiée sert le site sous son préfixe : `/en/`, `/it/`,
`/modules/webshop` devenant `/en/modules/webshop`. Le préfixe est retiré par
`src/middleware.js`, qui range la langue dans `Astro.locals` — les gabarits
restent uniques, il n'y a pas de `[langue]/` à dupliquer, et une page ajoutée
demain est traduite sans qu'on y pense. Le français n'a pas de préfixe :
`/fr/` renvoie en 301 vers `/`, pour qu'une page n'existe pas à deux adresses.
Une langue non publiée répond `404`, plutôt que de promettre une traduction
qui n'existe pas.

Le français reste dans les colonnes d'origine et sert de **référence autant
que de repli** : `landing_traductions` ne porte que les surcharges. Un champ
non traduit s'affiche donc en français — une langue à moitié faite reste
lisible, ce qui compte plus qu'une cohérence de façade.

```bash
# poser les traductions écrites à la main dans pipeline/contenu-traductions.mjs
node pipeline/seed-contenu.mjs --si-vide   # n'écrase pas celles retouchées en console

# traduire tout le reste — fiches de module, composants, catalogue, gabarits
node pipeline/traduire.mjs --verifier      # ne traduit rien : dit ce qui manque
node pipeline/traduire.mjs                 # ce qui manque, dans les langues publiées
node pipeline/traduire.mjs --langue=it     # une seule langue
node pipeline/traduire.mjs --perimees      # reprend celles dont le français a bougé
```

`traduire.mjs` appelle l'API Anthropic et a donc besoin d'`ANTHROPIC_API_KEY`
dans `infra/.env`. Il est **reprenable** : un lot qui échoue n'arrête pas les
autres, et relancer ne retraduit que ce qui manque. Il ne touche jamais au
français ni à une traduction retouchée dans la console — sauf `--force`.

Le modèle reçoit le contexte de chaque champ (« Panel consultant — Accroche —
une phrase, 15 mots au plus ») et la réponse est refusée si un jeton `{n}`
disparaît ou si une clé manque : un `{n}` perdu afficherait « composants »
sans nombre devant.

Ensuite, dans la console : **Traductions** pour traduire champ par champ
(le français à gauche, la langue à droite ; vider un champ le fait retomber
sur le français), puis **Langues** pour publier. Jamais l'inverse — publier
avant de traduire afficherait du français sous un drapeau étranger.

Une traduction se signale **périmée** quand le français a changé depuis :
chaque surcharge garde une copie du français au moment où elle a été écrite
(colonne `source`). Sans ce repère, une phrase corrigée laisserait sa
traduction affirmer l'ancienne version sans que rien ne le dise.

### Ajouter un module

1. Ajouter une ligne dans `modules.json` (`slug`, `repo`, `groupe`, `ordre`).
   Le `slug` devient l'URL `/modules/<slug>` : ne plus le changer ensuite.
2. Copier `examples/module-publish.yml` dans le dépôt du module, sous
   `.github/workflows/publish-landing.yml`, et y créer le secret
   `LANDING_DISPATCH_TOKEN`.
3. Rédiger sa fiche dans `pipeline/contenu-initial.mjs`, avec le **même
   `slug`** que dans `modules.json` — c'est par lui que les captures et les
   liens inter-modules retrouvent leur module.
4. Pousser. Le déploiement crée la fiche en base, et le dépôt module prévient
   la landing à chaque push pour qu'elle la régénère.

---

## Sécurité

- La base n'est jamais jointe depuis Internet : l'ingestion s'exécute sur le
  serveur, atteint par SSH avec les secrets déjà en place.
- Les identifiants ne sont lus que par des composants Astro rendus côté
  serveur. Ils n'apparaissent jamais dans le HTML envoyé au navigateur.
- Caddy gère les certificats TLS automatiquement et pose les en-têtes de base.
- La clé SSH est écrite puis effacée à chaque exécution de workflow, avec
  vérification stricte de l'empreinte du serveur.
- La console est fermée par défaut : sans `ADMIN_PASSWORD`, elle répond `503`.
  Le mot de passe est comparé en temps constant, la session tient dans un
  cookie signé HMAC-SHA256 — `HttpOnly`, `SameSite=Lax`, `Secure` dès que la
  requête arrive en HTTPS — qui ne contient que sa date d'expiration.
- Les soumissions de formulaire sont contrôlées sur l'en-tête `Origin`,
  comparé à `X-Forwarded-Host` : une page tierce ne peut pas écrire dans la
  base à la place d'un administrateur connecté.
- `/admin` porte `noindex, nofollow` et n'est lié depuis aucune page publique.

---

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| La landing affiche « Aucun module publié » | l'ingestion n'a jamais tourné, ou la base est injoignable — `journalctl -u landing-tfb -n 50` |
| `Variables de base manquantes` | `infra/.env` incomplet |
| `relation "landing_modules" does not exist` | `bootstrap-db.mjs` n'a pas été lancé |
| `Dépôt … introuvable` | `GH_INGEST_TOKEN` absent ou sans accès au dépôt privé |
| `Réponse invalide : …` après 3 tentatives | le dépôt ne contient pas assez de matière (README vide, peu de code) |
| Un diagramme ne s'affiche pas | Mermaid invalide : le bloc est masqué automatiquement, relancer l'ingestion avec `--force` |

---

## Choix techniques

- **Écriture directe en SQL** — pas de CMS à administrer, pas de jeton à faire
  circuler. Le contenu est constitué de tables lisibles par n'importe quel
  outil, et corrigeables en une requête.
- **Astro 7 en SSR** (`@astrojs/node` standalone) — le contenu change sans
  reconstruire l'image ; le rendu reste du HTML, sans framework client.
- **Génération par tool-use forcé** — le modèle ne peut répondre qu'en
  remplissant le schéma de l'outil, ce qui supprime tout parsing hasardeux. Une
  validation locale complète le contrôle et renvoie ses erreurs au modèle.
- **Ingestion sur le serveur** — la base reste derrière le pare-feu ; le runner
  GitHub ne fait que déclencher.
- **Node 20, ESM, `.mjs` pur** dans le pipeline — aucune étape de compilation.
