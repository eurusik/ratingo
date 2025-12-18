/**
 * Root layout for the application.
 *
 * Sets up fonts, metadata, and global providers.
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AppProviders } from '@/core/providers';
import { Header, HeaderContextProvider } from '@/shared/components';
import { getDictionary } from '@/shared/i18n';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

const dict = getDictionary('uk');

export const metadata: Metadata = {
  title: {
    default: dict.meta.defaultTitle,
    template: '%s | Ratingo',
  },
  description: dict.meta.defaultDescription,
  keywords: [
    dict.meta.keywords.shows,
    dict.meta.keywords.movies,
    dict.meta.keywords.trending,
    dict.meta.keywords.ratings,
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
    title: dict.meta.defaultTitle,
    description: dict.meta.defaultDescription,
    siteName: 'Ratingo',
  },
  twitter: {
    card: 'summary_large_image',
    title: dict.meta.defaultTitle,
    description: dict.meta.defaultDescription,
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
        <AppProviders>
          <HeaderContextProvider>
            <Header />
            <main className="pt-16">{children}</main>
          </HeaderContextProvider>
        </AppProviders>
      </body>
    </html>
  );
}
