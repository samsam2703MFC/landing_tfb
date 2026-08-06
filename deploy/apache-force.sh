#!/usr/bin/env bash
#
# Branche la landing sur TOUS les vhosts, et prouve le résultat.
#
#   sudo bash /srv/tfb-landing/deploy/apache-force.sh
#   sudo bash /srv/tfb-landing/deploy/apache-force.sh --remove
#
# Pourquoi ce script en plus d'apache-attach.sh : ce dernier insère le proxy dans
# UN vhost, celui qu'Apache déclare servir l'IP sur 443. Quand ça ne marche pas,
# il faut déterminer lequel sert réellement la requête — et cette question a
# coûté une demi-journée d'allers-retours pour une réponse qui, au fond,
# n'intéresse personne.
#
# Celui-ci ne pose plus la question. Il écrit le proxy :
#   1. dans conf-available/, activé globalement, donc dans tous les vhosts ;
#   2. ET dans chaque vhost activé, où une directive locale l'emporterait.
#
# Le chemin proxifié est un sous-chemin précis et nouveau. Il ne peut pas
# détourner le trafic d'un autre site : seules les URLs commençant par ce
# préfixe changent de destination.
#
# Sûr : sauvegarde horodatée de chaque fichier touché, `configtest` avant
# rechargement, restauration intégrale si la configuration devient invalide.
#
# En cas d'échec, il imprime de lui-même le diagnostic complet — vhost retenu,
# directives de routage, début de la réponse reçue. Rien à aller chercher.
#
set -uo pipefail

ENV_FILE="${ENV_FILE:-/etc/tfb-landing.env}"
PORT="${PORT:-3000}"
IP="${IP:-185.180.206.46}"
CONF=/etc/apache2/conf-available/tfb-landing-proxy.conf
STAMP="$(date +%Y%m%d%H%M%S)"
BEGIN="# >>> TFB landing >>>"
END="# <<< TFB landing <<<"
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
ok "sous-chemin : $BASE"

BACKUPS=()

restore_all() {
  for pair in "${BACKUPS[@]}"; do
    cp "${pair#*|}" "${pair%|*}"
  done
  systemctl reload apache2 2>/dev/null || true
}

# ------------------------------------------------------------------ retrait --

strip_block() {   # $1 = fichier
  python3 - "$1" "$BEGIN" "$END" <<'PY'
import sys, pathlib
path, begin, end = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
out, skip = [], False
for line in path.read_text().splitlines(keepends=True):
    if begin in line: skip = True;  continue
    if end   in line: skip = False; continue
    if not skip: out.append(line)
path.write_text("".join(out))
PY
}

