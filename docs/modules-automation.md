# Publier quinze dépôts sans les saisir

Un dépôt devient un module de la landing sans que personne ne tape son
argumentaire dans un formulaire. À un dépôt près c'est un confort ; à quinze,
c'est la seule façon que le site reste juste.

Trois pièces : un fichier dans chaque dépôt, une liste sur le serveur, un
déclencheur.

## 1. Dans chaque dépôt : `tfb-module.json`

La fiche du module, à la racine du dépôt. Contrat complet dans
[tfb-module.schema.md](tfb-module.schema.md).

Le contenu vit là où vit le code : quand une équipe renomme sa fonctionnalité,
elle modifie son propre fichier et la landing suit. Personne n'a besoin d'un
accès au back office pour corriger sa propre description.

## 2. Sur le serveur : `config/modules.json`

La liste des dépôts de la tournée. Partez de `config/modules.example.json`.

```json
{
  "defaults": { "insecure": true },
  "modules": [
    {
      "repo": "samsam2703MFC/pwa_consultant",
      "path": "/var/www/app/pwa_consultant",
      "url": "https://185.180.206.46/pwa_consultant",
      "cookieEnv": "TFB_COOKIE_CONSULTANT"
    },
    { "repo": "samsam2703MFC/tfb-invoicing" }
  ]
}
```

| Champ | Rôle |
| --- | --- |
| `repo` | `owner/nom`. Écrit en base comme provenance, et cloné si `path` est absent. |
| `path` | Répertoire déjà sur la machine. Lu en lecture seule, jamais supprimé. Évite tout identifiant. |
| `url` | Application à photographier. Absent : le contenu est ingéré sans captures. |
| `routes` | Routes explicites, sinon celles du manifeste. |
| `insecure` | Accepte un certificat TLS invalide. Captures internes uniquement. |
| `cookieEnv` | **Le nom** de la variable d'environnement portant le cookie de session. |
| `enabled` | `false` sort le dépôt de la tournée sans l'effacer de la liste. |

Ce fichier est ignoré par git : il décrit votre infrastructure, pas le produit.

**Jamais de jeton dans ce fichier.** Un cookie de session écrit ici finirait
dans une sauvegarde ou un presse-papier. On déclare le *nom* d'une variable
d'environnement ; la valeur vit dans `/etc/tfb-landing.env`, en 0600. Une entrée
qui contient un champ `cookie` en clair est **refusée**, pas nettoyée.

```bash
# /etc/tfb-landing.env
TFB_COOKIE_CONSULTANT="consultant_access_token=eyJhbGciOi…"
```

Lancer la tournée :

```bash
npm run ingest:all -- --dry-run     # affiche tout, n'écrit rien
npm run ingest:all                  # la tournée complète
npm run ingest:all -- --only samsam2703MFC/pwa_consultant
```

Chaque dépôt tourne dans un processus séparé, **séquentiellement**. Un manifeste
illisible, un Chromium qui meurt ou un serveur muet n'emporte pas les quatorze
autres : le rapport final nomme le fautif et la sortie est non nulle, ce qui fait
qu'un cron silencieux le signale au lieu de le garder pour lui.

Séquentiel, parce que chaque dépôt ouvre un navigateur et photographie une
application de production. Quinze à la fois, c'est un déni de service sur son
propre serveur.

### Ce qui est une panne, et ce qui n'en est pas

| Situation | Effet |
| --- | --- |
| Dépôt injoignable, répertoire disparu | **Échec.** Rien n'est écrit, la tournée sort en erreur. |
| `tfb-module.json` mal formé | **Échec.** Une faute à corriger, pas un brouillon à publier. |
| Dépôt lisible, pas de `tfb-module.json` | Module créé **inactif**. Il n'apparaît pas sur la landing. |
| Pas de nom français | Module créé **inactif**. Mieux vaut absent qu'affichant une clé technique. |
| Une route sur cinq en erreur | Les quatre autres sont enregistrées, le rapport nomme la cinquième. |

La première ligne est celle qui compte à quinze dépôts. Sans elle, un dépôt
renommé créerait une ligne fantôme et le rapport annoncerait tout vert.

## 3. Le déclencheur

### La tournée programmée

`.github/workflows/ingest.yml` tourne à 6 h 15 UTC. Elle se connecte au serveur
et lance `npm run ingest:all`. Les secrets restent sur le serveur : le runner
GitHub ne voit ni l'URL de la base, ni les cookies.

Elle s'exécute aussi à la demande depuis l'onglet **Actions** — avec un champ
pour n'ingérer qu'un dépôt, et une case pour simuler.

### La publication immédiate

Pour qu'un dépôt se publie sans attendre le lendemain, déposez
[`deploy/module-repo-workflow.yml`](../deploy/module-repo-workflow.yml) dans son
`.github/workflows/`. À chaque modification de son `tfb-module.json`, il prévient
la landing, qui n'ingère que lui.

Un secret à créer dans chacun des quinze dépôts :

| Secret | Contenu |
| --- | --- |
| `TFB_LANDING_TOKEN` | Un jeton d'accès personnel **à portée fine**, permission `Contents: read and write` sur `landing_tfb` **uniquement**. |

À portée fine, pas classique : un jeton `repo` classique donnerait à quinze
dépôts un accès en écriture à tout le compte. Si l'un d'eux fuite, la portée
décide de ce que ça coûte.

Le nom du dépôt arrive de l'extérieur dans la charge utile ; le workflow le
refuse s'il ne ressemble pas à `owner/nom`, avant qu'il n'approche une ligne de
commande distante.

### Sans GitHub

Un timer systemd ou une ligne de cron font le même travail :

```cron
15 6 * * * cd /srv/tfb-landing && set -a && . /etc/tfb-landing.env && set +a && /usr/bin/npm run ingest:all >> /var/log/tfb-ingest.log 2>&1
```

## Ce qu'il faut surveiller

- **Les cookies de capture expirent.** Pour quinze applications, un compte de
  service dédié aux captures vaut mieux que quinze jetons copiés à la main.
- **`--insecure` s'oublie en place.** Il est à retirer dès qu'une application a
  un vrai certificat.
- **La clé d'un module est immuable** après publication : les traductions s'y
  rattachent. C'est au premier `--dry-run` qu'on la corrige.
- **Playwright n'est nécessaire que pour les captures.** Sur un serveur qui a
  déjà un Chromium, `PLAYWRIGHT_CHROMIUM_PATH` évite 300 Mo de téléchargement.
