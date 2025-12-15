/**
 * Root layout for the application.
 *
 * Sets up fonts, metadata, and global providers.
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AppProviders } from '@/core/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Ratingo — Трендові серіали та фільми',
    template: '%s | Ratingo',
  },
  description:
    'Відкривайте найпопулярніші серіали та фільми з рейтингами TMDB, Trakt та IMDb. Актуальні тренди, найближчі епізоди та детальна інформація.',
  keywords: [
    'серіали',
    'фільми',
    'тренди',
    'рейтинги',
    'TMDB',
    'Trakt',
    'IMDb',
    'україна',
  ],
  authors: [{ name: 'Ratingo' }],
  creator: 'Ratingo',
  publisher: 'Ratingo',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002'),
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    url: '/',
    title: 'Ratingo — Трендові серіали та фільми',
    description: 'Відкривайте найпопулярніші серіали та фільми з рейтингами TMDB, Trakt та IMDb',
    siteName: 'Ratingo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ratingo — Трендові серіали та фільми',
    description: 'Відкривайте найпопулярніші серіали та фільми з рейтингами TMDB, Trakt та IMDb',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="uk" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 font-sans antialiased" suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
