#!/usr/bin/env bash
#
# Insère le proxy de la landing DANS le vhost qui sert déjà l'IP.
#
#   sudo bash /srv/tfb-landing/deploy/apache-attach.sh
#
# Pourquoi pas un vhost à part : `apache2ctl -S` montre que
# 000-ip-catchall-ssl.conf revendique déjà ServerName <IP> sur le 443. Apache
# retient le premier vhost chargé pour un même nom, et sites-enabled/*.conf se
# lit par ordre alphabétique : le préfixe 000- gagne toujours. Un second vhost
# avec le même ServerName ne sera jamais consulté.
#
# Sûr : sauvegarde horodatée, bloc délimité et idempotent, `configtest` avant
# rechargement, restauration automatique si la configuration devient invalide.
#
# Retirer :  sudo bash apache-attach.sh --remove
#
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/tfb-landing.env}"
PORT="${PORT:-3000}"
IP="${IP:-185.180.206.46}"
REMOVE=0
[ "${1:-}" = "--remove" ] && REMOVE=1

ok()   { printf '   \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '   \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || die "À lancer en root."

BASE=""
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; BASE="${NEXT_PUBLIC_BASE_PATH:-}"; }
[ -n "$BASE" ] || die "NEXT_PUBLIC_BASE_PATH est vide dans $ENV_FILE."

say "Vhost qui sert l'IP sur 443"
# On demande à Apache lui-même quel fichier il retient, plutôt que de deviner.
TARGET="$(apache2ctl -S 2>/dev/null \
  | grep -E "port 443 namevhost ${IP}" \
  | head -1 \
  | sed -E 's/.*\(([^:]+):[0-9]+\).*/\1/')"

[ -n "$TARGET" ] && [ -f "$TARGET" ] || die "Impossible d'identifier le vhost 443 pour ${IP}."
ok "$TARGET"

# Notre vhost concurrent n'a jamais pu servir : deux ServerName identiques
# rendent surtout le diagnostic confus.
if [ -e /etc/apache2/sites-enabled/landing_tfb-ip.conf ]; then
  a2dissite landing_tfb-ip >/dev/null
  ok "vhost concurrent landing_tfb-ip désactivé"
fi

BACKUP="${TARGET}.bak.$(date +%Y%m%d%H%M%S)"
cp -a "$TARGET" "$BACKUP"
ok "sauvegarde : $BACKUP"

say "Insertion"
BASE="$BASE" PORT="$PORT" REMOVE="$REMOVE" python3 - "$TARGET" <<'PY'
import os, re, sys, pathlib

path = pathlib.Path(sys.argv[1])
base, port, remove = os.environ["BASE"], os.environ["PORT"], os.environ["REMOVE"] == "1"
BEGIN, END = "# >>> TFB landing >>>", "# <<< TFB landing <<<"

lines = path.read_text().splitlines(keepends=True)

# Retire un bloc précédent : le script doit pouvoir être relancé sans empiler.
out, skipping = [], False
for line in lines:
    if BEGIN in line:
        skipping = True
        continue
    if END in line:
        skipping = False
        continue
    if not skipping:
        out.append(line)

if remove:
    path.write_text("".join(out))
    print("   bloc retiré")
    sys.exit(0)

block = f"""    {BEGIN}
    # Proxy vers l'application Next (systemd: tfb-landing).
    # Les deux côtés portent le préfixe : l'app est buildée avec ce basePath et
    # attend le chemin complet, sans réécriture.
    ProxyPreserveHost On
    ProxyTimeout 120
    ProxyPass        {base}  http://127.0.0.1:{port}{base}
    ProxyPassReverse {base}  http://127.0.0.1:{port}{base}
    <Location {base}>
        Require all granted
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Forwarded-Port  "443"
    </Location>
    <Location {base}/admin>
        Header always set X-Robots-Tag "noindex, nofollow"
    </Location>
    {END}
"""

# Insérer avant la fermeture du VirtualHost qui écoute sur 443.
depth_open = None
inserted = False
result = []
for line in out:
    stripped = line.strip()
    if stripped.lower().startswith("<virtualhost"):
        depth_open = ":443" in stripped or stripped.endswith("443>")
    if stripped.lower().startswith("</virtualhost") and depth_open and not inserted:
        result.append(block)
        inserted = True
        depth_open = None
    result.append(line)

if not inserted:
    sys.exit("   Aucun <VirtualHost ...:443> trouvé dans le fichier.")

path.write_text("".join(result))
print("   bloc inséré avant </VirtualHost>")
PY

say "Validation"
if ! apache2ctl configtest 2>&1 | tail -2; then
  cp -a "$BACKUP" "$TARGET"
  die "Configuration invalide — $TARGET restauré depuis la sauvegarde."
fi
if ! apache2ctl configtest >/dev/null 2>&1; then
  cp -a "$BACKUP" "$TARGET"
  die "Configuration invalide — $TARGET restauré depuis la sauvegarde."
fi
systemctl reload apache2
ok "Apache rechargé"

[ "$REMOVE" = "1" ] && { ok "Proxy retiré."; exit 0; }

say "Vérification"
echo "   app directe : $(curl -sS "http://127.0.0.1:${PORT}${BASE}/api/health" 2>&1 || true)"
VIA="$(curl -skS "https://${IP}${BASE}/api/health" 2>&1 | head -c 200 || true)"
echo "   via Apache  : ${VIA}"

case "$VIA" in
  *'"db":"up"'*)
    printf '\n\033[32m   En ligne : https://%s%s/fr\033[0m\n\n' "$IP" "$BASE"
    echo "   Le navigateur avertira sur le certificat — acceptez une fois."
    echo "   Pour revenir en arrière :  sudo bash $0 --remove"
    ;;
  *)
    warn "Toujours pas. Le vhost modifié est $TARGET."
    echo "   Cherchez une RewriteRule qui passe devant le proxy :"
    echo "     grep -n 'Rewrite' $TARGET"
    echo "   Restauration :  sudo cp -a $BACKUP $TARGET && sudo systemctl reload apache2"
    ;;
esac