if [ "$REMOVE" = "1" ]; then
  say "Retrait"
  a2disconf tfb-landing-proxy >/dev/null 2>&1 && ok "conf globale désactivée"
  rm -f "$CONF"
  for f in /etc/apache2/sites-enabled/*.conf; do
    real="$(readlink -f "$f")"
    grep -q "$BEGIN" "$real" 2>/dev/null || continue
    strip_block "$real" && ok "bloc retiré de $real"
  done
  apache2ctl configtest >/dev/null 2>&1 || die "Configuration invalide après retrait."
  systemctl reload apache2
  ok "Apache rechargé. Proxy retiré."
  exit 0
fi

# --------------------------------------------------------------- l'app d'abord

say "1. L'application"
DIRECT="$(curl -sS --max-time 5 "http://127.0.0.1:${PORT}${BASE}/api/health" 2>&1)"
case "$DIRECT" in
  *'"db":"up"'*) ok "répond sur 127.0.0.1:${PORT}${BASE}" ;;
  *refused*|*'(7)'*)
    warn "rien n'écoute sur le port ${PORT}."
    echo "     sudo systemctl restart tfb-landing && sleep 3 && sudo bash \$0"
    die "L'application ne tourne pas — Apache n'y peut rien." ;;
  *)
    warn "réponse inattendue : ${DIRECT}"
    echo "     Un 404 ici = le build ne porte pas ${BASE}."
    echo "     grep NEXT_PUBLIC_BASE_PATH ${ENV_FILE}   puis rebâtir."
    die "L'application ne sert pas ${BASE}." ;;
esac

# ------------------------------------------------------------------- modules --

say "2. Modules Apache"
for m in proxy proxy_http headers; do
  if [ -e "/etc/apache2/mods-enabled/${m}.load" ]; then
    ok "$m"
  else
    a2enmod "$m" >/dev/null && ok "$m activé"
  fi
done

# --------------------------------------------------------------- conf globale --

BLOCK="    ${BEGIN}
    # Proxy vers l'application Next (systemd: tfb-landing).
    # Les deux côtés portent le préfixe : l'app est buildée avec ce basePath et
    # attend le chemin complet, sans réécriture.
    ProxyPreserveHost On
    ProxyTimeout 120
    ProxyPass        ${BASE}  http://127.0.0.1:${PORT}${BASE}
    ProxyPassReverse ${BASE}  http://127.0.0.1:${PORT}${BASE}
    <Location ${BASE}>
        Require all granted
        RequestHeader set X-Forwarded-Proto \"https\"
        RequestHeader set X-Forwarded-Port  \"443\"
    </Location>
    <Location ${BASE}/admin>
        Header always set X-Robots-Tag \"noindex, nofollow\"
    </Location>
    ${END}"

say "3. Configuration globale"
printf '%s\n' "$BLOCK" > "$CONF"
a2enconf tfb-landing-proxy >/dev/null
ok "$CONF activée — s'applique à tous les vhosts"

# --------------------------------------------------------------- chaque vhost --

say "4. Chaque vhost activé"
for f in /etc/apache2/sites-enabled/*.conf; do
  [ -e "$f" ] || continue
  real="$(readlink -f "$f")"
  [ -f "$real" ] || continue

  bak="${real}.bak.${STAMP}"
  # La sauvegarde va à côté du fichier réel, jamais dans sites-enabled : un
  # fichier de plus dans ce répertoire est un piège pour la personne suivante.
  cp "$real" "$bak"
  BACKUPS+=("${real}|${bak}")

  strip_block "$real"
  BLOCK="$BLOCK" python3 - "$real" <<'PY'
import os, sys, pathlib
path = pathlib.Path(sys.argv[1])
block = os.environ["BLOCK"] + "\n"
lines, out, inserted = path.read_text().splitlines(keepends=True), [], 0
for line in lines:
    if line.strip().lower().startswith("</virtualhost"):
        out.append(block)
        inserted += 1
    out.append(line)
path.write_text("".join(out))
print(inserted)
PY
  ok "$(basename "$real")"
done

# ----------------------------------------------------------------- validation --

say "5. Validation"
if CONFIGTEST="$(apache2ctl configtest 2>&1)"; then
  echo "$CONFIGTEST" | tail -1 | sed 's/^/   /'
else
  echo "$CONFIGTEST" | sed 's/^/   /'
  restore_all
  a2disconf tfb-landing-proxy >/dev/null 2>&1
  rm -f "$CONF"
  die "Configuration invalide — tout a été restauré, rien n'a changé."
fi
systemctl reload apache2
ok "Apache rechargé"

# ------------------------------------------------------------------- épreuve --

say "6. Épreuve"
sleep 2
H="$(curl -sS  --max-time 8 -o /tmp/tfb80  -w '%{http_code}' "http://${IP}${BASE}/api/health"  2>/dev/null || echo 000)"
S="$(curl -skS --max-time 8 -o /tmp/tfb443 -w '%{http_code}' "https://${IP}${BASE}/api/health" 2>/dev/null || echo 000)"
echo "   http  80  → $H"
echo "   https 443 → $S"

if grep -q '"db":"up"' /tmp/tfb443 2>/dev/null || grep -q '"db":"up"' /tmp/tfb80 2>/dev/null; then
  printf '\n\033[32m   En ligne : https://%s%s/admin/login\033[0m\n\n' "$IP" "$BASE"
  echo "   Le certificat est auto-signé : le navigateur avertit une fois."
  echo "   Restez en https — le cookie de session est Secure."
  echo "   Retour arrière :  sudo bash $0 --remove"
  exit 0
fi

# --------------------------------------------------------------- diagnostic --
#
# Échec : on imprime tout ce qu'il faut pour comprendre, ici et maintenant.
# Personne ne devrait avoir à relancer six commandes pour rassembler ça.

printf '\n\033[31m   Toujours pas. Voici tout ce qu'\''il faut pour trancher :\033[0m\n'

say "A. Ce qu'Apache a renvoyé (300 premiers octets)"
head -c 300 /tmp/tfb443 2>/dev/null | sed 's/^/   /'; echo

say "B. Vhosts retenus par Apache"
apache2ctl -S 2>&1 | sed 's/^/   /'

say "C. Directives de routage, tous vhosts activés"
grep -RnE "^[[:space:]]*(<VirtualHost|ServerName|ServerAlias|DocumentRoot|Rewrite|Proxy|Alias|Redirect)" \
  /etc/apache2/sites-enabled/ 2>/dev/null | sed 's/^/   /'

say "D. Configurations globales actives"
ls -1 /etc/apache2/conf-enabled/ 2>/dev/null | sed 's/^/   /'

say "E. Ce qui écoute"
ss -tlnp 2>/dev/null | grep -E ':(80|443|3000|4321)\b' | sed 's/^/   /'

printf '\n   Copiez ce bloc en entier. Il contient la réponse.\n'
echo "   Retour arrière :  sudo bash $0 --remove"
exit 1
