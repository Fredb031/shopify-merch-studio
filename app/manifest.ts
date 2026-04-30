import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vision Affichage',
    short_name: 'VA',
    description:
      'Broderie et sérigraphie pour entreprises québécoises. Production locale, livraison 5 jours ouvrables.',
    start_url: '/fr-ca',
    display: 'standalone',
    background_color: '#F8F7F3',
    theme_color: '#101114',
    icons: [
      { src: '/icon', sizes: '64x64', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
    lang: 'fr-CA',
    orientation: 'portrait-primary',
  };
}
