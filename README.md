# landing-tfb

Landing d'un ERP destiné aux réseaux de franchise, **alimentée automatiquement
par le code source des modules**.

Aucune fiche produit n'est écrite à la main : un pipeline lit chaque dépôt
GitHub (code + README), demande à Claude d'en tirer une fiche éditoriale
structurée, et l'écrit **directement dans trois tables SQL**. La landing, en
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
Pipeline (conteneur, sur le serveur)
        │  1. lit le dépôt via l'API GitHub (README, arborescence, code)
        │  2. appelle l'API Anthropic en tool-use forcé → JSON structuré
        │  3. écrit dans tfb_modules / tfb_fonctions / tfb_site
        ▼
   Base SQL existante  ──►  Landing Astro SSR  ──►  Caddy  ──►  visiteur
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
│   ├── bootstrap-db.mjs          # crée les trois tables (idempotent)
│   ├── contenu-initial.mjs       # les 8 fiches rédigées, sans appel IA
│   ├── seed-contenu.mjs          # les charge en base, ou produit contenu.sql
│   ├── contenu.sql               # le même contenu en SQL portable
│   ├── ingest.mjs                # ingère un module
│   ├── ingest-all.mjs            # ingère tout + régénère la page d'accueil
│   ├── Dockerfile                # image lancée à la demande sur le serveur
│   └── lib/
│       ├── repo.mjs              # lecture GitHub et construction du digest
│       ├── ai.mjs                # appel Anthropic en tool-use forcé + validation
│       └── db.mjs                # accès SQL, MySQL ou PostgreSQL
├── apps/web/                     # Astro 7 en SSR (adaptateur Node standalone)
│   ├── src/lib/db.mjs            # lecture des tables — côté serveur uniquement
│   ├── src/components/Layout.astro
│   ├── src/pages/index.astro
│   ├── src/pages/modules/[slug].astro
│   └── Dockerfile
├── infra/
│   ├── docker-compose.yml        # landing + Caddy, plus le pipeline en profil « outils »
│   └── Caddyfile                 # HTTPS automatique
├── .github/
│   ├── actions/preparer-ssh/     # écriture et contrôle de la clé, partagés par les workflows
│   └── workflows/
│       ├── ingest.yml            # un module (repository_dispatch ou manuel)
│       ├── sync-all.yml          # tout, chaque lundi 04:00 UTC + manuel
│       └── deploy.yml            # déploiement SSH
└── examples/
    └── module-publish.yml        # à copier dans chaque dépôt de module
