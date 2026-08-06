<!--
  Ce contrat vient de la branche `main`, où vivait une seconde application
  (Next.js) aujourd'hui retirée. Il est conservé ici parce que `ROUTINE-MODULE.md`
  demande d'écrire ce fichier sans en donner le format, et que le pipeline le lit.

  Un seul changement à l'import : le chemin. L'autre application attendait
  `tfb-module.json` à la racine du dépôt ; ce pipeline lit `.tfb/module.json`
  (voir pipeline/contenu-initial.mjs). Deux documents qui désignent le fichier
  par deux noms différents, c'est une demi-journée perdue par la personne qui
  suit celui des deux qu'elle a trouvé en premier.
-->

# `.tfb/module.json` — le contrat entre un dépôt et la landing

Un dépôt qui veut apparaître comme module sur la landing dépose ce fichier **à sa
racine**. La routine d'ingestion le lit et écrit dans `tfb_modules` et
`tfb_translations` — plus personne ne saisit ce contenu à la main.

L'idée : le contenu vit là où vit le code. Quand une équipe renomme sa
fonctionnalité ou change son argumentaire, elle modifie ce fichier, et la landing
suit à la prochaine exécution de la routine.

## Exemple complet

```json
{
  "key": "scan",
  "slug": "scan",
  "group": "Logistique",
  "icon": "qr-code",
  "redirectUrl": "/modules/scan",
  "routes": ["/", "/receptions", "/inventaire"],
  "content": {
    "fr": {
      "name": "Scan",
      "description": "Réceptions et inventaires au QR code, depuis un téléphone.",
      "bullets": [
        "Réception fournisseur au QR code",
        "Inventaire tournant depuis un téléphone",
        "Écarts remontés au responsable réseau",
        "Fonctionne hors ligne"
      ],
      "metricValue": "12 min",
      "metricLabel": "par inventaire"
    },
    "en": {
      "name": "Scan",
      "description": "QR-code deliveries and stock counts from a phone."
    },
    "ar": {
      "name": "المسح",
      "description": "استلام البضائع وجرد المخزون عبر رمز QR من الهاتف."
    }
  }
}
```

## Champs

| Champ | Obligatoire | Rôle |
| --- | --- | --- |
| `key` | non | Identifiant du module. Déduit du nom du dépôt si absent (`tfb-invoicing` → `invoicing`). **Immuable après publication** : les traductions s'y rattachent. |
| `slug` | non | Segment d'URL. Vaut `key` par défaut. |
| `group` | non | Chip de filtre sur la landing. Parmi : `Ventes`, `Finance`, `Marketing`, `Logistique`, `Assistance`, `Terrain`. Une valeur inconnue est ignorée avec un avertissement. |
| `icon` | non | Nom de fichier dans `public/icons` (sans `.svg`). `layers` par défaut. |
| `redirectUrl` | non | Cible du clic. `/modules/<slug>` par défaut. |
| `routes` | non | Routes à photographier, relatives à l'URL passée en `--url`. Une capture par route. |
| `content` | **oui en pratique** | Le contenu par locale. |

### `content.<locale>`

| Champ | Où ça s'affiche |
| --- | --- |
| `name` | Titre de la carte et de la page module |
| `description` | Deux lignes sous le titre |
| `bullets` | Les puces « Ce que fait le module », sur la page module |
| `metricValue` / `metricLabel` | Le gain chiffré en ember, ex. « 12 min » / « par inventaire » |

**`content.fr` est ce qui décide de la publication.** Sans nom français, le module
est créé mais reste **inactif** : il n'apparaît pas sur la landing. C'est
délibéré — mieux vaut un module absent qu'un module affichant une clé technique.

Les locales absentes retombent sur le français, comme partout ailleurs. Vous
pouvez donc ne fournir que `fr` et laisser un traducteur compléter plus tard via
le back office.

## Lancer la routine

```bash
# Contenu seul, sans captures
npm run ingest -- --repo owner/nom

# Avec captures d'une application en ligne
npm run ingest -- --repo owner/nom --url https://atelier.tfbuddy.com

# Routes explicites, sans toucher au manifeste
npm run ingest -- --repo owner/nom --url http://localhost:3001 --routes /,/login

# Depuis un répertoire déjà sur la machine — ni clone, ni identifiants
npm run ingest -- --path /var/www/app/mon_module --repo owner/nom

# Voir ce qui serait écrit, sans rien écrire
npm run ingest -- --repo owner/nom --dry-run
```

