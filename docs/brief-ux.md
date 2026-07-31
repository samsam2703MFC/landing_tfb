# Brief UX — landing The Franchise Buddy

À coller dans Claude Design, avec trois pièces jointes :

- `docs/contenu-reel.md` — **les vrais textes**, les 9 modules, leurs 79
  entrées de menu, leurs leviers et leurs liens, plus le tableau des volumes ;
- `apps/web/src/design-system/` — les jetons CSS de la marque ;
- `apps/web/public/brand/` — les trois déclinaisons du logo.

Ce document dit **ce qui est négociable et ce qui ne l'est pas**. Tout ce qui
figure sous « Contraintes » vient de la mécanique du site : une maquette qui
les ignore sera belle et inimplémentable.

---

## 1. Ce qu'est ce site

La landing d'un ERP vendu aux **réseaux de franchise**. Le lecteur cible est un
franchiseur : il possède une enseigne, des franchisés, et il se demande ce que
son réseau vaut vraiment.

L'angle éditorial, décidé et non rediscuté : **la valeur d'un réseau, c'est sa
capacité à être transmis.** Tant que les procédures vivent dans la tête des
fondateurs, le repreneur rachète un nom et un bail, pas une méthode. D'où
l'ERP : mettre le savoir-faire dans l'outil.

L'ordre du discours est donc : **ses problèmes d'abord, nos réponses ensuite.**
Jamais l'inverse, jamais une liste de fonctionnalités en ouverture.

Registre : sobre, opérationnel, adulte. Pas de superlatif, pas de « solution
innovante », pas d'illustration abstraite. Le produit est un outil de gestion,
pas une startup.

---

## 2. Les quatre pages

| Page | Rôle |
| --- | --- |
| **Accueil** | Le discours : problèmes du franchiseur, nos réponses, schéma d'ensemble, galerie de captures, inventaire des modules, contact |
| **Onboarding** | Un fil de 9 modules. On clique une icône, on voit ce que le module apporte, pourquoi le prendre, chaque entrée de son menu et à quoi elle sert, et ses échanges avec les autres modules |
| **Fiche module** (×9) | Le module en détail : ce qu'il fait disparaître, ce qu'il apporte, ses captures, ses fonctions une à une, son schéma |
| **Console** `/admin` | Back office d'édition du contenu. Densité back office, pas marketing. Déjà réalisée — à revoir seulement si le reste change |

---

## 3. Les 6 leviers de gestion — l'ossature

Toute la lecture du réseau passe par six leviers. Chaque module et **chaque
entrée de menu** est rattachée à un ou deux d'entre eux. C'est le fil rouge
visuel du site : il faut pouvoir reconnaître un levier d'un coup d'œil,
partout, y compris dans une liste dense.

| Lettre | Clé | Nom | La question |
| --- | --- | --- | --- |
| T | `trafic` | Trafic | Combien de clients entrent ? |
| R | `recurrence` | Récurrence | Combien reviennent ? |
| E | `xp` | Expérience | Que vivent-ils sur place ? |
| F | `food` | Food Cost | Que coûte ce qu'on sert ? |
| L | `labour` | Labour | Que coûtent les heures ? |
| O | `overhead` | Overhead | Que coûte la structure ? |

**À concevoir** : la pastille de levier en deux tailles (isolée, et en série de
1 à 2 accolées dans une ligne de liste), plus la carte de présentation des six
sur l'accueil.

---

## 4. Contraintes — non négociables

### 4.1 Le contenu vient d'une base, pas de la maquette

Chaque bloc est rempli à l'exécution depuis SQL. Le nombre d'éléments varie et
**variera encore** : un dixième module arrivera, une fonction disparaîtra.
Aucune mise en page ne peut supposer « exactement trois cartes ».

Volumes réels aujourd'hui — repris de `docs/contenu-reel.md`, à utiliser comme
contenu de maquette, y compris les extrêmes :

| Élément | Minimum | Maximum |
| --- | --- | --- |
| Modules | — | 9 (5 familles : Vente, Pilotage, Approvisionnement, Terrain, Développement) |
| Fonctions par module | 6 | **22** |
| Leviers par module | 2 | 6 |
| Liens vers d'autres modules | 1 | 4 |
| Problèmes par module | 3 | 4 |
| Bénéfices par module | 4 | 5 |
| Captures par module | **0** | 8 |
| Accroche de module | 60 car. | 94 car. |
| Résumé de module | 236 car. | 320 car. |
| Description longue | 1 100 car. | 1 830 car. (markdown, plusieurs paragraphes) |
| Nom de fonction | 9 car. | 33 car. |
| Description de fonction | 65 car. | 220 car. |

