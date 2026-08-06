#!/usr/bin/env bash
#
# Où se perd la requête entre Apache et l'application. Ne modifie rien.
#
#   sudo bash /var/www/landing_tfb/deploy/diagnostiquer.sh
#
# Écrit après une demi-journée passée à chercher pourquoi /landing_tfb renvoyait
# la page d'un autre site. Trois pièges y ont été rencontrés, chacun invisible et
# chacun crédible ; ils sont tous les trois vérifiés ici.
#
#   1. `grep -r` IGNORE les liens symboliques rencontrés en parcourant un
#      répertoire. Or sites-enabled/ n'en contient pas d'autre chose. Un
#      `grep -rn` sur ce répertoire ne renvoie donc JAMAIS rien, quel que soit le
#      contenu des vhosts — et on en conclut qu'aucune règle n'existe. Il faut -R.
#
#   2. conf-enabled/ est chargé AVANT sites-enabled/, et ses directives valent
#      pour tous les vhosts. Ne regarder que les vhosts, c'est rendre un état
#      qui a l'air complet et ne l'est pas.
#
#   3. mod_alias compare une CHAÎNE, pas des segments. `Alias /landing …` capte
#      aussi /landing_tfb. Les deux lignes sont correctes séparément : c'est leur
#      cohabitation qui casse, et rien ne la signale à la relecture.
#
# Et l'ordre compte : l'application AVANT le proxy. Un « connection refused » sur
# le port n'est pas un problème Apache, et le chercher là fait perdre l'essentiel
# du temps.
#
set -uo pipefail

RACINE="${RACINE:-/var/www/landing_tfb}"
ENV_FILE="${ENV_FILE:-$RACINE/infra/.env}"
IP="${IP:-185.180.206.46}"

[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
PORT="${HTTP_PORT:-8090}"
BASE="${BASE_PATH:-/landing_tfb}"

sec() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok()  { printf '   \033[32m✓\033[0m %s\n' "$*"; }
bad() { printf '   \033[31m✗\033[0m %s\n' "$*"; }

printf '\n\033[1mlanding_tfb — diagnostic\033[0m\n   %s  ·  port %s  ·  base %s\n' "$RACINE" "$PORT" "$BASE"

sec "1. Le service"
if systemctl is-active landing-tfb >/dev/null 2>&1; then
  ok "landing-tfb actif depuis $(systemctl show landing-tfb -p ExecMainStartTimestamp --value 2>/dev/null)"
else
  bad "landing-tfb INACTIF — journalctl -u landing-tfb -n 30"
fi

sec "2. L'application, en direct sur le port $PORT"
# En direct d'abord : si rien n'écoute, tout ce qui suit est du bruit.
for chemin in "$BASE/" "$BASE/admin/" "$BASE/api/charte"; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "http://127.0.0.1:${PORT}${chemin}" 2>&1)
  case "$code" in
    000|*curl*) bad "${chemin} → injoignable (rien n'écoute sur ${PORT})" ;;
    401)        ok  "${chemin} → 401 (attendu : la route exige un jeton)" ;;
    2*|3*)      ok  "${chemin} → ${code}" ;;
    *)          bad "${chemin} → ${code}" ;;
  esac
done

sec "3. À travers Apache"
for schema in http https; do
  opt=$([ "$schema" = https ] && echo -k || echo)
  code=$(curl -sS $opt -o /dev/null -w '%{http_code}' --max-time 8 "${schema}://${IP}${BASE}/" 2>&1)
  case "$code" in
    2*|3*) ok "${schema} → ${code}" ;;
    *)     bad "${schema} → ${code}" ;;
  esac
done

# -R et non -r : voir le piège nº 1 en tête de fichier.
sec "4. Qui revendique $BASE"
TROUVE=$(grep -RnE "^[[:space:]]*(ProxyPass|ProxyPassMatch|Alias|AliasMatch|Redirect|RedirectMatch|RewriteRule)[[:space:]]+\^?${BASE}([/[:space:]]|\$)" \
  /etc/apache2/conf-enabled/ /etc/apache2/sites-enabled/ 2>/dev/null)
if [ -n "$TROUVE" ]; then printf '%s\n' "$TROUVE" | sed 's/^/   /'; else bad "aucune règle — Apache ne proxifie pas ce chemin"; fi

# Piège nº 3 : un préfixe plus court capte le nôtre par simple recouvrement.
sec "5. Préfixes qui pourraient capter $BASE par recouvrement"
RECOUVRE=$(grep -RnE "^[[:space:]]*(Alias|AliasMatch|ProxyPass|Redirect|RedirectMatch)[[:space:]]+\^?/[a-zA-Z0-9_-]+" \
  /etc/apache2/conf-enabled/ /etc/apache2/sites-enabled/ 2>/dev/null \
  | awk -v b="$BASE" '{ for (i=1;i<NF;i++)
      if ($i ~ /^(Alias|AliasMatch|ProxyPass|Redirect|RedirectMatch)$/) {
        p=$(i+1); sub(/^\^/,"",p); sub(/\/$/,"",p);
        if (p != b && index(b, p) == 1) print $0
        break } }')
if [ -n "$RECOUVRE" ]; then
  printf '%s\n' "$RECOUVRE" | sed 's/^/   /'
  printf '   \033[33m!\033[0m mod_alias compare une chaîne : ces préfixes captent aussi %s.\n' "$BASE"
  printf '     Ils ne gagnent que si mod_proxy ne prend pas la main avant.\n'
else
  ok "aucun"
fi

sec "6. Ce qui écoute"
ss -tlnp 2>/dev/null | grep -E ":(80|443|${PORT})\b" | sed 's/^/   /' || true

sec "Lecture"
cat <<'FIN'
   · Section 2 injoignable  → le service ne tourne pas. Apache n'y peut rien.
   · Section 2 en 404       → le build ne porte pas ce BASE_PATH. Rebâtir.
   · 2 en 200 et 3 en 404   → Apache ne proxifie pas : voir 4, puis 5.
   · 4 vide                 → poser deploy/apache-landing.conf, gabarits substitués.
FIN
echo
