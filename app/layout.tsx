import type { Metadata } from 'next';
import { Suspense } from 'react';
import Link from 'next/link';
import { Inter } from 'next/font/google';
import './globals.css';
import { generateWebSiteJsonLd } from '@/lib/seo/jsonld';
import { FiltersProvider } from '@/components/FiltersProvider';
import { HeaderRegionSelector } from '@/components/HeaderRegionSelector';
import { MobileNav } from '@/components/MobileNav';
import { Logo } from '@/components/Logo';
import { ProgressBar } from '@/components/ProgressBar';
import { Footer } from '@/components/Footer';
import { Flame, Clapperboard, Film } from 'lucide-react';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-inter',
});

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
    <html lang="uk" className={inter.variable}>
      <body className="antialiased bg-zinc-950 font-sans" suppressHydrationWarning>
        {/* JSON-LD for website */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {/* Header with gradient border */}
        <Suspense fallback={null}>
          <ProgressBar />
        </Suspense>
        <Suspense fallback={null}>
          <FiltersProvider>
            <div className="sticky top-0 z-50" suppressHydrationWarning>
              <div
                className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-xl"
                suppressHydrationWarning
              />
              <nav className="relative bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" suppressHydrationWarning>
                  <div className="flex justify-between items-center h-16" suppressHydrationWarning>
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group">
                      <Logo />
                      <div className="flex flex-col" suppressHydrationWarning>
                        <span className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                          Ratingo
                        </span>
                        <span className="hidden sm:block text-[10px] text-zinc-500 -mt-1 font-semibold tracking-wider">
                          TRENDING SHOWS
                        </span>
                      </div>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-3" suppressHydrationWarning>
                      <Link
                        href="/"
                        className="group relative px-4 py-2 rounded-lg overflow-hidden transition-all duration-300"
                      >
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          suppressHydrationWarning
                        />
                        <div
                          className="relative flex items-center space-x-2"
                          suppressHydrationWarning
                        >
                          <Flame className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                            Серіали
                          </span>
                        </div>
                      </Link>
                      <Link
                        href="/movies"
                        className="group relative px-4 py-2 rounded-lg overflow-hidden transition-all duration-300"
                      >
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          suppressHydrationWarning
                        />
                        <div
                          className="relative flex items-center space-x-2"
                          suppressHydrationWarning
                        >
                          <Film className="w-5 h-5 text-pink-400 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                            Фільми
                          </span>
                        </div>
                      </Link>
                      <Link
                        href="/airings"
                        className="group relative px-4 py-2 rounded-lg overflow-hidden transition-all duration-300"
                      >
                        <div
                          className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          suppressHydrationWarning
                        />
                        <div
                          className="relative flex items-center space-x-2"
                          suppressHydrationWarning
                        >
                          <Clapperboard className="w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform" />
                          <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                            Надходження
                          </span>
                        </div>
                      </Link>
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
            <Footer />
          </FiltersProvider>
        </Suspense>
      </body>
    </html>
  );
}
