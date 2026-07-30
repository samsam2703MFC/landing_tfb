import type { NextConfig } from 'next';

// Sous-chemin de service, par ex. /landing_tfb. Vide = racine du domaine.
// Doit rester aligné avec NEXT_PUBLIC_BASE_PATH, que le code lit pour tout ce
// que basePath ne réécrit pas (fetch, <img src>, masques d'icônes).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(basePath ? { basePath } : {}),
  // Module screenshots and brand logos are written to STORAGE_PATH by the upload
  // endpoint and served back through /api/storage/[...path] — see src/lib/storage.ts.
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
