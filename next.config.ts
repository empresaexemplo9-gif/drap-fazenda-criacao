import type { NextConfig } from 'next';

// Exportação estática: o DRAP Pecuária roda inteiro no navegador (dados no
// IndexedDB/localStorage do aparelho) para funcionar no campo sem sinal.
// O service worker em /public/sw.js guarda o app em cache depois da 1ª visita.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
