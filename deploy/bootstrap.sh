#!/usr/bin/env bash
#
# Installe ou met à jour la landing TFB + le back office sur ce serveur.
#
# À lancer EN ROOT, SUR LE VPS qui héberge MySQL :
#
#   curl -fsSL https://raw.githubusercontent.com/samsam2703MFC/landing_tfb/main/deploy/bootstrap.sh -o bootstrap.sh
#   less bootstrap.sh          # lisez-le avant de l'exécuter
#   sudo bash bootstrap.sh
#
# Idempotent : relancez-le pour déployer une mise à jour. Il ne détruit rien —
# il refuse de continuer plutôt que d'écraser une base ou une configuration
# existante.
#
set -euo pipefail

# Marqueur d'identité : TFB_BOOTSTRAP_MARKER
# Un `curl -fsSL -o bootstrap.sh` qui échoue n'écrit rien et laisse le fichier
# précédent en place — on croit lancer ce script et on en lance un autre.
# Vérifiez avant d'exécuter :  grep -q TFB_BOOTSTRAP_MARKER bootstrap.sh && echo ok

# --- Réglages ---------------------------------------------------------------
REPO="${REPO:-https://github.com/samsam2703MFC/landing_tfb.git}"
BRANCH="${BRANCH:-main}"
APP_DIR="${APP_DIR:-/srv/tfb-landing}"
STORAGE_DIR="${STORAGE_DIR:-/var/lib/tfb/storage}"
ENV_FILE="${ENV_FILE:-/etc/tfb-landing.env}"
APP_USER="${APP_USER:-tfb}"
DB_NAME="${DB_NAME:-tfb_landing}"
DB_USER="${DB_USER:-tfb_app}"
PORT="${PORT:-3000}"
# Sous-chemin de service. Vide = racine.  BASE_PATH_CFG=/landing_tfb pour un sous-chemin.
BASE_PATH_CFG="${BASE_PATH_CFG:-}"

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()   { printf '   \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '   \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "À lancer en root (sudo bash $0)."

# --- 1. Préalables ----------------------------------------------------------
say "Vérification des préalables"

command -v git  >/dev/null || die "git n'est pas installé.  apt install git"
command -v node >/dev/null || die "node n'est pas installé. Node 20 ou plus est requis."
command -v npm  >/dev/null || die "npm n'est pas installé."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 20 ] || die "Node $NODE_MAJOR détecté, 20 minimum requis."
ok "node $(node -v)"

command -v mysql >/dev/null || die "Le client mysql est absent. L'app doit tourner sur le serveur de la base."
mysqladmin ping --silent 2>/dev/null || die "MySQL ne répond pas en local."
ok "MySQL joignable en localhost"

# --- 2. Secrets -------------------------------------------------------------
say "Secrets"

if [ -f "$ENV_FILE" ]; then
  ok "$ENV_FILE existe déjà, il est conservé tel quel"
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
  [ -n "${DATABASE_URL:-}" ] || die "$ENV_FILE ne définit pas DATABASE_URL."
else
  warn "$ENV_FILE est absent, on le crée."

  # Le mot de passe n'est jamais affiché ni passé en argument : il resterait
  # visible dans l'historique du shell et dans la liste des processus.
  read -rsp "   Mot de passe pour l'utilisateur MySQL '$DB_USER' : " DB_PASSWORD; echo
  [ -n "$DB_PASSWORD" ] || die "Mot de passe vide."
  read -rsp "   Mot de passe du compte back office à créer : " ADMIN_PASSWORD; echo
  [ -n "$ADMIN_PASSWORD" ] || die "Mot de passe vide."
  read -rp  "   E-mail du compte back office : " ADMIN_EMAIL
  [ -n "$ADMIN_EMAIL" ] || die "E-mail vide."

  SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"

  # Encodage pourcent : un mot de passe contenant @ : / # ? casserait l'URL.
  DB_PASSWORD_ENC="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$DB_PASSWORD")"

  install -m 600 -o root -g root /dev/null "$ENV_FILE"
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=mysql://${DB_USER}:${DB_PASSWORD_ENC}@localhost:3306/${DB_NAME}
ADMIN_SESSION_SECRET=${SESSION_SECRET}
DEFAULT_LOCALE=fr
STORAGE_PATH=${STORAGE_DIR}
NEXT_PUBLIC_BASE_PATH=${BASE_PATH_CFG}
PORT=${PORT}

# Stripe — vide = /api/checkout répond "stub" et le webhook refuse tout appel.
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Service de facturation — vide = écrans de démonstration, actions destructives refusées.
BILLING_SERVICE_URL=
BILLING_SERVICE_TOKEN=
EOF
  ok "$ENV_FILE écrit (0600, root)"

  say "Compte MySQL"
  if mysql -N -B -e "SELECT 1 FROM mysql.user WHERE user='${DB_USER}' AND host='localhost'" | grep -q 1; then
    ok "L'utilisateur '${DB_USER}'@'localhost' existe déjà, il n'est pas modifié"
  else
    mysql <<SQL
CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
    ok "Utilisateur '${DB_USER}'@'localhost' créé, limité à ${DB_NAME}"
  fi
  unset DB_PASSWORD DB_PASSWORD_ENC
fi

# --- 3. Base de données -----------------------------------------------------
say "Base de données"

mysql -N -B -e "SHOW DATABASES LIKE '${DB_NAME}'" | grep -q "${DB_NAME}" \
  || die "La base ${DB_NAME} n'existe pas. Créez-la d'abord."
