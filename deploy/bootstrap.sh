#!/usr/bin/env bash
#
# Installe ou met à jour la landing TFB + le back office sur ce serveur.
#
# À lancer EN ROOT, SUR LE VPS qui héberge MySQL :
#
#   curl -fsSL https://raw.githubusercontent.com/samsam2703MFC/tfb/main/deploy/bootstrap.sh -o bootstrap.sh
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
# Sous-chemin de service. Vide = racine.  BASE_PATH_CFG=/tfb pour un sous-chemin.
BASE_PATH_CFG="${BASE_PATH_CFG:-}"

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()   { printf '   \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '   \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# Coller un bloc de commandes envoie les lignes suivantes dans la première
# invite rencontrée : elles deviennent la réponse. On vide ce qui traîne avant
# de demander quoi que ce soit.
drain() { local junk; while IFS= read -r -t 0.05 junk 2>/dev/null; do :; done; }

# Un identifiant MySQL ne contient ni espace ni métacaractère de shell. Si c'en
# est un, c'est une ligne collée par erreur, pas une réponse.
valid_ident() { [ -n "$1" ] && ! printf '%s' "$1" | grep -qE '[[:space:]&;|<>$`]'; }

ask() {  # ask VAR "invite" [valeur par défaut]
  local __var="$1" __prompt="$2" __default="${3:-}" __in
  while :; do
    drain
    read -rp "$__prompt" __in || die "Saisie interrompue."
    [ -z "$__in" ] && __in="$__default"
    if valid_ident "$__in"; then printf -v "$__var" '%s' "$__in"; return 0; fi
    warn "« $__in » n'est pas un identifiant valide — ligne collée par erreur ?"
  done
}

ask_secret() {  # ask_secret VAR "invite"
  local __var="$1" __prompt="$2" __in
  drain
  read -rsp "$__prompt" __in || die "Saisie interrompue."
  echo
  [ -n "$__in" ] || die "Mot de passe vide."
  printf -v "$__var" '%s' "$__in"
}

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

# --- 2. Accès administrateur MySQL ------------------------------------------
say "Accès MySQL"

# `mysqladmin ping` répond « alive » même quand l'authentification échoue : il
# ne prouve donc rien. Seule une vraie requête le fait.
MYSQL_DEFAULTS=""
cleanup() { [ -n "$MYSQL_DEFAULTS" ] && rm -f "$MYSQL_DEFAULTS"; }
trap cleanup EXIT

mysql_admin() {
  if [ -n "$MYSQL_DEFAULTS" ]; then mysql --defaults-file="$MYSQL_DEFAULTS" "$@"
  else mysql "$@"; fi
}

if mysql -N -B -e 'SELECT 1' >/dev/null 2>&1; then
  ok "connexion administrateur sans mot de passe (auth socket)"
else
  warn "MySQL demande une authentification."
  ask MYSQL_ADMIN_USER "   Utilisateur administrateur MySQL [root] : " root
  ask_secret MYSQL_ADMIN_PASS "   Mot de passe de '$MYSQL_ADMIN_USER' : "

  # Fichier d'options plutôt que --password= : un mot de passe en argument est
  # lisible par tout le monde dans `ps`.
  MYSQL_DEFAULTS="$(mktemp)"; chmod 600 "$MYSQL_DEFAULTS"
  printf '[client]\nuser=%s\npassword=%s\n' "$MYSQL_ADMIN_USER" "$MYSQL_ADMIN_PASS" > "$MYSQL_DEFAULTS"
  unset MYSQL_ADMIN_PASS

  mysql_admin -N -B -e 'SELECT 1' >/dev/null 2>&1 \
    || die "Authentification MySQL refusée pour '$MYSQL_ADMIN_USER'."
  ok "connexion administrateur en tant que '$MYSQL_ADMIN_USER'"
fi

# Échappe une valeur pour un littéral SQL entre apostrophes.
sql_quote() { printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e "s/'/\\\\'/g"; }

# --- 3. Base de données -----------------------------------------------------
say "Base de données"

# Distinguer « la requête a échoué » de « la base est absente » : les confondre
# envoie créer une base qui existe déjà.
if ! DB_LIST="$(mysql_admin -N -B -e "SHOW DATABASES LIKE '${DB_NAME}'" 2>&1)"; then
  die "Impossible d'interroger MySQL : ${DB_LIST}"
fi

if [ -z "$DB_LIST" ]; then
  # utf8mb4 n'est pas un détail : l'arabe et les emoji des messages de contact
  # ne rentrent pas dans latin1.
  mysql_admin -e "CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
  ok "Base ${DB_NAME} créée (utf8mb4)"
else
  ok "Base ${DB_NAME} présente"
fi

# --- 4. Secrets et compte applicatif ----------------------------------------
say "Secrets"

# Renvoie non-zéro au lieu d'abandonner : le compte administrateur d'un
# hébergement mutualisé n'a généralement pas GRANT OPTION.
ensure_db_user() {
  local user="$1" pass="$2"
  local u p
  u="$(sql_quote "$user")"; p="$(sql_quote "$pass")"
  # CREATE IF NOT EXISTS puis ALTER : un compte préexistant avec un autre mot de
  # passe est resynchronisé sur celui du fichier d'env, sinon l'app ne se
  # connecterait jamais et l'erreur serait cherchée ailleurs.
  mysql_admin <<SQL
CREATE USER IF NOT EXISTS '${u}'@'localhost' IDENTIFIED BY '${p}';
ALTER USER '${u}'@'localhost' IDENTIFIED BY '${p}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
  ON \`${DB_NAME}\`.* TO '${u}'@'localhost';
FLUSH PRIVILEGES;
SQL
}

if [ -f "$ENV_FILE" ]; then
  ok "$ENV_FILE existe déjà, il est conservé tel quel"
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
  [ -n "${DATABASE_URL:-}" ] || die "$ENV_FILE ne définit pas DATABASE_URL."

  # Le fichier a pu être écrit lors d'un passage qui a échoué juste après :
  # on réaligne le compte MySQL sur ce qu'il contient plutôt que de laisser
  # l'incohérence en place.
  URL_USER="$(DATABASE_URL="$DATABASE_URL" node -e 'process.stdout.write(decodeURIComponent(new URL(process.env.DATABASE_URL).username))')"
  URL_PASS="$(DATABASE_URL="$DATABASE_URL" node -e 'process.stdout.write(decodeURIComponent(new URL(process.env.DATABASE_URL).password))')"
  if ensure_db_user "$URL_USER" "$URL_PASS" 2>/tmp/.tfbgrant; then
    ok "compte '${URL_USER}'@'localhost' aligné sur $ENV_FILE"
  else
    warn "création/modification du compte impossible : $(tail -1 /tmp/.tfbgrant)"
    warn "On vérifie plus bas si un compte utilisable existe déjà."
  fi
  rm -f /tmp/.tfbgrant
  unset URL_PASS
else
  warn "$ENV_FILE est absent, on le crée."

  # Jamais en argument : un mot de passe dans argv est visible dans `ps` et
  # reste dans l'historique du shell.
  ask_secret DB_PASSWORD "   Mot de passe à créer pour l'utilisateur MySQL '$DB_USER' : "
  ask_secret ADMIN_PASSWORD "   Mot de passe du compte back office à créer : "
  ask ADMIN_EMAIL "   E-mail du compte back office : "

  # Le compte d'abord : si cette étape échoue, aucun fichier n'est écrit et le
  # relancer repart d'un état propre.
  if ensure_db_user "$DB_USER" "$DB_PASSWORD" 2>/tmp/.tfbgrant; then
    ok "compte '${DB_USER}'@'localhost' créé, limité à ${DB_NAME}"
  else
    rm -f /tmp/.tfbgrant
    die "Impossible de créer '${DB_USER}' — le compte administrateur n'a pas ce droit.
   Créez l'utilisateur dans phpMyAdmin avec tous les droits sur ${DB_NAME},
   puis relancez en le désignant :  DB_USER=le_compte bash bootstrap.sh"
  fi
  rm -f /tmp/.tfbgrant

  SESSION_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  # Encodage pourcent : un mot de passe contenant @ : / # ? casserait l'URL.
  DB_PASSWORD_ENC="$(DB_PASSWORD="$DB_PASSWORD" node -e 'process.stdout.write(encodeURIComponent(process.env.DB_PASSWORD))')"

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
  unset DB_PASSWORD DB_PASSWORD_ENC
fi

# Vérifie que l'app peut réellement se connecter, avant de construire quoi que ce soit.
set -a; . "$ENV_FILE"; set +a

db_can_connect() {
  local f; f="$(mktemp)"; chmod 600 "$f"
  printf '[client]\nuser=%s\npassword=%s\n' "$1" "$2" > "$f"
  local rc=0
  mysql --defaults-file="$f" -N -B -e "USE \`${DB_NAME}\`; SELECT 1" >/dev/null 2>&1 || rc=1
  rm -f "$f"
  return $rc
}

read_url_part() {
  DATABASE_URL="$DATABASE_URL" node -e "process.stdout.write(decodeURIComponent(new URL(process.env.DATABASE_URL).$1))" 2>/dev/null
}
APP_DB_USER="$(read_url_part username)" || die "DATABASE_URL est mal formée dans $ENV_FILE."
APP_DB_PASS="$(read_url_part password)"

if db_can_connect "$APP_DB_USER" "$APP_DB_PASS"; then
  ok "l'application peut se connecter en tant que '${APP_DB_USER}'"
else
  warn "Le compte '${APP_DB_USER}' ne peut pas ouvrir ${DB_NAME}."
  echo "   Indiquez un compte MySQL qui a déjà les droits sur ${DB_NAME}"
  echo "   (celui de phpMyAdmin convient). DATABASE_URL sera réécrite."
  ask NEW_DB_USER "   Utilisateur [${MYSQL_ADMIN_USER:-$APP_DB_USER}] : " "${MYSQL_ADMIN_USER:-$APP_DB_USER}"
  ask_secret NEW_DB_PASS "   Mot de passe de '$NEW_DB_USER' : "

  db_can_connect "$NEW_DB_USER" "$NEW_DB_PASS" \
    || die "'${NEW_DB_USER}' ne peut pas ouvrir ${DB_NAME} non plus. Vérifiez les droits dans phpMyAdmin."

  NEW_ENC="$(NEW_DB_PASS="$NEW_DB_PASS" node -e 'process.stdout.write(encodeURIComponent(process.env.NEW_DB_PASS))')"
  NEW_URL="mysql://${NEW_DB_USER}:${NEW_ENC}@localhost:3306/${DB_NAME}"
  # Réécriture ciblée de la seule ligne DATABASE_URL, le reste du fichier est
  # conservé (secret de session, clés Stripe déjà saisies...).
  NEW_URL="$NEW_URL" python3 - "$ENV_FILE" <<'PYENV'
import os, sys, pathlib
p = pathlib.Path(sys.argv[1])
lines = p.read_text().splitlines(keepends=True)
out = [("DATABASE_URL=" + os.environ["NEW_URL"] + "\n") if l.startswith("DATABASE_URL=") else l for l in lines]
p.write_text("".join(out))
PYENV
  set -a; . "$ENV_FILE"; set +a
  ok "DATABASE_URL réécrite pour '${NEW_DB_USER}'"
  unset NEW_DB_PASS NEW_ENC
fi
unset APP_DB_PASS

# Une table tfb_ déjà là sans historique de migration = schéma posé autrement.
# On s'arrête : appliquer la migration par-dessus échouerait à mi-chemin.
EXISTING="$(mysql_admin -N -B -e \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name LIKE 'tfb\\_%'")"
MIGRATED="$(mysql_admin -N -B -e \
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

# Une branche sans le code (par ex. un `main` encore vide) produit un checkout
# vide, et `npm ci` échoue alors sur un message qui parle de lockfile — on
# cherche le problème au mauvais endroit. On le nomme ici.
if [ ! -f "$APP_DIR/package.json" ]; then
  die "La branche « $BRANCH » ne contient pas l'application ($APP_DIR/package.json absent).
   Si la pull request n'est pas encore fusionnée, main est vide. Relancez en
   désignant la branche de travail :
     sudo BRANCH=deploy-test BASE_PATH_CFG=${BASE_PATH_CFG:-/tfb} bash $0"
fi
[ -f "$APP_DIR/package-lock.json" ] \
  || die "package-lock.json absent sur « $BRANCH » — npm ci ne peut pas fonctionner."

# Plusieurs minutes sur une petite machine, avec un curseur qui tourne sans
# rien afficher. Le dire évite un Ctrl+C sur une étape qui se déroulait bien.
echo "   Installation des dépendances — 1 à 5 min, ne pas interrompre…"
sudo -u "$APP_USER" npm ci --no-audit --no-fund
ok "dépendances installées"

# --- 6. Migration et seed ---------------------------------------------------
say "Migration"

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

sudo -u "$APP_USER" DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy
ok "schéma à jour"

SEEDED="$(mysql_admin -N -B -e "SELECT COUNT(*) FROM \`${DB_NAME}\`.tfb_languages" 2>/dev/null || echo 0)"
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

  1. Apache — la règle qui envoie ${NEXT_PUBLIC_BASE_PATH:-/} vers l'app :

       sudo cp $APP_DIR/deploy/apache-landing_tfb.conf \\
              /etc/apache2/conf-available/landing_tfb.conf
       sudo a2enmod proxy proxy_http headers
       sudo a2enconf landing_tfb
       sudo apache2ctl configtest && sudo systemctl reload apache2

     Ce sont des directives Apache : elles vont dans un fichier, elles ne se
     tapent pas dans le shell. Le fichier atterrit dans conf-available/, donc
     votre vhost existant n'est pas modifié.

  2. Restreindre phpMyAdmin : il est actuellement joignable depuis Internet,
     et c'est un accès complet à la base.

  3. Sauvegardes : mysqldump ${DB_NAME} ET ${STORAGE_DIR}. La base ne contient
     que les chemins des fichiers, pas les fichiers.

  Journal en direct :  journalctl -u tfb-landing -f
  Redéployer        :  sudo BRANCH=$BRANCH BASE_PATH_CFG=${NEXT_PUBLIC_BASE_PATH:-} \\
                            bash $APP_DIR/deploy/bootstrap.sh

EOF
