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

# Quelqu'un d'autre revendique-t-il déjà ce sous-chemin ?
#
# Apache retient le PREMIER ProxyPass/Alias qui correspond, dans l'ordre
# d'apparition. Ce script insère son bloc juste avant </VirtualHost>, donc en
# dernier : une règle préexistante sur le même chemin gagne toujours, et le bloc
# inséré ne sert jamais. Le script se contentait alors de constater l'échec et
# d'envoyer chercher une RewriteRule — une piste fausse quand le coupable est un
# ProxyPass concurrent.
#
# -R et non -r : sites-enabled/ ne contient QUE des liens symboliques vers
# sites-available/, et `grep -r` les ignore lors du parcours d'un répertoire. Un
# `grep -rn` sur sites-enabled/ ne renvoie donc jamais rien, quoi que contiennent
# les vhosts — un faux négatif silencieux qui a fait conclure à tort qu'aucune
# règle n'existait.
if [ "$REMOVE" != "1" ]; then
  # Le motif est ancré sur le PREMIER argument de la directive — le chemin
  # d'URL — et non sur la ligne entière. Sans cette ancre, `Alias /kitchen
  # /var/www/html/tfb/kitchen/public` est signalé comme un conflit sur /tfb :
  # le préfixe apparaît dans la destination, sur le disque, où il ne veut rien
  # dire. Un détecteur qui crie au loup sur la moitié des vhosts d'une machine
  # partagée est un détecteur qu'on désactive.
  CONFLICTS="$(grep -RnE "^[[:space:]]*(ProxyPass|ProxyPassMatch|Alias|AliasMatch|RedirectMatch|RewriteRule)[[:space:]]+\^?${BASE}(/|[[:space:]]|$)" \
                 /etc/apache2/sites-enabled/ /etc/apache2/conf-enabled/ 2>/dev/null \
               | grep -v 'TFB landing' \
               | grep -v "127.0.0.1:${PORT}${BASE}" || true)"
  if [ -n "$CONFLICTS" ]; then
    printf '\n\033[31m   %s est déjà revendiqué ailleurs :\033[0m\n' "$BASE"
    printf '%s\n' "$CONFLICTS" | sed 's/^/     /'
    printf '\n   Apache retient la PREMIÈRE règle qui correspond. Insérer la nôtre\n'
    printf '   en fin de vhost ne servirait à rien : celle-ci gagnerait encore.\n'
    printf '   Retirez ou déplacez la règle ci-dessus, puis relancez ce script.\n'
    printf '   Pour servir les deux, il faut deux sous-chemins distincts.\n\n'
    die "Conflit de sous-chemin — rien n'a été modifié."
  fi
  ok "aucune autre règle ne revendique $BASE"
fi

# sites-enabled/ ne contient que des liens symboliques vers sites-available/.
# `cp -a` préserve les liens plutôt que le contenu : il faut résoudre la cible,
# sinon la sauvegarde pointe sur le fichier qu'on s'apprête à modifier.
REAL="$(readlink -f "$TARGET")"
[ -f "$REAL" ] || die "Cible introuvable : $REAL"
[ "$REAL" = "$TARGET" ] || ok "lien symbolique → $REAL"
TARGET="$REAL"

BACKUP="${TARGET}.bak.$(date +%Y%m%d%H%M%S)"
cp "$TARGET" "$BACKUP"
ok "sauvegarde : $BACKUP"
cmp -s "$TARGET" "$BACKUP" || die "La sauvegarde diffère de l'original — on s'arrête."

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
# Pas de pipe ici : le code de retour d'un pipeline est celui du dernier
# maillon, donc `configtest | tail` renvoie toujours 0 et ne teste rien.
if CONFIGTEST="$(apache2ctl configtest 2>&1)"; then
  echo "$CONFIGTEST" | tail -2 | sed 's/^/   /'
else
  echo "$CONFIGTEST" | sed 's/^/   /'
  cp "$BACKUP" "$TARGET"
  die "Configuration invalide — $TARGET restauré depuis la sauvegarde."
fi
systemctl reload apache2
ok "Apache rechargé"

[ "$REMOVE" = "1" ] && { ok "Proxy retiré."; exit 0; }

say "Vérification"
# Deux sondes, et l'ordre compte : sans l'application, aucune configuration Apache
# ne peut réussir, et diagnostiquer le proxy pendant que le service est arrêté
# fait perdre l'essentiel du temps.
DIRECT="$(curl -sS "http://127.0.0.1:${PORT}${BASE}/api/health" 2>&1 || true)"
echo "   app directe : ${DIRECT}"
VIA="$(curl -skS "https://${IP}${BASE}/api/health" 2>&1 | head -c 200 || true)"
echo "   via Apache  : ${VIA}"

case "$VIA" in
  *'"db":"up"'*)
    printf '\n\033[32m   En ligne : https://%s%s/fr\033[0m\n\n' "$IP" "$BASE"
    echo "   Le navigateur avertira sur le certificat — acceptez une fois."
    echo "   Pour revenir en arrière :  sudo bash $0 --remove"
    ;;
  *)
    # L'application d'abord. Un « Connection refused » sur le 3000 n'est pas un
    # problème de proxy, et l'envoyer chercher une RewriteRule est une fausse piste.
    case "$DIRECT" in
      *'"db":"up"'*) ;;
      *refused*|*'(7)'*)
        warn "L'application ne tourne pas — rien n'écoute sur le port ${PORT}."
        echo "   Le proxy est en place ; c'est en amont que ça bloque."
        echo "     sudo systemctl status tfb-landing --no-pager -l"
        echo "     sudo journalctl -u tfb-landing -n 50 --no-pager"
        echo "     sudo systemctl restart tfb-landing"
        echo "   Puis relancez ce script — il est idempotent."
        exit 1 ;;
      *)
        warn "L'application répond mal en direct sur le port ${PORT} :"
        echo "     ${DIRECT}"
        echo "   Un 404 ici signifie que le build ne porte pas ${BASE} :"
        echo "     grep NEXT_PUBLIC_BASE_PATH ${ENV_FILE}"
        echo "   La valeur est inlinée au build — la changer impose un npm run build."
        exit 1 ;;
    esac

    warn "L'app répond en direct, mais pas à travers Apache. Vhost modifié : $TARGET."
    echo "   Une règle placée AVANT la nôtre gagne — Apache retient la première"
    echo "   qui correspond. Cherchez qui d'autre revendique ${BASE} :"
    echo "     sudo grep -Rn '${BASE}' /etc/apache2/sites-enabled/ /etc/apache2/conf-enabled/"
    echo "   Restauration :  sudo cp $BACKUP $TARGET && sudo systemctl reload apache2"
    ;;
esac
