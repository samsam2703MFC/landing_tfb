# Routine — un module ou un composant a bougé

À suivre **dans le dépôt du module**, pas dans celui de la landing. Le principe
tient en une phrase : *chaque dépôt se décrit lui-même, la landing suit*.

Rien ici ne demande de toucher à la base de données ni au code de la landing.

---

## 1. Décrire le changement dans `.tfb/module.json`

C'est le seul fichier à modifier. Il porte le nom du module, sa description, et
une entrée par composant.

### Un composant ajouté

Ajouter un objet dans `features` :

```json
{
  "key": "tracabilite",
  "icon": "qr-code",
  "name": { "fr": "Traçabilité des lots", "en": "Batch traceability" },
  "description": {
    "fr": "Ce que la fonction fait, en deux phrases. Ce qu'elle remplace, pas ce qu'elle contient.",
    "en": "What it does, in two sentences."
  }
}
```

- **`key`** — la clé technique, minuscules et tirets. Elle est **stable** :
  c'est elle qui relie le composant à sa capture d'écran (`module-key.png`) et
  qui le retrouve d'une ingestion à l'autre. La changer crée un nouveau
  composant et orpheline l'ancien.
- **`icon`** — un nom du jeu TFB : `clipboard-check`, `store`, `truck`,
  `chart-line`, `qr-code`, `users`…
- **`description`** — écrire ce que le franchiseur y gagne, pas la liste des
  boutons. Une phrase qui commence par « Permet de » est à réécrire.

### Un composant modifié

Corriger son `name` et sa `description` au même endroit. La clé ne bouge pas.

### Un composant supprimé

Retirer l'objet. Il disparaîtra de la fiche à la prochaine ingestion.

### Un module entier

`name`, `description` (une phrase), `overview` (un paragraphe), `group`,
`icon`, `metric`. Le `group` range le module dans une famille du catalogue :
Vente, Pilotage, Approvisionnement, Terrain, Développement.

**La règle qui compte** : ne décrire que ce qui existe dans le code. Une fiche
qui promet un mode hors ligne inexistant se retrouve sur le site vitrine, et
c'est le commercial qui le découvre devant le client.

---

## 2. Reprendre les captures

**Actions → captures-landing → Run workflow.**

Le workflow ouvre une session sur l'instance, prend les écrans, les anonymise
et ne commite que ce qui a changé. Il repasse seul le 1er de chaque mois.

Si le composant ajouté a son propre écran, ajouter une ligne au plan dans
`tools/capturer-ecrans.mjs` :

```js
ecrans: {
  tracabilite: '/tracabilite',                    // écran ordinaire
  resultats: { chemin: '/pnl', sensible: true },  // écran qui montre des chiffres
}
```

`sensible: true` pour tout écran qui affiche un chiffre d'affaires, un
résultat, une marge ou un nom de client. Ces écrans-là ne sortent qu'avec
l'option `sensibles`, et **uniquement depuis une instance de démonstration**.

La clé de l'écran doit être **la même** que la `key` du composant : c'est ce
qui range la capture sous la bonne entrée de menu.

---

## 3. Rien d'autre

Le push sur `main` déclenche `notify-landing`, qui demande à la landing de
resynchroniser. Trois minutes plus tard, la fiche est à jour.

---

## 4. Valider dans la console

Un module ou un composant **nouveau** arrive en statut « à valider » et reste
hors ligne : le site ne publie jamais un contenu que personne n'a relu.

`https://185.180.206.46/landing_tfb/admin` → **Modules** → le module → *Valider*.

Un contenu **modifié** sur un module déjà publié ne repasse pas par là : la
nouvelle version part en ligne directement, et la console la signale.

Pour repérer ce qui manque : **Composants** → les puces « à valider », « sans
levier », « sans gain écrit », « sans capture ».

---

## Le premier module d'un dépôt qui n'en a jamais eu

Trois fichiers à copier depuis `pwa_consultant`, puis à adapter :

| Fichier | Rôle |
|---|---|
| `.tfb/module.json` | la fiche |
| `tools/capturer-ecrans.mjs` | le preneur de captures |
| `.github/workflows/captures-landing.yml` | le workflow, **sur la branche par défaut** |
| `.github/workflows/notify-landing.yml` | prévient la landing |

Puis trois secrets dans Settings → Secrets and variables → Actions :
`CAPTURE_BASE`, `CAPTURE_USER`, `CAPTURE_PASS`.

Et une ligne dans `modules.json` du dépôt landing :

```json
{ "slug": "monmodule", "repo": "samsam2703MFC/mon_depot", "groupe": "Terrain", "ordre": 14 }
```

---

## Les erreurs qui coûtent cher

| Erreur | Ce qui arrive |
|---|---|
| Changer une `key` existante | Le composant est vu comme neuf, l'ancien reste orphelin, la capture se détache |
| Décrire une fonction pas encore livrée | Elle part sur le site vitrine et le commercial la promet |
| Oublier `sensible: true` | Le compte de résultat d'un client se retrouve public |
| Mettre le workflow sur une autre branche que la branche par défaut | Le bouton « Run workflow » n'apparaît jamais |
| Prendre les captures depuis la production | Les vrais noms et les vrais chiffres sortent — anonymisés, mais la prudence reste |
