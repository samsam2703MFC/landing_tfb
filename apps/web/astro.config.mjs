// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

/**
 * Rendu serveur : chaque page est construite à la demande à partir de
 * Directus. Aucune donnée n'est figée au build, la landing suit donc le
 * contenu régénéré par le pipeline sans reconstruction d'image.
 */
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 4321 },
  // Renseigné au build par SITE_DOMAIN, sert aux URL canoniques.
  site: process.env.SITE_DOMAIN ? `https://${process.env.SITE_DOMAIN}` : undefined,
  devToolbar: { enabled: false },
});
