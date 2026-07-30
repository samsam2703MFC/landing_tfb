#!/usr/bin/env bash
#
# Certificat auto-signé pour tester sur l'IP, sans nom de domaine.
#
#   sudo bash deploy/selfsigned.sh 185.180.206.46
#
# Le navigateur affichera un avertissement à accepter une fois. C'est suffisant
# pour une recette : `Secure` exige du TLS, pas un certificat reconnu — donc la
# connexion au back office fonctionne. Remplacez par certbot dès qu'un domaine
# pointe sur le serveur.
set -euo pipefail
HOST="${1:?usage: selfsigned.sh <ip-ou-hote>}"
DIR=/etc/ssl/tfb
mkdir -p "$DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$DIR/tfb.key" -out "$DIR/tfb.crt" \
  -subj "/CN=$HOST" \
  -addext "subjectAltName=IP:$HOST"
chmod 600 "$DIR/tfb.key"

cat > /etc/nginx/sites-available/tfb-test <<NGINX
server {
    listen 443 ssl;
    server_name $HOST;

    ssl_certificate     $DIR/tfb.crt;
    ssl_certificate_key $DIR/tfb.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        client_max_body_size 25m;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/tfb-test /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo
echo "Testez :  https://$HOST${NEXT_PUBLIC_BASE_PATH:-}/api/health   (acceptez l'avertissement)"
