import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DRAP Pecuária',
    short_name: 'DRAP Pecuária',
    description: 'Gestão do rebanho offline: rebanho, sanidade, pasto, livro-razão e custo da arroba.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F4EC',
    theme_color: '#486B3A',
    orientation: 'any',
    lang: 'pt-BR',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    categories: ['business', 'productivity'],
  };
}
