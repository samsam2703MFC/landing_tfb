# landing-tfb

Landing d'un ERP destiné aux réseaux de franchise, **alimentée automatiquement
par le code source des modules**.

Aucune fiche produit n'est écrite à la main : un pipeline lit chaque dépôt
GitHub (code + README), demande à Claude d'en tirer une fiche éditoriale
structurée, et écrit le résultat dans Directus. La landing, en rendu serveur,
lit Directus à chaque visite — le site suit donc le développement sans qu'on y
touche.

---

## Comment ça marche

```
Dépôt module (push sur main)
        │  repository_dispatch
        ▼
GitHub Actions « Ingérer un module »
        │  1. lit le dépôt via l'API GitHub (README, arborescence, extraits de code)
        │  2. appelle l'API Anthropic en tool-use forcé → JSON structuré
        │  3. écrit dans Directus (upsert par slug, fonctions par clé)
        ▼
   Directus 11  ──(REST, jeton serveur)──►  Landing Astro SSR  ──►  Caddy  ──►  visiteur
   (base SQL existante)
```

- **Idempotent** : rejouer une ingestion produit exactement le même état. Un
  module est identifié par son `slug`, une fonction par sa `cle`. Les fonctions
  disparues du code disparaissent du site.
- **Économe** : si le commit du dépôt n'a pas bougé depuis la dernière
  ingestion, rien n'est régénéré (`--force` pour passer outre).
- **Tolérant** : un dépôt vide, inaccessible ou une réponse IA invalide sont
  signalés et ignorés — le lot continue.

---

## Arborescence

```
.
├── modules.json                  # la liste des dépôts à ingérer — le seul fichier à éditer
├── .env.example                  # toutes les variables, à copier en .env sur le serveur
├── pipeline/                     # Node 20, ESM, .mjs pur — aucun TypeScript
│   ├── bootstrap-directus.mjs    # crée les collections Directus (idempotent)
│   ├── ingest.mjs                # ingère un module
│   ├── ingest-all.mjs            # ingère tout + régénère la page d'accueil
│   └── lib/
│       ├── repo.mjs              # lecture GitHub et construction du digest
│       ├── ai.mjs                # appel Anthropic en tool-use forcé + validation
│       └── directus.mjs          # client REST Directus
├── apps/web/                     # Astro 7 en SSR (adaptateur Node standalone)
│   ├── src/lib/directus.mjs      # lecture Directus — côté serveur uniquement
│   ├── src/components/Layout.astro
│   ├── src/pages/index.astro
│   ├── src/pages/modules/[slug].astro
│   └── Dockerfile
├── infra/
│   ├── docker-compose.yml        # Directus + landing + Caddy
│   └── Caddyfile                 # HTTPS automatique
├── .github/workflows/
│   ├── ingest.yml                # un module (repository_dispatch ou manuel)
│   ├── sync-all.yml              # tout, chaque lundi 04:00 UTC + manuel
│   └── deploy.yml                # déploiement SSH
└── examples/
    └── module-publish.yml        # à copier dans chaque dépôt de module
```

---

## Variables et secrets

### Secrets GitHub déjà présents — noms conservés tels quels

| Secret | Usage |
| --- | --- |
| `DB_LOGIN` | utilisateur SQL → mappé sur `DB_USER` pour Directus |
| `DB_NAME` | base SQL → mappé sur `DB_DATABASE` |
| `DB_PASS` | mot de passe SQL → mappé sur `DB_PASSWORD` |
| `SSH_HOST` | serveur de déploiement |
| `SSH_USER` | compte de déploiement |
| `SSH_KEY` | clé privée de déploiement, au format OpenSSH — ou son encodage base64 (`base64 -w0 ~/.ssh/id_deploy`), plus sûr à copier |

Le mapping vers les noms attendus par Directus est fait dans
`infra/docker-compose.yml` — les secrets ne sont pas renommés.

### Secrets GitHub à créer

