# Image de la landing (Astro en rendu serveur, adaptateur Node standalone).
# Deux étapes : on construit avec toutes les dépendances, on n'embarque que
# les dépendances de production dans l'image finale.

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# SITE_DOMAIN sert uniquement aux URL canoniques calculées au build.
ARG SITE_DOMAIN=""
ENV SITE_DOMAIN=$SITE_DOMAIN
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
EXPOSE 4321

# DIRECTUS_URL et DIRECTUS_TOKEN sont fournis à l'exécution par docker compose.
CMD ["node", "./dist/server/entry.mjs"]
