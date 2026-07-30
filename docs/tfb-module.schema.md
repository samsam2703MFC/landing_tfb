# `tfb-module.json` — le contrat entre un dépôt et la landing

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

# Voir ce qui serait écrit, sans rien écrire
npm run ingest -- --repo owner/nom --dry-run
```

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

## En cron

```cron
# Routine matinale — 6 h 15
15 6 * * * cd /srv/tfb-landing && /usr/bin/npm run ingest -- --repo owner/nom --url https://... >> /var/log/tfb-ingest.log 2>&1
```

Chargez `/etc/tfb-landing.env` dans l'environnement du cron, ou passez
`DATABASE_URL` explicitement.