ok "Base ${DB_NAME} présente"

# Une table tfb_ déjà là sans historique de migration = schéma posé autrement.
# On s'arrête : appliquer la migration par-dessus échouerait à mi-chemin.
EXISTING="$(mysql -N -B -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name LIKE 'tfb\\_%'")"
MIGRATED="$(mysql -N -B -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name='_prisma_migrations'")"

if [ "$EXISTING" -gt 0 ] && [ "$MIGRATED" -eq 0 ]; then
  die "${DB_NAME} contient déjà ${EXISTING} table(s) tfb_ mais aucun historique Prisma.
   Le schéma a été posé autrement. Sauvegardez, puis soit vous videz ces tables,
   soit vous marquez la migration comme déjà appliquée :
     npx prisma migrate resolve --applied 20260730000000_init"
fi
[ "$EXISTING" -eq 0 ] && ok "Base vide, la migration va créer les tables" \
                      || ok "${EXISTING} table(s) tfb_ déjà migrées"

# --- 4. Utilisateur système et dossiers -------------------------------------
say "Utilisateur système et dossiers"

id "$APP_USER" >/dev/null 2>&1 || adduser --system --group --home "$APP_DIR" "$APP_USER"
ok "utilisateur $APP_USER"

mkdir -p "$APP_DIR" "$STORAGE_DIR/screenshots" "$STORAGE_DIR/brands"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$STORAGE_DIR"
ok "$APP_DIR et $STORAGE_DIR (hors du dépôt : les uploads survivent aux déploiements)"

# --- 5. Code ----------------------------------------------------------------
say "Code — branche $BRANCH"

if [ -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch origin "$BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" checkout "$BRANCH"
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$BRANCH"
  ok "mis à jour sur $(sudo -u "$APP_USER" git -C "$APP_DIR" rev-parse --short HEAD)"
else
  sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
  ok "cloné"
fi

cd "$APP_DIR"
sudo -u "$APP_USER" npm ci
ok "dépendances installées"

# --- 6. Migration et seed ---------------------------------------------------
say "Migration"

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

sudo -u "$APP_USER" DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy
ok "schéma à jour"

SEEDED="$(mysql -N -B -e "SELECT COUNT(*) FROM \`${DB_NAME}\`.tfb_languages" 2>/dev/null || echo 0)"
if [ "$SEEDED" -eq 0 ]; then
  say "Données initiales"
  sudo -u "$APP_USER" \
    DATABASE_URL="$DATABASE_URL" \
    SEED_ADMIN_EMAIL="${ADMIN_EMAIL:-admin@franchisebuddy.eu}" \
    SEED_ADMIN_PASSWORD="${ADMIN_PASSWORD:-}" \
    npm run seed
  ok "8 langues, 8 sections, 6 enseignes, 7 modules, 3 plans, traductions FR/EN/AR"
else
  ok "Base déjà peuplée (${SEEDED} langues) — le seed n'est pas rejoué"
fi
unset ADMIN_PASSWORD

# --- 7. Build ---------------------------------------------------------------
say "Build"
sudo -u "$APP_USER" NEXT_PUBLIC_BASE_PATH="${NEXT_PUBLIC_BASE_PATH:-}" npm run build
ok "build de production"

# --- 8. Service -------------------------------------------------------------
say "Service systemd"
cp "$APP_DIR/deploy/tfb-landing.service" /etc/systemd/system/tfb-landing.service
systemctl daemon-reload
systemctl enable tfb-landing >/dev/null 2>&1 || true
systemctl restart tfb-landing
ok "tfb-landing démarré"

# --- 9. Contrôle ------------------------------------------------------------
say "Contrôle"
for i in $(seq 1 20); do
  sleep 1
  HEALTH="$(curl -fsS "http://127.0.0.1:${PORT}${NEXT_PUBLIC_BASE_PATH:-}/api/health" 2>/dev/null || true)"
  [ -n "$HEALTH" ] && break
  [ "$i" -eq 20 ] && die "L'app ne répond pas. Journal :  journalctl -u tfb-landing -n 50"
done

echo "   $HEALTH"
case "$HEALTH" in
  *'"db":"up"'*'"seeded":true'*) ok "L'app tourne et lit la base" ;;
  *'"seeded":false'*) warn "Base joignable mais vide — relancez le seed." ;;
  *) warn "Réponse inattendue — voir journalctl -u tfb-landing" ;;
esac

cat <<EOF

$(printf '\033[1m== Il reste à faire à la main ==\033[0m')

  1. nginx en frontal, puis un certificat :
       cp $APP_DIR/deploy/nginx.conf.example /etc/nginx/sites-available/tfb-landing
       # remplacez server_name par votre domaine
       ln -s /etc/nginx/sites-available/tfb-landing /etc/nginx/sites-enabled/
       nginx -t && systemctl reload nginx
       certbot --nginx -d VOTRE-DOMAINE

     Un certificat ne peut pas être émis pour une IP nue. Sans HTTPS valide,
     le cookie de session du back office ne peut pas être Secure.

  2. Restreindre phpMyAdmin : il est actuellement joignable depuis Internet.

  3. Sauvegardes : mysqldump ${DB_NAME} ET ${STORAGE_DIR}. La base ne contient
     que les chemins des fichiers, pas les fichiers.

  Journal en direct :  journalctl -u tfb-landing -f
  Redéployer        :  sudo bash $APP_DIR/deploy/bootstrap.sh

EOF
