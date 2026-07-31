# Image du pipeline d'ingestion. Elle ne tourne pas en permanence : on la
# lance à la demande, depuis le serveur, pour régénérer le contenu.
#
#   docker compose --profile outils run --rm pipeline node bootstrap-db.mjs
#   docker compose --profile outils run --rm pipeline node ingest-all.mjs

FROM node:20-alpine

# Le code vit dans /app/pipeline pour que modules.json, monté dans /app,
# soit trouvé à l'emplacement attendu par les scripts.
WORKDIR /app/pipeline

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

ENV NODE_ENV=production

# Aucune commande par défaut utile : on passe toujours le script à exécuter.
CMD ["node", "--version"]
