// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

/**
 * Rendu serveur : chaque page est construite à la demande à partir de la base
 * SQL. Aucune donnée n'est figée au build, la landing suit donc le contenu
 * régénéré par le pipeline sans reconstruction.
 */
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true, port: 4321 },
  // Le contrôle d'origine natif compare l'en-tête « Origin » du navigateur à
  // l'URL reconstruite par l'adaptateur Node. Derrière Apache, qui termine le
  // TLS, cette URL est en http:// alors que le navigateur annonce https:// —
  // toutes les soumissions de formulaire seraient refusées. On le désactive
  // ici et on refait la vérification sur le nom d'hôte seul, dans
  // src/middleware.js, où l'en-tête X-Forwarded-Host est pris en compte.
  security: { checkOrigin: false },
  // Chemin de montage, pour servir la landing sous une sous-adresse du
  // serveur — ex. https://<serveur>/landing/ — à côté des autres applications.
  // Lu au BUILD : changer BASE_PATH impose de reconstruire.
  base: process.env.BASE_PATH || '/',
  // Renseigné au build par SITE_DOMAIN, sert aux URL canoniques.
  site: process.env.SITE_DOMAIN ? `https://${process.env.SITE_DOMAIN}` : undefined,
  devToolbar: { enabled: false },
});
