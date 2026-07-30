# Mise en ligne

L'app se déploie **sur le même serveur que MySQL**. Ce n'est pas un choix de confort :
votre base n'écoute qu'en local (phpMyAdmin affiche « Serveur : localhost:3306 », et le
port 3306 est bien fermé depuis l'extérieur). Un hébergeur serverless — Vercel, Netlify —
ne pourrait l'atteindre qu'en exposant MySQL sur Internet. En restant sur le VPS,
`DATABASE_URL` pointe sur `localhost` et la base ne sort jamais de la machine.

Cible : Node ≥ 20, MySQL 8, nginx en frontal, systemd pour le service.

## En une commande

```bash
curl -fsSL https://raw.githubusercontent.com/samsam2703MFC/landing_tfb/main/deploy/bootstrap.sh -o bootstrap.sh
less bootstrap.sh          # lisez-le avant de l'exécuter
sudo bash bootstrap.sh
```

`deploy/bootstrap.sh` enchaîne les étapes 1 à 6 ci-dessous, puis démarre le service et
vérifie `/api/health`. Il est idempotent : relancez-le pour déployer une mise à jour. Il
refuse de continuer plutôt que d'écraser une base ou une configuration existante. Restent
à votre main : nginx et le certificat (étape 7).

Les étapes détaillées ci-dessous sont l'équivalent manuel, si vous préférez piloter.

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

## 7. Le frontal et le certificat

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/tfb-landing
# éditez server_name
sudo ln -s /etc/nginx/sites-available/tfb-landing /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d votre-domaine.eu -d www.votre-domaine.eu
```

**Il faut un nom de domaine.** On ne peut pas obtenir de certificat pour une adresse IP
nue — c'est exactement pourquoi `https://185.180.206.46/` affiche une erreur de nom. Et
sans certificat valide, le cookie de session du back office ne peut pas être `Secure`,
ce que le code exige en production.

## 8. Vérifier

```bash
curl -s https://votre-domaine.eu/api/health
# {"ok":true,"db":"up","seeded":true}
```

- `db: "down"` → `DATABASE_URL`, le compte MySQL, ou les droits.
- `seeded: false` → la base répond mais le seed n'a pas tourné (étape 5).

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
