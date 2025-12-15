/**
 * Home page with trending media cards demo.
 */

import type { MediaCardServerProps } from '@/modules/home';
import { MediaCardServer, Top3SectionServer } from '@/modules/home';
import { getDictionary } from '@/shared/i18n';

// Demo data matching API contract structure
const demoShows: MediaCardServerProps[] = [
  {
    id: '1',
    slug: 'kraina-vohnyu',
    type: 'show',
    title: 'Країна Вогню',
    poster: { small: 'https://image.tmdb.org/t/p/w342/lfZ9eKhV0Hoz8dUbgKTcvXxhxE.jpg', medium: 'https://image.tmdb.org/t/p/w500/lfZ9eKhV0Hoz8dUbgKTcvXxhxE.jpg', large: 'https://image.tmdb.org/t/p/w780/lfZ9eKhV0Hoz8dUbgKTcvXxhxE.jpg', original: 'https://image.tmdb.org/t/p/original/lfZ9eKhV0Hoz8dUbgKTcvXxhxE.jpg' },
    stats: { ratingoScore: 82, qualityScore: 85, popularityScore: 75, liveWatchers: 1200, totalWatchers: 50000 },
    externalRatings: { imdb: { rating: 7.1, voteCount: 45000 } },
    showProgress: { season: 4, episode: 8, label: 'S4E9', nextAirDate: '2025-12-19' },
    badgeKey: 'TRENDING',
    ctaType: 'OPEN',
  },
  {
    id: '2',
    slug: 'squid-game',
    type: 'show',
    title: 'Сквід Гейм',
    poster: { small: 'https://image.tmdb.org/t/p/w342/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg', medium: 'https://image.tmdb.org/t/p/w500/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg', large: 'https://image.tmdb.org/t/p/w780/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg', original: 'https://image.tmdb.org/t/p/original/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg' },
    stats: { ratingoScore: 78, qualityScore: 80, popularityScore: 95, liveWatchers: 5600, totalWatchers: 200000 },
    externalRatings: { imdb: { rating: 8.0, voteCount: 500000 } },
    showProgress: { season: 2, episode: 0, label: 'S2E1', nextAirDate: '2025-12-26' },
    badgeKey: 'NEW_EPISODE',
    ctaType: 'OPEN',
  },
  {
    id: '3',
    slug: 'the-bear',
    type: 'show',
    title: 'Ведмідь',
    poster: { small: 'https://image.tmdb.org/t/p/w342/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg', medium: 'https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg', large: 'https://image.tmdb.org/t/p/w780/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg', original: 'https://image.tmdb.org/t/p/original/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg' },
    stats: { ratingoScore: 87, qualityScore: 90, popularityScore: 60, liveWatchers: 890, totalWatchers: 80000 },
    externalRatings: { imdb: { rating: 8.5, voteCount: 120000 } },
    showProgress: { season: 3, episode: 10, label: 'S3E10' },
    ctaType: 'SAVE',
  },
  {
    id: '4',
    slug: 'dune-part-two',
    type: 'movie',
    title: 'Дюна: Частина друга',
    poster: { small: 'https://image.tmdb.org/t/p/w342/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', medium: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', large: 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', original: 'https://image.tmdb.org/t/p/original/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg' },
    stats: { ratingoScore: 84, qualityScore: 88, popularityScore: 85, liveWatchers: 2100, totalWatchers: 300000 },
    externalRatings: { imdb: { rating: 8.6, voteCount: 600000 } },
    releaseDate: '2024-02-27',
    badgeKey: 'NEW_RELEASE',
    ctaType: 'OPEN',
  },
  {
    id: '5',
    slug: 'oppenheimer',
    type: 'movie',
    title: 'Опенгеймер',
    poster: { small: 'https://image.tmdb.org/t/p/w342/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', medium: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', large: 'https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', original: 'https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg' },
    stats: { ratingoScore: 81, qualityScore: 85, popularityScore: 70, liveWatchers: 1800, totalWatchers: 500000 },
    externalRatings: { imdb: { rating: 8.3, voteCount: 800000 } },
    releaseDate: '2023-07-19',
    ctaType: 'SAVE',
  },
];

export default function HomePage() {
  // Server component uses getDictionary directly
  const dict = getDictionary('uk');

  return (
    <main className="min-h-screen">
      {/* Hero section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {dict.home.tagline.split(',')[0]},{' '}
            <span className="gradient-text">{dict.home.tagline.split(',')[1]?.trim() || 'що дивитись зараз'}</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            {dict.home.subtitle}
          </p>
        </div>

        {/* Top-3 section (SSR) */}
        <Top3SectionServer items={demoShows.slice(0, 3)} locale="uk" className="mb-12" />

        {/* Trending section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🔥</span>
              {dict.home.sections.trending}
            </h2>
            <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              {dict.common.showAll} →
            </button>
          </div>

          {/* Cards grid - remaining items (SSR) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {demoShows.slice(3).map((item) => (
              <MediaCardServer key={item.id} {...item} locale="uk" />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
