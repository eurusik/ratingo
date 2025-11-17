import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { generateWebSiteJsonLd } from '@/lib/seo/jsonld';
import { FiltersProvider } from '@/components/FiltersProvider';
import { HeaderRegionSelector } from '@/components/HeaderRegionSelector';
import { MobileNav } from '@/components/MobileNav';
import { Flame, Clapperboard } from 'lucide-react';

export const metadata: Metadata = {
  title: {
    default: 'Ratingo — Трендові серіали України',
    template: '%s | Ratingo',
  },
  description:
    'Відкривайте найпопулярніші серіали з рейтингами TMDB, Trakt та IMDb. Актуальні тренди, найближчі епізоди та детальна інформація про ваші улюблені шоу.',
  keywords: [
    'серіали',
    'тренди',
    'рейтинги',
    'TMDB',
    'Trakt',
    'IMDb',
    'трендові серіали',
    'популярні серіали',
    'україна',
  ],
  authors: [{ name: 'Ratingo' }],
  creator: 'Ratingo',
  publisher: 'Ratingo',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    url: '/',
    title: 'Ratingo — Трендові серіали України',
    description: 'Відкривайте найпопулярніші серіали з рейтингами TMDB, Trakt та IMDb',
    siteName: 'Ratingo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ratingo — Трендові серіали',
    description: 'Відкривайте найпопулярніші серіали з рейтингами TMDB, Trakt та IMDb',
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
  verification: {
    // google: 'your-google-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const websiteJsonLd = generateWebSiteJsonLd();

  return (
    <html lang="uk">
      <body className="antialiased bg-zinc-950" suppressHydrationWarning>
        {/* JSON-LD for website */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {/* Header with gradient border */}
        <Suspense fallback={null}>
          <FiltersProvider>
            <div className="sticky top-0 z-50">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-xl" />
              <nav className="relative bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <a href="/" className="flex items-center space-x-2 sm:space-x-3 group">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                        <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl">
                          <svg
                            className="w-5 h-5 sm:w-6 sm:h-6 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                          Ratingo
                        </span>
                        <span className="hidden sm:block text-[10px] text-zinc-500 -mt-1 font-medium tracking-wide">
                          TRENDING SHOWS
                        </span>
                      </div>
                    </a>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-3">
                      <a
                        href="/"
                        className="group relative px-4 py-2 rounded-lg overflow-hidden transition-all duration-300"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative flex items-center space-x-2">
                          <Flame className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                            Тренди
                          </span>
                        </div>
                      </a>
                      <a
                        href="/airings"
                        className="group relative px-4 py-2 rounded-lg overflow-hidden transition-all duration-300"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative flex items-center space-x-2">
                          <Clapperboard className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                            Надходження
                          </span>
                        </div>
                      </a>
                      {/* Region selector inline in header */}
                      <HeaderRegionSelector />
                    </div>

                    {/* Mobile Navigation */}
                    <div className="md:hidden">
                      <MobileNav />
                    </div>
                  </div>
                </div>
              </nav>
            </div>
            <main>{children}</main>
          </FiltersProvider>
        </Suspense>
      </body>
    </html>
  );
}
