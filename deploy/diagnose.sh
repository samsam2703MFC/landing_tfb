#!/usr/bin/env bash
#
# Diagnostic en lecture seule : où se perd la requête entre Apache et l'app.
# Ne modifie rien.
#
#   sudo bash /srv/tfb-landing/deploy/diagnose.sh
#
set -uo pipefail

APP_DIR="${APP_DIR:-/srv/tfb-landing}"
ENV_FILE="${ENV_FILE:-/etc/tfb-landing.env}"
PORT="${PORT:-3000}"
BASE="${NEXT_PUBLIC_BASE_PATH:-}"
HOST_IP="${HOST_IP:-185.180.206.46}"

[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; BASE="${NEXT_PUBLIC_BASE_PATH:-}"; }

sec() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

sec "1. Le service"
systemctl is-active tfb-landing >/dev/null 2>&1 \
  && echo "   actif" || echo "   INACTIF — journalctl -u tfb-landing -n 30"
systemctl show tfb-landing -p ExecMainStartTimestamp --value 2>/dev/null | sed 's/^/   démarré: /'

sec "2. L'app, en direct sur le port $PORT"
echo "   base path configuré : '${BASE:-(racine)}'"
for path in "${BASE}/api/health" "${BASE}/fr"; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT}${path}" 2>&1)
  echo "   ${path} → ${code}"
done
echo "   corps de /api/health :"
curl -sS "http://127.0.0.1:${PORT}${BASE}/api/health" 2>&1 | sed 's/^/     /'

sec "3. La configuration Apache est-elle chargée ?"
if ls /etc/apache2/conf-enabled/ 2>/dev/null | grep -q landing; then
  echo "   conf-enabled : $(ls /etc/apache2/conf-enabled/ | grep landing)"
else
  echo "   AUCUN fichier landing dans conf-enabled/ — a2enconf n'a pas été lancé."
fi
echo "   occurrences de 'landing_tfb' dans /etc/apache2 :"
grep -rl "landing_tfb" /etc/apache2/ 2>/dev/null | sed 's/^/     /' || echo "     aucune"

sec "4. Les modules proxy"
for m in proxy proxy_http headers; do
  ls "/etc/apache2/mods-enabled/${m}.load" >/dev/null 2>&1 \
    && echo "   ${m} : activé" || echo "   ${m} : MANQUANT"
done

sec "5. Les vhosts"
apache2ctl -S 2>&1 | sed 's/^/   /'

sec "6. À travers Apache"
for scheme_port in "http:80" "https:443"; do
  scheme="${scheme_port%%:*}"
  code=$(curl -skS -o /dev/null -w '%{http_code}' "${scheme}://127.0.0.1${BASE}/api/health" 2>&1)
  echo "   ${scheme} 127.0.0.1${BASE}/api/health → ${code}"
done
code=$(curl -skS -o /dev/null -w '%{http_code}' "https://${HOST_IP}${BASE}/api/health" 2>&1)
echo "   https ${HOST_IP}${BASE}/api/health → ${code}"

sec "7. Dernières erreurs Apache"
tail -n 15 /var/log/apache2/error.log 2>/dev/null | sed 's/^/   /' || echo "   (journal illisible)"

sec "Lecture"
cat <<'TXT'
   • Section 2 en 200 et section 6 en 404  → Apache ne proxifie pas.
     Soit la conf n'est pas chargée (section 3), soit un vhost la court-circuite
     (section 5) : dans ce cas les directives doivent aller DANS le vhost 443.
   • Section 2 en 404 → l'app a été buildée sans le bon base path.
   • Section 2 en échec de connexion → le service ne tourne pas (section 1).
TXT