Le cas qui casse le plus de maquettes : **le module Recrutement, 22 entrées de
menu**, à côté du module Affichage qui en a 6. Les deux doivent tenir dans la
même mise en page sans qu'on ait envie de scroller trois écrans.

Le second : **un module sur deux n'a aucune capture d'écran** (5 des 9
aujourd'hui). Prévoir explicitement l'état « pas d'image » — pas un cadre gris
vide, une mise en page qui n'en réclame pas.

### 4.2 Le design system existe déjà

`apps/web/src/design-system/` — jetons CSS, appliqués sur tout le site et sur
la console. **À reprendre tels quels**, pas à réinventer :

- Marque : prune `#7B4488`. Structure : marine `#0C1329`. Neutres : ardoise.
  Accents : sarcelle `#159E96` (analytique), braise `#F0912A` (chaleur, appel
  à l'action — toujours avec du texte marine dessus, jamais blanc).
- Typo : **Manrope** (titres), **IBM Plex Sans** (texte), **IBM Plex Mono**
  (chiffres, identifiants), **IBM Plex Sans Arabic** sous `[dir="rtl"]`.
- Échelle typographique de base 15 px, ratio 1,26. Espacement base 4 px.
- Rayons : jamais de conteneur en pilule — la géométrie fait écho au rond du
  logo, mais les blocs restent des blocs.
- Ombres teintées marine, jamais noires.

Le logo est fourni en trois déclinaisons dans `apps/web/public/brand/`.

### 4.3 Huit langues, dont une en écriture inversée

fr (défaut), en, nl, de, pl, uk, ru, **ar (RTL)**.

Conséquence directe sur la maquette : **aucune propriété physique**. Pas de
`margin-left`, pas de `text-align: right`, pas de flèche « → » qui ne se
retourne pas. Uniquement des propriétés logiques (`margin-inline-start`,
`padding-block`, `border-inline-start`). Prévoir aussi qu'un texte allemand ou
polonais fait facilement 30 % de plus qu'en français : rien ne doit dépendre
d'une longueur de mot.

Un sélecteur de langue est à concevoir (8 entrées, dans l'en-tête).

### 4.4 Ce qui doit rester lisible sans JavaScript

Le site est rendu côté serveur. Le fil d'onboarding révèle la fiche du module
cliqué par un petit script, mais **les 9 fiches sont dans le HTML** : sans JS,
tout reste lisible à la suite. Une maquette qui suppose un chargement à la
demande, un carrousel obligatoire ou une animation d'entrée bloquante ne
pourra pas être suivie.

Les schémas sont des diagrammes **Mermaid** rendus dans le navigateur : leur
taille exacte n'est pas connue à l'avance. Prévoir un conteneur qui s'adapte,
pas une illustration calibrée au pixel.

---

## 5. Ce que j'attends de la maquette

Par ordre d'utilité :

1. **La page d'accueil complète**, avec les vrais textes de
   `docs/contenu-reel.md`, pas du faux latin.
2. **Le fil d'onboarding**, dans ses deux états : fil seul, et fil avec une
   fiche déployée. Prendre le module à 22 entrées de menu comme cas de test.
3. **La fiche module**, avec captures et sans captures.
4. Les composants isolés : pastille de levier, carte de module, entrée de menu,
   bloc problème, bloc bénéfice, ligne de lien inter-module, vignette de
   capture.

Format : HTML/CSS autonome, comme le bundle Espace Candidat. Je le reprends
ensuite en composants Astro — je n'ai pas besoin que la structure interne soit
réutilisable, seulement que le rendu visuel soit exact et que les contraintes
ci-dessus soient respectées.

---

## 6. Ce que je ne veux pas

- Une seconde palette à côté de celle du design system.
- Une police licenciée qu'il faudrait héberger (Gotham, notamment — elle est
  dans le bundle Espace Candidat, elle n'a pas sa place ici).
- Des icônes d'un jeu propriétaire : le site utilise des noms d'icônes stockés
  en base (`clipboard-check`, `map-pin`, `bar-chart`…), à rendre par un jeu
  libre.
- Des photos de personnes souriantes en réunion.
- Un carrousel obligatoire pour lire une information.
