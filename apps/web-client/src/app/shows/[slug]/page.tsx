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
  TrailersCarousel,
  CastCarousel,
  type BadgeKey,
  type Video,
  type CastMember,
  type CrewMember,
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
  totalEpisodes?: number;
  currentSeason?: number;
  currentSeasonEpisodesReleased?: number;
  currentSeasonTotalEpisodes?: number;
  nextEpisodeDate?: string;
  badgeKey?: BadgeKey;
  rank?: number;
  primaryTrailerKey?: string;
  videos?: Video[];
  cast?: CastMember[];
  crew?: CrewMember[];
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
    totalEpisodes: 10,
    currentSeason: 1,
    currentSeasonEpisodesReleased: 8,
    currentSeasonTotalEpisodes: 10,
    nextEpisodeDate: '2025-12-19',
    badgeKey: 'TRENDING',
    rank: 3,
    primaryTrailerKey: 'dQw4w9WgXcQ',
    videos: [
      { key: 'dQw4w9WgXcQ', name: 'Landman | Official Trailer', site: 'YouTube', type: 'Trailer', official: true, language: 'en', country: 'US' },
      { key: 'L_jWHffIx5E', name: 'Landman | Teaser', site: 'YouTube', type: 'Trailer', official: true, language: 'en', country: 'US' },
      { key: '9bZkp7q19f0', name: 'Landman | Behind the Scenes', site: 'YouTube', type: 'Trailer', official: false, language: 'en', country: 'US' },
    ],
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
    totalEpisodes: 17,
    currentSeason: 2,
    currentSeasonEpisodesReleased: 0,
    currentSeasonTotalEpisodes: 7,
    nextEpisodeDate: '2025-12-26',
    badgeKey: 'NEW_EPISODE',
    videos: [
      { key: 'PZ5typf6LC8', name: 'Squid Game: Season 2 | Official Trailer', site: 'YouTube', type: 'Trailer', official: true, language: 'en', country: 'US' },
      { key: 'T3tIW8iS-io', name: 'Squid Game 2 | Teaser', site: 'YouTube', type: 'Trailer', official: true, language: 'ko', country: 'KR' },
      { key: 'eKS0GyKmH4g', name: 'Squid Game | Season 1 Recap', site: 'YouTube', type: 'Trailer', official: false, language: 'en', country: 'US' },
    ],
    cast: [
      { personId: 'tmdb:1223786', slug: 'lee-jung-jae', tmdbId: 1223786, name: 'І Чон Дже', character: 'Сон Гі Хун', profilePath: '/r0wtbAW7CbiB7fPbxR1C1cvqLOk.jpg', order: 0 },
      { personId: 'tmdb:1225809', slug: 'park-hae-soo', tmdbId: 1225809, name: 'Пак Хе Су', character: 'Чо Сан У', profilePath: '/q1hLPHUPG6zixyIj42GhjWPtkOX.jpg', order: 1 },
      { personId: 'tmdb:1246027', slug: 'wi-ha-jun', tmdbId: 1246027, name: 'Ві Ха Джун', character: 'Хван Чжун Хо', profilePath: '/dX0Mb1MrCQKbdeBRVkdIJQz3WGB.jpg', order: 2 },
      { personId: 'tmdb:1586180', slug: 'jung-ho-yeon', tmdbId: 1586180, name: 'Чон Хо Ен', character: 'Кан Се Бек', profilePath: '/j9f3z9FVoPhsZJBJmMaUrLjLUzv.jpg', order: 3 },
      { personId: 'tmdb:1223784', slug: 'o-yeong-su', tmdbId: 1223784, name: 'О Ен Су', character: 'О Іл Нам', profilePath: '/lGv7pF06lkGEli9P4mV3rfdtT6A.jpg', order: 4 },
    ],
    crew: [
      { personId: 'tmdb:1230344', slug: 'hwang-dong-hyuk', tmdbId: 1230344, name: 'Хван Дон Хек', job: 'Director', department: 'Directing', profilePath: '/zKq8QqxEY3hLT1pWIQqV9jTCL0N.jpg' },
    ],
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
    totalEpisodes: 28,
    currentSeason: 3,
    currentSeasonEpisodesReleased: 10,
    currentSeasonTotalEpisodes: 10,
    videos: [
      { key: 'y-cqqAJIXhs', name: 'The Bear | Season 3 Official Trailer', site: 'YouTube', type: 'Trailer', official: true, language: 'en', country: 'US' },
      { key: 'U69uEL8eHjM', name: 'The Bear | Season 2 Trailer', site: 'YouTube', type: 'Trailer', official: true, language: 'en', country: 'US' },
    ],
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

        {/* 1. "Suitable for" tags - FIRST, before overview */}
        {show.suitableFor && show.suitableFor.length > 0 && (
          <section className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              {dict.details.quickPitch.suitable}:
            </span>
            {show.suitableFor.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-xs font-medium text-zinc-300 bg-zinc-800/60 rounded-full border border-zinc-700/50"
              >
                {tag}
              </span>
            ))}
          </section>
        )}

        {/* 2. Overview */}
        <section className="space-y-2">
          <p className="text-base md:text-lg text-zinc-200 leading-relaxed">
            {show.overview}
          </p>
        </section>

        {/* 3. Data Verdict with integrated CTA */}
        {slug === 'squid-game' && (
          <DataVerdict
            type="season_comparison"
            message="Другий сезон стартував слабше першого"
            context="Рейтинг IMDb: 8.0 (S2) vs 8.7 (S1)"
            confidence="high"
            showCta
            ctaProps={{
              isSaved: false,
              hintKey: 'afterAllEpisodes', // Context-specific: wait for all episodes
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

        {/* 4. Standalone CTA for shows without verdict */}
        {!['squid-game', 'the-bear'].includes(slug) && (
          <DetailsCtaRow
            hasNewEpisodes={show.badgeKey === 'NEW_EPISODE'}
            dict={dict}
          />
        )}

        {/* 5. Genres as chips */}
        <section className="flex flex-wrap items-center gap-2">
          {show.genres.map((genre) => (
            <span
              key={genre.id}
              className="px-3 py-1.5 text-sm font-medium text-zinc-300 bg-zinc-800/60 rounded-full border border-zinc-700/50 hover:border-zinc-600 transition-colors"
            >
              {genre.name}
            </span>
          ))}
        </section>

        {/* 5. Trailers carousel */}
        {show.videos && show.videos.length > 0 && (
          <TrailersCarousel
            videos={show.videos}
            primaryTrailer={show.videos.find(v => v.key === show.primaryTrailerKey)}
          />
        )}

        {/* Divider */}
        <div className="border-t border-zinc-800/50" />

        {/* 6. Show status */}
        <ShowStatus
          currentSeason={show.currentSeason}
          currentSeasonEpisodesReleased={show.currentSeasonEpisodesReleased}
          currentSeasonTotalEpisodes={show.currentSeasonTotalEpisodes}
          nextEpisodeDate={show.nextEpisodeDate}
          status={show.status}
          totalSeasons={show.totalSeasons}
          totalEpisodes={show.totalEpisodes}
          dict={dict}
        />

        {/* Divider */}
        <div className="border-t border-zinc-800/50" />

        {/* 7. Cast & Crew */}
        {show.cast && show.cast.length > 0 && (
          <CastCarousel
            cast={show.cast}
            crew={show.crew}
          />
        )}

        {/* Divider */}
        <div className="border-t border-zinc-800/50" />

        {/* 7. Where to watch */}
        <ProvidersList providers={show.providers} dict={dict} />

        {/* 9. Similar */}
        <SimilarCarousel items={similarShows} locale="uk" dict={dict} />
      </div>
      </div>
    </main>
  );
}
