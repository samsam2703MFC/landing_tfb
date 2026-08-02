# Les audits de mise en page

Cinq contrôles qui regardent la console **rendue dans un vrai navigateur**,
plutôt que le CSS qui est censé la produire. Ils existent parce que chacun a
été écrit après avoir raté un défaut à l'œil : une bande encadrée collée au
bord d'un bloc, six pastilles débordant sur le champ voisin, des saisies qui
ne partaient pas du même trait.

Ils ne remplacent pas le regard. Ils empêchent seulement de refaire deux fois
la même erreur.

## Lancer

Il faut un serveur en marche et le mot de passe de la console :

```bash
cd outils
npm install playwright     # une fois — Chromium est déjà là sur le serveur d'intégration
node marge.mjs        http://127.0.0.1:4321/landing_tfb motdepasse
node air.mjs          http://127.0.0.1:4321/landing_tfb motdepasse
node ux.mjs           http://127.0.0.1:4321/landing_tfb motdepasse
node collisions.mjs   http://127.0.0.1:4321/landing_tfb motdepasse 1280
node respiration.mjs  http://127.0.0.1:4321/landing_tfb motdepasse 1600
```

`collisions.mjs` et `respiration.mjs` prennent une largeur d'écran en dernier
argument : une grille qui tient à 1600 px se tasse à 1280.

## Ce que chacun cherche

| Outil | La question |
| --- | --- |
| `marge.mjs` | Qu'est-ce qui touche le bord de son bloc ? |
| `air.mjs` | Reste-t-il de l'espace entre un formulaire et le bouton qui le referme ? |
| `ux.mjs` | Un formulaire sans bouton, un bouton sans type, une suppression sans confirmation |
| `collisions.mjs` | Deux colonnes qui se recouvrent · des saisies qui ne partent pas du même trait |
| `respiration.mjs` | Un texte trop près du bord de sa surface · deux blocs empilés sans intervalle |

## Ce qu'ils ne savent pas faire

**`respiration.mjs` crie parfois au loup.** Sa mesure « contre un voisin »
compare le contenu le plus bas du premier bloc au contenu le plus haut du
second ; quand un élément imbriqué déborde sa propre boîte, elle annonce un
écart nul là où l'écran en montre trente. Mesurez au pixel avant de corriger —
modifier le CSS pour faire taire l'outil abîmerait une mise en page correcte.
Sa mesure « contre un bord », elle, compare deux boîtes dont l'une contient
l'autre : celle-là est fiable. Elle a d'ailleurs trouvé seule ce qu'aucun des
quatre autres ne voyait — la console ne chargeait pas le `box-sizing` du
design system, et tout champ à cent pour cent de sa colonne débordait de son
bloc par la droite. Quand elle signale quelque chose, mesurez avant de
conclure au faux positif : c'est arrivé qu'on lui donne tort à tort.

**Aucun ne juge du goût.** Ils disent qu'une chose en touche une autre, jamais
qu'elle est laide au bon endroit.