| Secret | Valeur attendue |
| --- | --- |
| `ANTHROPIC_API_KEY` | clé API Anthropic (console.anthropic.com) |
| `DIRECTUS_URL` | URL publique du CMS, ex. `https://cms.mondomaine.fr` |
| `DIRECTUS_TOKEN` | jeton statique d'un utilisateur Directus administrateur |
| `GH_INGEST_TOKEN` | jeton GitHub en lecture sur les dépôts modules (`repo` si privés) |
| `DEPLOY_PATH` | *(facultatif)* chemin du clone sur le serveur — à défaut, `/var/www/landing_tfb` |
| `SSH_PORT` | *(facultatif)* port SSH si différent de 22 |

### Variables de dépôt GitHub (non secrètes, onglet *Variables*)

| Variable | Rôle |
| --- | --- |
| `SITE_DOMAIN` | domaine de la landing — sert au contrôle post-déploiement |
| `ANTHROPIC_MODEL` | *(facultatif)* modèle à utiliser, défaut `claude-sonnet-4-5` |

### Fichier `.env` sur le serveur (`infra/.env`)

Copié depuis `.env.example`. Contient en plus des secrets ci-dessus :

| Variable | Rôle |
| --- | --- |
| `DB_CLIENT` | `pg` (PostgreSQL) ou `mysql` (MySQL / MariaDB) |
| `DB_HOST`, `DB_PORT` | accès à la base existante (`host.docker.internal` si elle tourne sur l'hôte) |
| `DIRECTUS_KEY`, `DIRECTUS_SECRET` | deux chaînes aléatoires stables (`openssl rand -hex 32`) |
| `DIRECTUS_ADMIN_EMAIL`, `DIRECTUS_ADMIN_PASSWORD` | compte admin créé au premier démarrage |
| `SITE_DOMAIN`, `CMS_DOMAIN` | les deux domaines servis par Caddy |

**Aucune clé n'est écrite en dur dans le code.** Tout passe par l'environnement.

---

## Mise en route

### 1. Prérequis serveur

- Docker et le plugin Compose
- La base SQL existante joignable depuis les conteneurs, avec une base vide
  dédiée à Directus (`DB_NAME`)
- Deux enregistrements DNS pointant vers le serveur : `SITE_DOMAIN` et
  `CMS_DOMAIN`, ports 80 et 443 ouverts

### 2. Installer la pile

```bash
sudo git clone <url-du-depot> /var/www/landing_tfb
cd /var/www/landing_tfb/infra
cp ../.env.example .env
$EDITOR .env          # renseigner les valeurs réelles
docker compose up -d --build
```

C'est ce répertoire que le workflow de déploiement met à jour. Pour en utiliser
un autre, créer le secret `DEPLOY_PATH`.

Le clone est fait automatiquement par le workflow s'il n'existe pas encore :
seule la création de `infra/.env` reste manuelle, puisqu'il contient des
identifiants qui n'ont pas leur place dans le dépôt.

Directus crée ses propres tables système au premier démarrage, puis le compte
administrateur. Vérifier : `https://cms.mondomaine.fr` doit afficher l'écran de
connexion.

### 3. Créer le jeton Directus

Dans Directus : **Paramètres → Utilisateurs → (l'admin) → Jeton d'accès
statique** → générer, copier. Cette valeur va dans le secret GitHub
`DIRECTUS_TOKEN` **et** dans `infra/.env`.

### 4. Créer le schéma

```bash
cd /var/www/landing_tfb/pipeline
npm ci
DIRECTUS_URL=https://cms.mondomaine.fr DIRECTUS_TOKEN=xxx npm run bootstrap
```

Le script crée les collections `modules`, `fonctions` et `site`, ainsi que la
relation entre les deux premières. Il est rejouable sans risque : il ne crée que
ce qui manque.

### 5. Première ingestion

Depuis GitHub → onglet **Actions** → *Régénérer tous les modules* → *Run
workflow*. Ou en local :

```bash
cd pipeline
export ANTHROPIC_API_KEY=... DIRECTUS_URL=... DIRECTUS_TOKEN=... GH_INGEST_TOKEN=...
npm run ingest:all
```

Compter environ une minute et quelques centimes par module.

---

## Utilisation courante

```bash
# un module précis, à partir de son slug ou de son dépôt
node pipeline/ingest.mjs consultant
node pipeline/ingest.mjs samsam2703MFC/pwa_consultant --force

# voir ce que l'IA produirait, sans rien écrire dans Directus
node pipeline/ingest.mjs consultant --dry-run

# tout le catalogue
node pipeline/ingest-all.mjs
node pipeline/ingest-all.mjs --only=consultant,cuisine --force
```

### Ajouter un module

1. Ajouter une ligne dans `modules.json` (`slug`, `repo`, `groupe`, `ordre`).
   Le `slug` devient l'URL `/modules/<slug>` : ne plus le changer ensuite.
2. Copier `examples/module-publish.yml` dans le dépôt du module, sous
   `.github/workflows/publish-landing.yml`, et y créer le secret
   `LANDING_DISPATCH_TOKEN`.
3. Pousser. La landing est prévenue et régénère la fiche toute seule.

### Retirer un module du site

Décocher `actif` dans Directus. Le contenu reste en base, la landing ne
l'affiche plus.

---

## Modèle de données Directus

| Collection | Contenu |
| --- | --- |
| `modules` | une ligne par dépôt : `slug`, `nom`, `accroche`, `resume`, `description` (markdown), `public_cible`, `problemes`, `benefices`, `stack`, `mots_cles`, `mermaid`, `commit_sha`, `modele_ia`, `genere_le`, `ordre`, `actif` |
| `fonctions` | une ligne par fonction : `module`, `cle`, `nom`, `description`, `benefice`, `icone`, `ordre` |
| `site` | singleton : contenu de la page d'accueil (`titre`, `accroche`, `problemes`, `reponses`, `mermaid`, `cta_*`, `meta_description`) |

Les champs sont éditables dans Directus. **Attention** : une nouvelle ingestion
du même module écrase les champs générés. Pour figer un texte retouché à la
main, retirer le dépôt de `modules.json`.

Les diagrammes sont stockés en texte Mermaid et rendus **dans le navigateur**
(Mermaid 11 chargé depuis jsDelivr) : rien à installer côté serveur.

---

## Sécurité

- Le jeton Directus n'est lu que dans les composants Astro rendus côté serveur.
  Il n'apparaît jamais dans le HTML envoyé au navigateur, et la landing parle à
  Directus sur le réseau Docker interne (`http://directus:8055`).
- Caddy gère les certificats TLS automatiquement et pose les en-têtes de base.
- La clé SSH de déploiement est écrite puis effacée à chaque exécution du
  workflow, avec vérification stricte de l'empreinte du serveur.

---

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| La landing affiche « Aucun module publié » | l'ingestion n'a jamais tourné, ou `DIRECTUS_TOKEN` est invalide — voir les logs du conteneur `web` |
| `Directus … → 403` au bootstrap | le jeton n'appartient pas à un administrateur |
| `Dépôt … introuvable` | `GH_INGEST_TOKEN` absent ou sans accès au dépôt privé |
| `Réponse invalide : …` après 3 tentatives | le dépôt ne contient pas assez de matière (README vide, peu de code) |
| Un diagramme ne s'affiche pas | Mermaid invalide : le bloc est masqué automatiquement, relancer l'ingestion avec `--force` |
| Directus ne démarre pas | `DB_CLIENT`, `DB_HOST` ou les identifiants SQL sont faux — `docker compose logs directus` |

---

## Choix techniques

- **Directus 11** sur la base SQL existante — pas de base supplémentaire à
  administrer, et une interface d'édition pour les retouches.
- **Astro 7 en SSR** (`@astrojs/node` standalone) — le contenu change sans
  reconstruire l'image ; le rendu reste du HTML, sans framework client.
- **Génération par tool-use forcé** — le modèle ne peut répondre qu'en
  remplissant le schéma de l'outil, ce qui supprime tout parsing hasardeux. Une
  validation locale complète le contrôle et renvoie ses erreurs au modèle.
- **Node 20, ESM, `.mjs` pur** dans le pipeline — aucune étape de compilation.
