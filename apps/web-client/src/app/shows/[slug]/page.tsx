/**
 * Show details page
 */

import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Tv, Share2 } from 'lucide-react';
import { getDictionary } from '@/shared/i18n';
import {
  DetailsHero,
  DetailsCtaRow,
  DetailsQuickPitch,
  ShowStatus,
  ProvidersList,
  SimilarCarousel,
  DataVerdict,
  type BadgeKey,
} from '@/modules/details';
import type { MediaCardServerProps } from '@/modules/home';

// ISR: Revalidate every hour (balance between fresh data & performance)
export const revalidate = 3600;

interface ShowDetailsPageProps {
  params: Promise<{ slug: string }>;
}

// Demo data (will be replaced with API call)
const demoShows: Record<string, {
  id: string;
  slug: string;
  title: string;
  originalTitle?: string;
  overview: string;
  quickPitch: string;
  suitableFor: string[];
  poster: { small: string; medium: string; large: string; original: string };
  backdrop?: { small: string; medium: string; large: string; original: string };
  stats: { ratingoScore: number; liveWatchers?: number; popularityScore?: number };
  externalRatings: { imdb?: { rating: number }; tmdb?: { rating: number }; trakt?: { rating: number }; metacritic?: { rating: number }; rottenTomatoes?: { rating: number } };
  genres: { id: string; name: string; slug: string }[];
  releaseDate: string;
  status: 'Returning Series' | 'Ended' | 'Canceled' | 'In Production';
  totalSeasons?: number;
  currentSeason?: number;
  currentSeasonEpisodesReleased?: number;
  currentSeasonTotalEpisodes?: number;
  nextEpisodeDate?: string;
  badgeKey?: BadgeKey;
  rank?: number;
  primaryTrailerKey?: string;
  providers?: { id: number; name: string; logo?: string; type: 'stream' | 'rent' | 'buy' }[];
}> = {
  'kraina-vohnyu': {
    id: '1',
    slug: 'kraina-vohnyu',
    title: 'Країна Вогню',
    originalTitle: 'Landman',
    overview: 'Драматичний серіал про нафтову індустрію Техасу. Тед Даттон — посередник між багатими нафтовими магнатами та бурильниками. Він вирішує проблеми, які ніхто інший не може вирішити, балансуючи між законом і хаосом.',
    quickPitch: 'Драма про нафтовий бізнес Техасу — жорстка, брудна гра заради мільярдів.',
    suitableFor: ['драма', 'бізнес', 'Yellowstone'],
    poster: { small: 'https://image.tmdb.org/t/p/w342/lfZ9eKhV0Hoz8dUbgKTcvXxhxE.jpg', medium: 'https://image.tmdb.org/t/p/w500/lfZ9eKhV0Hoz8dUbgKTcvXxhxE.jpg', large: 'https://image.tmdb.org/t/p/w780/lfZ9eKhV0Hoz8dUbgKTcvXxhxE.jpg', original: 'https://image.tmdb.org/t/p/original/lfZ9eKhV0Hoz8dUbgKTcvXxhxE.jpg' },
    backdrop: { small: 'https://image.tmdb.org/t/p/w300/5jGi7JL9zLdP2f4OFlSXz6U36.jpg', medium: 'https://image.tmdb.org/t/p/w780/5jGi7JL9zLdP2f4OFlSXz6U36.jpg', large: 'https://image.tmdb.org/t/p/w1280/5jGi7JL9zLdP2f4OFlSXz6U36.jpg', original: 'https://image.tmdb.org/t/p/original/5jGi7JL9zLdP2f4OFlSXz6U36.jpg' },
    stats: { ratingoScore: 82, liveWatchers: 1200, popularityScore: 85 },
    externalRatings: { imdb: { rating: 7.1 } },
    genres: [{ id: '1', name: 'Драма', slug: 'drama' }, { id: '2', name: 'Кримінал', slug: 'crime' }],
    releaseDate: '2024-11-17',
    status: 'Returning Series',
    totalSeasons: 1,
    currentSeason: 1,
    currentSeasonEpisodesReleased: 8,
    currentSeasonTotalEpisodes: 10,
    nextEpisodeDate: '2025-12-19',
    badgeKey: 'TRENDING',
    rank: 3,
    primaryTrailerKey: 'dQw4w9WgXcQ',
    providers: [
      { id: 1, name: 'Netflix', type: 'stream' },
      { id: 2, name: 'Megogo', type: 'stream' },
    ],
  },
  'squid-game': {
    id: '2',
    slug: 'squid-game',
    title: 'Сквід Гейм',
    originalTitle: 'Squid Game',
    overview: 'Сотні гравців, які мають фінансові проблеми, приймають дивне запрошення взяти участь у дитячих іграх. Всередині їх чекає спокусливий приз із фатальними ставками.',
    quickPitch: 'Дитячі ігри із смертельними наслідками — гострий корейський трилер.',
    suitableFor: ['трилер', 'соціальна драма', 'Battle Royale'],
    poster: { small: 'https://image.tmdb.org/t/p/w342/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg', medium: 'https://image.tmdb.org/t/p/w500/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg', large: 'https://image.tmdb.org/t/p/w780/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg', original: 'https://image.tmdb.org/t/p/original/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg' },
    backdrop: { small: 'https://image.tmdb.org/t/p/w300/oaGvjB0DvdhXhOAuADfHb261ZHa.jpg', medium: 'https://image.tmdb.org/t/p/w780/oaGvjB0DvdhXhOAuADfHb261ZHa.jpg', large: 'https://image.tmdb.org/t/p/w1280/oaGvjB0DvdhXhOAuADfHb261ZHa.jpg', original: 'https://image.tmdb.org/t/p/original/oaGvjB0DvdhXhOAuADfHb261ZHa.jpg' },
    stats: { ratingoScore: 78, liveWatchers: 5600, popularityScore: 95 },
    externalRatings: { imdb: { rating: 8.0 }, tmdb: { rating: 8.1 }, trakt: { rating: 8.3 }, rottenTomatoes: { rating: 95 } },
    genres: [{ id: '3', name: 'Трилер', slug: 'thriller' }, { id: '1', name: 'Драма', slug: 'drama' }],
    releaseDate: '2021-09-17',
    status: 'Returning Series',
    totalSeasons: 2,
    currentSeason: 2,
    currentSeasonEpisodesReleased: 0,
    currentSeasonTotalEpisodes: 7,
    nextEpisodeDate: '2025-12-26',
    badgeKey: 'NEW_EPISODE',
    providers: [
      { id: 1, name: 'Netflix', type: 'stream' },
    ],
  },
  'the-bear': {
    id: '3',
    slug: 'the-bear',
    title: 'Ведмідь',
    originalTitle: 'The Bear',
    overview: 'Молодий шеф-кухар повертається до Чикаго, щоб керувати сімейним сендвіч-рестораном після смерті брата. Він намагається трансформувати і себе, і ресторан, водночас долаючи минулі травми.',
    quickPitch: 'Серіал про кулінарію, сімейні травми та шлях до досконалості.',
    suitableFor: ['драма', 'кулінарія', 'Chef\'s Table'],
    poster: { small: 'https://image.tmdb.org/t/p/w342/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg', medium: 'https://image.tmdb.org/t/p/w500/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg', large: 'https://image.tmdb.org/t/p/w780/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg', original: 'https://image.tmdb.org/t/p/original/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg' },
    stats: { ratingoScore: 87, liveWatchers: 890, popularityScore: 75 },
    externalRatings: { imdb: { rating: 8.5 } },
    genres: [{ id: '1', name: 'Драма', slug: 'drama' }, { id: '4', name: 'Комедія', slug: 'comedy' }],
    releaseDate: '2022-06-23',
    status: 'Returning Series',
    totalSeasons: 3,
    currentSeason: 3,
    currentSeasonEpisodesReleased: 10,
    currentSeasonTotalEpisodes: 10,
    providers: [
      { id: 3, name: 'Disney+', type: 'stream' },
      { id: 4, name: 'Apple TV', type: 'rent' },
    ],
  },
};