`--path` lit le manifeste dans un répertoire local au lieu de cloner. Le code
d'un module tourne le plus souvent déjà sur le serveur : exiger un accès distant
pour lire un fichier qui est là serait absurde, et c'est la seule voie pour un
dépôt privé auquel la machine n'a pas accès. Le répertoire n'est **jamais**
modifié ni supprimé — il est ouvert en lecture seule.

`--repo` reste utile à côté de `--path` : c'est ce qui est écrit dans
`tfb_modules.repo`, la trace de la provenance. Sans lui, la colonne prend le nom
du répertoire.

**Toujours commencer par `--dry-run`.** Il affiche la clé déduite, le groupe,
l'icône et le contenu par locale sans écrire une ligne. La clé étant immuable
après publication, c'est le moment de la corriger avec `--key`.

Idempotent : relancée sur le même dépôt, la routine met à jour au lieu de
dupliquer, et **remplace** les captures au lieu de les empiler.

### Les captures

Playwright est une dépendance optionnelle — la routine ingère le contenu sans
lui, et ne le réclame que si vous passez `--url`. Pour l'activer :

```bash
npm i -D playwright && npx playwright install --with-deps chromium
```

Si la machine a déjà un Chromium, évitez les 300 Mo de téléchargement :

```bash
PLAYWRIGHT_CHROMIUM_PATH=/usr/bin/chromium npm run ingest -- --repo ... --url ...
```

Une route qui renvoie une erreur HTTP est **refusée**, pas photographiée : sans
ce contrôle, une page 404 finirait publiée comme capture produit. Une route en
échec n'interrompt pas les autres — un module avec trois captures sur quatre
reste publiable, et le rapport dit laquelle manque.

Une application encore servie sous certificat auto-signé, ou photographiée par
son IP, fait échouer la navigation sur `ERR_CERT_AUTHORITY_INVALID`. `--insecure`
lève la vérification :

```bash
npm run ingest -- --path /var/www/app/mon_module --url https://185.180.206.46/mon_module --insecure
```

À réserver aux captures internes, et à retirer dès que l'application a un vrai
certificat — c'est le drapeau qu'on oublie en place.

### Photographier une application derrière une session

La plupart des applications métier n'ont aucune page publique : sans session,
chaque route redirige vers l'écran de connexion, qui répond 200. La capture
réussit et montre un formulaire de login. Le rapport le signale — « redirigé vers
… » — mais mieux vaut fournir une session :

```bash
TFB_CAPTURE_COOKIE='consultant_access_token=eyJhbGciOi…' \
  npm run ingest -- --path /var/www/app/mon_module --url https://… --insecure
```

Copiez le cookie depuis les outils du navigateur, sur une session déjà ouverte.
La syntaxe est celle de l'en-tête `Cookie` : `nom=valeur; autre=valeur`.

Passez-le par l'**environnement**, pas par `--cookie` : un jeton de session en
argument est lisible dans `ps` par n'importe quel utilisateur de la machine. Le
drapeau existe pour le dépannage interactif, pas pour un cron.

## Dépôts privés

`git clone` s'exécute sur le serveur, avec l'identité de l'utilisateur qui lance
la routine. Pour un dépôt privé, il faut donc que cet utilisateur puisse le
cloner — clé de déploiement dans son `~/.ssh`, ou jeton dans un
`~/.git-credentials` en 0600. Testez d'abord à la main :

```bash
sudo -u tfb git clone --depth 1 <url> /tmp/essai && rm -rf /tmp/essai
```

Si ça échoue, la routine signalera « Source illisible » et n'écrira rien.

Plus simple quand le code est déjà déployé : ne clonez pas du tout, pointez le
répertoire.

```bash
npm run ingest -- --path /var/www/app/mon_module --repo owner/nom
```

## En cron

```cron
# Routine matinale — 6 h 15
15 6 * * * cd /srv/tfb-landing && /usr/bin/npm run ingest -- --repo owner/nom --url https://... >> /var/log/tfb-ingest.log 2>&1
```

Chargez `/etc/tfb-landing.env` dans l'environnement du cron, ou passez
`DATABASE_URL` explicitement.
