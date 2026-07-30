#!/usr/bin/env bash
#
# Sert la landing sur https://<IP>/landing_tfb, sans modifier aucun vhost existant.
#
#   sudo bash /srv/tfb-landing/deploy/apache-setup-ip.sh 185.180.206.46
#
# Apache choisit un vhost d'après l'en-tête Host. Une requête vers l'IP envoie
# `Host: <IP>`, donc un vhost dont le ServerName est cette IP capte exactement
# ces requêtes — et aucune de celles adressées à tfbuddy.com, panel.tfbuddy.com
# ou latelierby.be, qui continuent d'être servies comme avant.
#
# Réversible :  sudo a2dissite landing_tfb-ip && sudo systemctl reload apache2
#
set -euo pipefail

IP="${1:?usage: apache-setup-ip.sh <ip>}"
ENV_FILE="${ENV_FILE:-/etc/tfb-landing.env}"
PORT="${PORT:-3000}"
CERT_DIR=/etc/ssl/tfb
SITE=/etc/apache2/sites-available/landing_tfb-ip.conf

ok()   { printf '   \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '   \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || die "À lancer en root."
command -v apache2ctl >/dev/null || die "Apache introuvable."

BASE=""
[ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; BASE="${NEXT_PUBLIC_BASE_PATH:-}"; }
[ -n "$BASE" ] || die "NEXT_PUBLIC_BASE_PATH est vide dans $ENV_FILE — ce script sert un sous-chemin."
ok "sous-chemin : $BASE"

say "Modules"
a2enmod -q ssl proxy proxy_http headers >/dev/null
ok "ssl, proxy, proxy_http, headers"

say "Certificat"
# Aucune autorité ne signe pour une IP nue : auto-signé, avec l'IP en
# subjectAltName pour que le navigateur ne se plaigne que de l'émetteur.
if [ -f "$CERT_DIR/tfb.crt" ]; then
  ok "certificat déjà présent dans $CERT_DIR"
else
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$CERT_DIR/tfb.key" -out "$CERT_DIR/tfb.crt" \
    -subj "/CN=$IP" -addext "subjectAltName=IP:$IP" 2>/dev/null
  chmod 600 "$CERT_DIR/tfb.key"
  ok "certificat auto-signé généré (825 jours)"
fi

say "Vhost"
cat > "$SITE" <<APACHE
# Landing TFB — servie sur https://${IP}${BASE}
#
# Ce vhost ne répond QUE aux requêtes dont l'en-tête Host est ${IP}.
# Les domaines hébergés sur cette machine ne sont pas affectés.

<VirtualHost *:80>
    ServerName ${IP}
    # Le cookie de session du back office est Secure : sans TLS il n'est jamais
    # envoyé et la connexion échoue sans message. On force donc HTTPS.
    RedirectPermanent ${BASE} https://${IP}${BASE}
</VirtualHost>

<VirtualHost *:443>
    ServerName ${IP}

    SSLEngine on
    SSLCertificateFile    ${CERT_DIR}/tfb.crt
    SSLCertificateKeyFile ${CERT_DIR}/tfb.key

    ProxyRequests Off
    ProxyPreserveHost On
    ProxyTimeout 120

    # Les deux côtés portent le préfixe : l'app est buildée avec ce basePath et
    # attend le chemin complet, sans réécriture.
    ProxyPass        ${BASE}  http://127.0.0.1:${PORT}${BASE}
    ProxyPassReverse ${BASE}  http://127.0.0.1:${PORT}${BASE}

    <Location ${BASE}>
        Require all granted
        RequestHeader set X-Forwarded-Proto "https"
        RequestHeader set X-Forwarded-Port  "443"
    </Location>

    <Location ${BASE}/admin>
        Header always set X-Robots-Tag "noindex, nofollow"
    </Location>

    ErrorLog  \${APACHE_LOG_DIR}/landing_tfb-error.log
    CustomLog \${APACHE_LOG_DIR}/landing_tfb-access.log combined
</VirtualHost>
APACHE
ok "$SITE écrit"

# Le drop-in global déclarait les mêmes ProxyPass : deux déclarations pour un
# même chemin n'apportent rien et rendent le diagnostic ambigu.
if [ -e /etc/apache2/conf-enabled/landing_tfb.conf ]; then
  a2disconf landing_tfb >/dev/null
  ok "ancienne conf globale désactivée (les directives sont dans le vhost)"
fi

a2ensite landing_tfb-ip >/dev/null
apache2ctl configtest || die "Configuration Apache invalide — rien n'a été rechargé."
systemctl reload apache2
ok "Apache rechargé"

say "Vérification"
APP="$(curl -sS "http://127.0.0.1:${PORT}${BASE}/api/health" 2>&1 || true)"
echo "   app directe  : ${APP}"
VIA="$(curl -skS "https://${IP}${BASE}/api/health" 2>&1 || true)"
echo "   via Apache   : ${VIA}"

case "$VIA" in
  *'"db":"up"'*)
    printf '\n\033[32m   Servie sur https://%s%s/fr\033[0m\n\n' "$IP" "$BASE"
    echo "   Le navigateur avertira sur le certificat (auto-signé) — acceptez une fois."
    ;;
  *)
    warn "Apache ne renvoie pas encore la réponse de l'app."

    # Une seule question tranche : notre vhost a-t-il vu la requête ? Il a son
    # propre journal d'accès, donc la réponse est binaire.
    say "Notre vhost a-t-il traité la requête ?"
    if [ -s /var/log/apache2/landing_tfb-access.log ]; then
      echo "   OUI — le vhost est retenu, c'est le ProxyPass qui ne s'applique pas :"
      tail -n 5 /var/log/apache2/landing_tfb-access.log | sed 's/^/     /'
      echo
      echo "   Cherchez une RewriteRule globale qui passe devant :"
      echo "     grep -rn 'RewriteRule\|RewriteEngine' /etc/apache2/conf-enabled/ /etc/apache2/apache2.conf"
    else
      echo "   NON — journal d'accès vide : un autre vhost capte les requêtes vers ${IP}."
      echo
      echo "   Vhosts en écoute sur 443 :"
      apache2ctl -S 2>/dev/null | grep -i "443\|namevhost\|default server" | sed "s/^/     /"
      echo
      echo "   Un vhost dont le ServerName ou le ServerAlias vaut déjà ${IP} passerait"
      echo "   devant s'il est chargé en premier :"
      echo "     grep -rn '${IP}' /etc/apache2/sites-enabled/"
    fi

    say "Journal d'erreurs dédié"
    tail -n 20 /var/log/apache2/landing_tfb-error.log 2>/dev/null | sed 's/^/   /' \
      || echo "   (vide — aucune erreur enregistrée par ce vhost)"
    ;;
esac
