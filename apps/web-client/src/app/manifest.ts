import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ratingo — Найкращий контент для перегляду',
    short_name: 'Ratingo',
    description: 'Знаходьте найкращі фільми та серіали для перегляду',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B0D10',
    theme_color: '#0B0D10',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
