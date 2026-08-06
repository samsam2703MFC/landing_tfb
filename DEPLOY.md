# Mise en ligne

L'app se déploie **sur le même serveur que MySQL**. Ce n'est pas un choix de confort :
votre base n'écoute qu'en local (phpMyAdmin affiche « Serveur : localhost:3306 », et le
port 3306 est bien fermé depuis l'extérieur). Un hébergeur serverless — Vercel, Netlify —
ne pourrait l'atteindre qu'en exposant MySQL sur Internet. En restant sur le VPS,
`DATABASE_URL` pointe sur `localhost` et la base ne sort jamais de la machine.

Cible : Node ≥ 20, MySQL 8, **Apache 2.4** en frontal (c'est ce qui tourne sur le
serveur — il sert déjà phpMyAdmin sur le 443), systemd pour le service.

## En une commande

```bash
git clone https://github.com/samsam2703MFC/landing_tfb.git /tmp/tfb-src
sudo bash /tmp/tfb-src/deploy/bootstrap.sh
```

Lisez-le d'abord — il tourne en root contre votre base :
`less /tmp/tfb-src/deploy/bootstrap.sh` (dans un terminal à part : `less` dans un
bloc collé avale les lignes suivantes, qui ne s'exécutent alors jamais).

**Ne le téléchargez pas par URL brute si la branche contient un `/`.**
`raw.githubusercontent.com/OWNER/REPO/feat/xxx/...` est ambigu : GitHub lit `feat`
comme branche et renvoie 404. Avec `curl -fsSL`, l'échec est muet et laisse en
place le fichier précédent — vous exécutez alors autre chose que ce script.
Vérification : `grep -q TFB_BOOTSTRAP_MARKER bootstrap.sh && echo ok`.

`deploy/bootstrap.sh` enchaîne les étapes 1 à 6 ci-dessous, puis démarre le service et
vérifie `/api/health`. Il est idempotent : relancez-le pour déployer une mise à jour. Il
refuse de continuer plutôt que d'écraser une base ou une configuration existante. Restent
à votre main : nginx et le certificat (étape 7).

Les étapes détaillées ci-dessous sont l'équivalent manuel, si vous préférez piloter.

## Servir sous un sous-chemin

Pour `https://185.180.206.46/tfb` plutôt que la racine :

```bash
sudo BASE_PATH_CFG=/tfb bash bootstrap.sh
```

`NEXT_PUBLIC_BASE_PATH` est **inlinée au build**, pas lue au démarrage. Trois
conséquences :

- la changer impose un `npm run build`, pas seulement un redémarrage ;
- elle doit être dans l'environnement du **build** — `sudo` purge l'environnement,
  d'où le passage explicite dans les scripts ;
- nginx seul ne suffit pas : sans build correspondant, les assets, les `fetch` et
  les masques d'icônes pointeraient sur la racine du domaine et renverraient 404.

`basePath` ne réécrit que `<Link>`, `next/image` et le routeur. Tout le reste —
`fetch()`, les `<img src>`, le masque CSS des icônes, les URLs de `/api/storage` —
passe par `BASE_PATH` (`src/lib/base-path.ts`).

## 1. Un utilisateur dédié et l'arborescence

```bash
sudo adduser --system --group --home /srv/tfb-landing tfb
sudo mkdir -p /srv/tfb-landing /var/lib/tfb/storage/{screenshots,brands}
sudo chown -R tfb:tfb /srv/tfb-landing /var/lib/tfb/storage
```

`/var/lib/tfb/storage` est hors du dépôt : les uploads survivent aux déploiements, et un
`git pull` ne peut pas les écraser.

## 2. Un compte MySQL pour l'app

N'utilisez pas `root`. Ce compte n'a besoin de rien en dehors de `tfb_landing` :

```sql
CREATE USER 'tfb_app'@'localhost' IDENTIFIED BY 'un-mot-de-passe-long-et-aléatoire';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON tfb_landing.* TO 'tfb_app'@'localhost';
FLUSH PRIVILEGES;
```

Les droits DDL (`CREATE`, `ALTER`, `DROP`) servent aux migrations Prisma. Vous pouvez les
retirer après la première migration et les remettre au moment d'en jouer une nouvelle.

## 3. Le code

```bash
sudo -u tfb git clone https://github.com/samsam2703MFC/landing_tfb.git /srv/tfb-landing
cd /srv/tfb-landing
sudo -u tfb npm ci
```

## 4. Les variables d'environnement

Dans `/etc/tfb-landing.env`, lisible par root seulement — c'est le fichier que systemd
charge, et il contient le mot de passe de la base :

```bash
sudo install -m 600 -o root -g root /dev/null /etc/tfb-landing.env
sudo tee /etc/tfb-landing.env >/dev/null <<'EOF'
DATABASE_URL=mysql://tfb_app:LE-MOT-DE-PASSE@localhost:3306/tfb_landing
ADMIN_SESSION_SECRET=COLLER-ICI-LE-SECRET-GÉNÉRÉ
DEFAULT_LOCALE=fr
STORAGE_PATH=/var/lib/tfb/storage
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
BILLING_SERVICE_URL=
BILLING_SERVICE_TOKEN=
EOF
```

Le secret de session :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Si le mot de passe MySQL contient `@`, `:`, `/` ou `#`, encodez-le en pourcent dans l'URL
(`p@ss` → `p%40ss`), sinon Prisma découpe l'URL au mauvais endroit.

## 5. Le schéma et les données

Prisma lit `.env`, pas le fichier systemd, donc pour ces deux commandes on passe
`DATABASE_URL` à la main :

```bash
cd /srv/tfb-landing
sudo -u tfb DATABASE_URL='mysql://tfb_app:LE-MOT-DE-PASSE@localhost:3306/tfb_landing' \
  npx prisma migrate deploy

sudo -u tfb DATABASE_URL='mysql://...' \
  SEED_ADMIN_EMAIL='vous@franchisebuddy.eu' \
  SEED_ADMIN_PASSWORD='un-mot-de-passe-fort' \
  npm run seed
```

Passez bien `SEED_ADMIN_PASSWORD` : sans lui le seed crée le compte avec
`changeme`.

`migrate deploy` ne joue que les migrations existantes et ne touche à rien d'autre — il ne
supprime aucune table. Le seed est idempotent (upsert sur les clés naturelles), donc le
relancer après des retouches en back office ne casse rien, mais il réécrit les traductions
FR/EN/AR fournies.

## 6. Le build et le service

```bash
cd /srv/tfb-landing
sudo -u tfb npm run build

sudo cp deploy/tfb-landing.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tfb-landing
sudo journalctl -u tfb-landing -f
```

## 7bis. Recette sans nom de domaine

Pour tester tout de suite sur l'IP, un certificat auto-signé suffit :

```bash
sudo bash deploy/selfsigned.sh 185.180.206.46
```

Le navigateur avertit une fois, vous acceptez, et tout fonctionne — **y compris la
connexion au back office**. `Secure` exige du TLS, pas un certificat reconnu.

Si vous testez en **HTTP nu** en revanche, le cookie de session n'est jamais envoyé et la
connexion au back office échoue sans message. Dans ce cas seulement, ajoutez
`ALLOW_INSECURE_COOKIES=true` à `/etc/tfb-landing.env` — et retirez-la dès que HTTPS est
en place, sinon le cookie de session circule en clair.

## 7. Le frontal (Apache)

Apache répond déjà sur le 443. Il lui manque seulement la règle qui envoie
`/tfb` vers l'app :

```bash
sudo bash deploy/apache-attach.sh
```

Le script demande à Apache **quel vhost sert réellement l'IP sur 443**, puis y
insère le proxy. Sur cette machine c'est `000-ip-catchall-ssl.conf`.

Pourquoi pas un vhost séparé : ce fichier déclare déjà `ServerName <IP>`. Apache
retient le **premier** vhost chargé pour un nom donné, et `sites-enabled/*.conf`
se lit par ordre alphabétique — le préfixe `000-` gagne toujours. Un second vhost
avec le même `ServerName` n'est jamais consulté. C'est la raison pour laquelle
un drop-in dans `conf-available/` ne suffisait pas non plus : le vhost par défaut
est une application PHP dont le routage attrape-tout renvoyait le 404.

Le script sauvegarde le fichier, insère un bloc délimité (remplacé et non empilé
si vous relancez), valide avec `configtest`, et restaure automatiquement si la
configuration devient invalide. `sudo bash deploy/apache-attach.sh --remove`
retire le bloc.

Pour un vrai domaine plus tard : `sudo certbot --apache -d votre-domaine.eu`.

`deploy/nginx.conf.example` reste fourni si vous migrez un jour vers nginx.

**Il faut un nom de domaine.** On ne peut pas obtenir de certificat pour une adresse IP
nue — c'est exactement pourquoi `https://185.180.206.46/` affiche une erreur de nom. Et
sans certificat valide, le cookie de session du back office ne peut pas être `Secure`,
ce que le code exige en production.

## 8. Vérifier

Toujours **depuis le serveur d'abord** — ça sépare un problème d'app d'un problème
de proxy :

```bash
curl -sS http://127.0.0.1:3000/tfb/api/health
```

| Réponse | Diagnostic |
| --- | --- |
| `{"ok":true,"db":"up","seeded":true}` | L'app va bien. Un 404 depuis l'extérieur = Apache ne proxifie pas (étape 7). |
| Connexion refusée | L'app ne tourne pas. `systemctl status tfb-landing`, `journalctl -u tfb-landing -n 50`. |
| 404 sur le port 3000 | Buildée sans le sous-chemin. `sudo BASE_PATH_CFG=/tfb bash bootstrap.sh`. |
| `db: "down"` | `DATABASE_URL`, le compte MySQL, ou les droits. |
| `seeded: false` | La base répond mais le seed n'a pas tourné (étape 5). |

Puis depuis l'extérieur : `curl -sk https://185.180.206.46/tfb/api/health`.

Puis à la main :

| À vérifier | Où |
| --- | --- |
| Les 8 langues, et le miroir arabe | `/fr`, `/en`, `/ar` |
| Le repli sur le français | `/nl` — le contenu doit s'afficher en FR |
| Une page module | `/fr/modules/scan` |
| Le formulaire de contact | `/fr#contact`, puis `/admin/messages` |
| La connexion au back office | `/admin/login` |
| L'éditeur de traductions | `/admin/translations` |
| L'upload | `/admin/modules/4` → onglet Screenshots |

L'upload est le seul test qui touche le disque : si le fichier n'apparaît pas, c'est
`ReadWritePaths` dans l'unité systemd ou le propriétaire de `/var/lib/tfb/storage`.

## Déployer une mise à jour

```bash
cd /srv/tfb-landing
sudo -u tfb git pull
sudo -u tfb npm ci
sudo -u tfb DATABASE_URL='mysql://...' npx prisma migrate deploy
sudo -u tfb npm run build
sudo systemctl restart tfb-landing
```

## Déploiement automatique (GitHub Actions)

Les runners GitHub ne sont pas bridés réseau : ils atteignent le VPS en SSH. Une fois le
premier déploiement fait à la main (bootstrap ci-dessus), `.github/workflows/deploy.yml`
prend le relais à chaque `main` vert.

À créer dans **Settings → Secrets and variables → Actions** :

| Secret | Contenu |
| --- | --- |
| `SSH_HOST` | `185.180.206.46` |
| `SSH_USER` | un compte de déploiement, pas root |
| `SSH_KEY` | la clé privée de ce compte, en entier |
| `SSH_KNOWN_HOSTS` | sortie de `ssh-keyscan VOTRE-HOTE` — optionnel mais recommandé |
| `SSH_PORT` | seulement si ce n'est pas 22 |

Et dans l'onglet **Variables** de la même page :

| Variable | Contenu |
| --- | --- |
| `PUBLIC_URL` | l'URL publique, **sous-chemin compris** — `https://panel.tfbuddy.com/tfb` |
| `HEALTH_PATH` | seulement si ce n'est pas `/api/health` |
| `APP_DIR`, `APP_USER` | seulement si ce n'est pas `/srv/tfb-landing` et `tfb` |

`PUBLIC_URL` mérite un mot, parce que son absence a coûté cher. Le déploiement contrôle
la santé de deux façons, et elles ne prouvent pas la même chose :

- **Le contrôle interne** interroge `127.0.0.1:3000` depuis le serveur. Il prouve que
  l'application est bâtie, démarrée, et qu'elle lit la base.
- **Le contrôle public** interroge `PUBLIC_URL` depuis le runner, par l'internet, comme un
  utilisateur. Il prouve que le frontal envoie bien ce chemin vers cette application.

Le second a manqué longtemps. Résultat : des déploiements verts, un service qui tournait
réellement, et une URL publique qui servait **une autre application** — un back office
inatteignable pendant des jours sans qu'une seule alerte ne se déclenche. Le contrôle
compare le corps de la réponse à `"db":"up"`, pas le code HTTP : un `200` prouve que
quelque chose a répondu, cette chaîne prouve que c'est nous.

Sans `PUBLIC_URL`, le déploiement passe mais pose une **annotation d'avertissement** disant
qu'aucune vérification publique n'a eu lieu. Avec, un échec de routage rend le déploiement
rouge — ce qui est le comportement correct : une application que personne n'atteint n'est
pas déployée.

Le compte de déploiement a besoin de `sudo` sans mot de passe sur trois commandes
seulement :

```
deploy ALL=(tfb) NOPASSWD: /usr/bin/git, /usr/bin/npm, /usr/bin/npx
deploy ALL=(root) NOPASSWD: /bin/systemctl restart tfb-landing
```

**Aucun secret applicatif ne va sur GitHub.** Le workflow lit `/etc/tfb-landing.env` sur
le serveur : le runner ne voit jamais l'URL de la base ni les clés Stripe.

## Ce qui restera à faire après cette mise en ligne

- **Stripe.** Tant que les clés sont vides, `/api/checkout` répond `status: "stub"` et le
  webhook refuse tout appel. Voir `src/lib/stripe.ts`. Une fois les clés en place,
  déclarez l'endpoint `https://votre-domaine.eu/api/stripe/webhook` côté Stripe et
  reportez le signing secret dans `STRIPE_WEBHOOK_SECRET`.
- **Le service de facturation.** `BILLING_SERVICE_URL` vide ⇒ les écrans de facturation
  affichent le jeu de démonstration derrière un bandeau, et refusent les actions
  destructives. Rien à changer dans les écrans quand vous le branchez.
- **phpMyAdmin.** Il est actuellement joignable sur le port 443 de l'IP publique.
  Restreignez-le par IP, ou passez-le derrière un tunnel — c'est un accès complet à la
  base exposé sur Internet.
- **Le limiteur de débit** (`/api/contact`, `/api/checkout`, la connexion admin) compte en
  mémoire, donc par processus. Un seul service systemd ⇒ correct. Si vous passez à
  plusieurs instances, déplacez-le vers Redis ou nginx.
- **Les sauvegardes.** `mysqldump tfb_landing` **et** `/var/lib/tfb/storage` : la base ne
  contient que les chemins des fichiers, pas les fichiers.