// Similar shows demo
const similarShows: MediaCardServerProps[] = [
  {
    id: 's1', slug: 'yellowstone', type: 'show' as const, title: 'Yellowstone',
    poster: { small: 'https://image.tmdb.org/t/p/w342/peNC0eyc3TQJa6x4TdKcBPNP4t0.jpg', medium: 'https://image.tmdb.org/t/p/w500/peNC0eyc3TQJa6x4TdKcBPNP4t0.jpg', large: '', original: '' },
    stats: { ratingoScore: 81 }, externalRatings: { imdb: { rating: 8.7 } },
  },
  {
    id: 's2', slug: 'succession', type: 'show' as const, title: 'Succession',
    poster: { small: 'https://image.tmdb.org/t/p/w342/7HW47XbkNQ5fiwQFYGWdw9gs144.jpg', medium: 'https://image.tmdb.org/t/p/w500/7HW47XbkNQ5fiwQFYGWdw9gs144.jpg', large: '', original: '' },
    stats: { ratingoScore: 88 }, externalRatings: { imdb: { rating: 8.8 } },
  },
  {
    id: 's3', slug: 'breaking-bad', type: 'show' as const, title: 'Breaking Bad',
    poster: { small: 'https://image.tmdb.org/t/p/w342/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', medium: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', large: '', original: '' },
    stats: { ratingoScore: 96 }, externalRatings: { imdb: { rating: 9.5 } },
  },
];

export default async function ShowDetailsPage({ params }: ShowDetailsPageProps) {
  const { slug } = await params;
  const dict = getDictionary('uk');
  const show = demoShows[slug];

  if (!show) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Tv className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{dict.errors.notFound}</h1>
          <Link href={'/' as Route} className="text-blue-400 hover:text-blue-300">
            ← {dict.details.backToHome}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* 0. App bar */}
      <header className="sticky top-0 z-50 bg-transparent backdrop-blur border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href={'/' as Route}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">{dict.details.backToHome}</span>
          </Link>
          <button className="text-zinc-400 hover:text-white transition-colors p-2">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* 1. Hero with Quick Pitch - FULL WIDTH */}
      <DetailsHero
        title={show.title}
        originalTitle={show.originalTitle}
        poster={show.poster}
        backdrop={show.backdrop}
        releaseDate={show.releaseDate}
        genres={show.genres}
        stats={show.stats}
        externalRatings={show.externalRatings}
        badgeKey={show.badgeKey}
        rank={show.rank}
        quickPitch={show.quickPitch}
        dict={dict}
      />

      <div className="bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* 2. Data Verdict with integrated CTA */}
        {slug === 'squid-game' && (
          <DataVerdict
            type="season_comparison"
            message="Другий сезон стартував слабше першого"
            context="Рейтинг IMDb: 8.0 (S2) vs 8.7 (S1)"
            confidence="high"
            showCta
            ctaProps={{
              isSaved: false,
              hasNewEpisodes: show.badgeKey === 'NEW_EPISODE',
            }}
            dict={dict}
          />
        )}
        {slug === 'the-bear' && (
          <DataVerdict
            type="genre_match"
            message="Для фанатів повільних, напружених драм про кулінарію"
            showCta
            ctaProps={{
              isSaved: false,
              hasNewEpisodes: false,
            }}
            dict={dict}
          />
        )}

        {/* 3. Standalone CTA for shows without verdict */}
        {!['squid-game', 'the-bear'].includes(slug) && (
          <DetailsCtaRow
            hasNewEpisodes={show.badgeKey === 'NEW_EPISODE'}
            dict={dict}
          />
        )}

        {/* 4. "Suitable for" tags (moved from Quick Pitch) */}
        {show.suitableFor && show.suitableFor.length > 0 && (
          <section className="-mt-2">
            <p className="text-sm text-zinc-500">
              {dict.details.quickPitch.suitable}:{' '}
              <span className="text-zinc-400">{show.suitableFor.join(', ')}</span>
            </p>
          </section>
        )}

        {/* 5. Overview - collapsed by default */}
        <details className="group">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-400">
                {dict.details.overview.title}
              </h2>
              <span className="text-xs text-blue-400 group-open:hidden">
                {dict.details.showMore}
              </span>
              <span className="text-xs text-blue-400 hidden group-open:inline">
                {dict.details.showLess}
              </span>
            </div>
          </summary>
          <p className="text-zinc-300 leading-relaxed mt-3">
            {show.overview}
          </p>
        </details>

        {/* 6. Trailer button (TODO: add modal) */}
        {show.primaryTrailerKey && (
          <section>
            <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
              ▶ {dict.details.trailer.watch}
            </button>
          </section>
        )}

        {/* 7. Show status */}
        <ShowStatus
          currentSeason={show.currentSeason}
          currentSeasonEpisodesReleased={show.currentSeasonEpisodesReleased}
          currentSeasonTotalEpisodes={show.currentSeasonTotalEpisodes}
          nextEpisodeDate={show.nextEpisodeDate}
          status={show.status}
          dict={dict}
        />

        {/* 8. Where to watch */}
        <ProvidersList providers={show.providers} dict={dict} />

        {/* 9. Similar */}
        <SimilarCarousel items={similarShows} locale="uk" dict={dict} />
      </div>
      </div>
    </main>
  );
}