```

---

## Le modèle de données

Trois tables ordinaires, préfixées `tfb_` pour cohabiter avec le reste de la
base. Elles sont créées par `bootstrap-db.mjs` et interrogeables directement
en SQL.

| Table | Contenu |
| --- | --- |
| `tfb_modules` | une ligne par dépôt : `slug`, `nom`, `accroche`, `resume`, `description` (markdown), `public_cible`, `problemes`, `benefices`, `stack`, `mots_cles`, `mermaid`, `commit_sha`, `modele_ia`, `genere_le`, `ordre`, `actif` |
| `tfb_fonctions` | une ligne par fonction : `module_id`, `cle`, `nom`, `description`, `benefice`, `icone`, `ordre` |
| `tfb_site` | une seule ligne : le contenu de la page d'accueil (`titre`, `accroche`, `problemes`, `reponses`, `mermaid`, `cta_*`, `meta_description`) |

Les colonnes `problemes`, `benefices`, `stack`, `mots_cles` et `reponses` sont
de type JSON.

**Corriger un texte à la main** se fait en SQL :

```sql
UPDATE tfb_modules SET accroche = 'Nouvelle phrase.' WHERE slug = 'consultant';
```

Attention : une nouvelle ingestion du même module écrase les champs générés.
Pour figer un texte retouché, retirer le dépôt de `modules.json`.

**Masquer un module** sans le supprimer :

```sql
UPDATE tfb_modules SET actif = 0 WHERE slug = 'consultant';   -- TRUE/FALSE en PostgreSQL
```

Les diagrammes sont stockés en texte Mermaid et rendus **dans le navigateur**
(Mermaid 11 chargé depuis jsDelivr) : rien à installer côté serveur.

---

## Variables et secrets

### Secrets GitHub — les six déjà en place suffisent

| Secret | Usage |
| --- | --- |
| `SSH_HOST` | serveur de déploiement |
| `SSH_USER` | compte de déploiement |
| `SSH_KEY` | clé privée OpenSSH, ou son encodage base64 (`base64 -w0 ~/.ssh/id_deploy`), plus sûr à copier |
| `DB_LOGIN`, `DB_NAME`, `DB_PASS` | non utilisés par les workflows — ce sont les mêmes valeurs à reporter dans `infra/.env` |

Deux secrets facultatifs : `SSH_PORT` (22 par défaut) et `DEPLOY_PATH`
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
| `DB_HOST`, `DB_PORT` | accès à la base (`host.docker.internal` si elle tourne sur l'hôte) |
| `DB_LOGIN`, `DB_NAME`, `DB_PASS` | identifiants de la base |
| `SITE_DOMAIN` | domaine servi par Caddy |
| `ACME_EMAIL` | adresse pour les alertes de certificat |
| `ANTHROPIC_API_KEY` | clé API, nécessaire seulement pour l'ingestion |
| `GH_INGEST_TOKEN` | jeton de lecture GitHub, seulement si des dépôts modules sont privés |

**Aucune clé n'est écrite en dur dans le code.** Tout passe par l'environnement.

---

## Mise en route

### 1. Prérequis serveur

- Docker et le plugin Compose
- La base SQL joignable depuis les conteneurs, avec une base dédiée
- Un enregistrement DNS pointant vers le serveur, ports 80 et 443 ouverts

Créer la base si besoin :

```sql
CREATE DATABASE tfb_landing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tfb_landing'@'%' IDENTIFIED BY 'un-mot-de-passe';
GRANT ALL PRIVILEGES ON tfb_landing.* TO 'tfb_landing'@'%';
FLUSH PRIVILEGES;
```

### 2. Premier déploiement

Lancer le workflow *Déployer sur le serveur*. Il clone le dépôt dans
`/var/www/landing_tfb`, y dépose `infra/.env` à partir du gabarit, puis
s'arrête en demandant de le remplir. Renseigner le fichier :

```bash
cd /var/www/landing_tfb/infra
$EDITOR .env
```

Relancer le workflow : la landing et Caddy démarrent.

### 3. Créer les tables

```bash
cd /var/www/landing_tfb/infra
docker compose --profile outils run --rm pipeline node bootstrap-db.mjs
```

Rejouable sans risque : le script ne crée que ce qui manque.

### 4. Charger le contenu de départ

Les huit fiches sont déjà rédigées à partir du code des dépôts. Aucune clé API
n'est nécessaire :

```bash
docker compose --profile outils run --rm pipeline node seed-contenu.mjs
```

Ou directement en SQL, sans passer par le conteneur :

```bash
mysql -u tfb_landing -p tfb_landing < pipeline/contenu.sql   # ou psql -f
```

Les deux sont rejouables : le contenu est remplacé, jamais dupliqué. La landing
a dès lors ses 8 modules et ses 57 fonctions.

### 5. Passer à la régénération automatique

Pour que le contenu suive le code sans intervention, renseigner
`ANTHROPIC_API_KEY` dans `infra/.env`, puis :

```bash
docker compose --profile outils run --rm pipeline node ingest-all.mjs
```

Ou depuis GitHub → **Actions** → *Régénérer tous les modules*. Compter environ
une minute et quelques centimes par module. L'ingestion remplace le contenu de
départ module par module — les clés de fonctions étant les mêmes, rien n'est
dupliqué.

---

## Utilisation courante

Sur le serveur, depuis `infra/` :

```bash
# un module précis, à partir de son slug ou de son dépôt
docker compose --profile outils run --rm pipeline node ingest.mjs consultant
docker compose --profile outils run --rm pipeline node ingest.mjs consultant --force

# voir ce que l'IA produirait, sans rien écrire en base
docker compose --profile outils run --rm pipeline node ingest.mjs consultant --dry-run

# tout le catalogue
docker compose --profile outils run --rm pipeline node ingest-all.mjs --only=consultant,cuisine
```

### Ajouter un module

1. Ajouter une ligne dans `modules.json` (`slug`, `repo`, `groupe`, `ordre`).
   Le `slug` devient l'URL `/modules/<slug>` : ne plus le changer ensuite.
2. Copier `examples/module-publish.yml` dans le dépôt du module, sous
   `.github/workflows/publish-landing.yml`, et y créer le secret
   `LANDING_DISPATCH_TOKEN`.
3. Pousser. La landing est prévenue et régénère la fiche toute seule.

---

## Sécurité

- La base n'est jamais jointe depuis Internet : l'ingestion s'exécute sur le
  serveur, atteint par SSH avec les secrets déjà en place.
- Les identifiants ne sont lus que par des composants Astro rendus côté
  serveur. Ils n'apparaissent jamais dans le HTML envoyé au navigateur.
- Caddy gère les certificats TLS automatiquement et pose les en-têtes de base.
- La clé SSH est écrite puis effacée à chaque exécution de workflow, avec
  vérification stricte de l'empreinte du serveur.

---

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| La landing affiche « Aucun module publié » | l'ingestion n'a jamais tourné, ou la base est injoignable — `docker compose logs web` |
| `Variables de base manquantes` | `infra/.env` incomplet |
| `relation "tfb_modules" does not exist` | `bootstrap-db.mjs` n'a pas été lancé |
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
