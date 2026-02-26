/**
 * Root layout for the application.
 *
 * Sets up fonts, metadata, and global providers.
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AppProviders } from '@/core/providers';
import { GoogleAnalytics } from '@/shared/components';
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
  appleWebApp: {
    capable: true,
    title: 'Ratingo',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  themeColor: '#0B0D10',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="uk" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-cinema-page font-sans antialiased" suppressHydrationWarning>
        {/* Capture beforeinstallprompt before React hydration so the event is never lost */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__pwaPrompt=null;window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__pwaPrompt=e})`,
          }}
        />
        <AppProviders>
          {children}
        </AppProviders>
        <Analytics />
        <SpeedInsights />
        <GoogleAnalytics />
      </body>
    </html>
  );
}
