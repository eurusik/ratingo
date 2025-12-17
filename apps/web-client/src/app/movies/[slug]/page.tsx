/**
 * Movie details page
 *
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import type { Route } from 'next';
import { ArrowLeft, Film, Share2 } from 'lucide-react';
import { getDictionary } from '@/shared/i18n';
import {
  DetailsHero,
  DetailsCtaRow,
  DetailsQuickPitch,
  MovieRelease,
  ProvidersList,
  SimilarCarousel,
  type BadgeKey,
} from '@/modules/details';
import type { MediaCardServerProps } from '@/modules/home';

// ISR: Revalidate every hour
export const revalidate = 3600;

interface PageParams {
  params: Promise<{ slug: string }>;
}

/**
 * Dynamic metadata for SEO.
 * TODO: Replace with API call when movie API is ready.
 */
export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { slug } = await params;
  
  // For now, generate basic metadata from slug
  const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  return {
    title,
    description: `Дивіться ${title} на Ratingo`,
    openGraph: {
      title: `${title} | Ratingo`,
      description: `Дивіться ${title} на Ratingo`,
      type: 'video.movie',
    },
  };
}

interface MovieDetailsPageProps {
  params: Promise<{ slug: string }>;
}

// Demo data (will be replaced with API call)
const demoMovies: Record<string, {
  id: string;
  slug: string;
  title: string;
  originalTitle?: string;
  overview: string;
  quickPitch: string;
  suitableFor: string[];
  poster: { small: string; medium: string; large: string; original: string };
  backdrop?: { small: string; medium: string; large: string; original: string };
  stats: { ratingoScore: number; liveWatchers?: number };
  externalRatings: { imdb?: { rating: number } };
  genres: { id: string; name: string; slug: string }[];
  releaseDate: string;
  digitalReleaseDate?: string;
  runtime?: number;
  badgeKey?: BadgeKey;
  rank?: number;
  primaryTrailerKey?: string;
  providers?: { id: number; name: string; logo?: string; type: 'stream' | 'rent' | 'buy' }[];
}> = {
  'dune-part-two': {
    id: '4',
    slug: 'dune-part-two',
    title: 'Дюна: Частина друга',
    originalTitle: 'Dune: Part Two',
    overview: 'Пол Атрейдес об\'єднується з Чані та фременами, щоб помститися змовникам, які знищили його сім\'ю. Опинившись перед вибором між коханням свого життя і долею відомого всесвіту, він намагається запобігти жахливому майбутньому, яке тільки він може передбачити.',
    quickPitch: 'Епічна сага про помсту, владу та виживання на пустельній планеті Арракіс.',
    suitableFor: ['фантастика', 'епік', 'Зоряні війни'],
    poster: { small: 'https://image.tmdb.org/t/p/w342/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', medium: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', large: 'https://image.tmdb.org/t/p/w780/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', original: 'https://image.tmdb.org/t/p/original/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg' },
    stats: { ratingoScore: 84, liveWatchers: 2100 },
    externalRatings: { imdb: { rating: 8.6 } },
    genres: [{ id: '5', name: 'Фантастика', slug: 'sci-fi' }, { id: '6', name: 'Пригоди', slug: 'adventure' }],
    releaseDate: '2024-02-27',
    digitalReleaseDate: '2024-04-15',
    runtime: 166,
    badgeKey: 'TRENDING',
    primaryTrailerKey: 'Way9Dexny3w',
    providers: [
      { id: 1, name: 'Netflix', type: 'stream' },
      { id: 5, name: 'Apple TV', type: 'rent' },
    ],
  },
  'oppenheimer': {
    id: '5',
    slug: 'oppenheimer',
    title: 'Оппенгеймер',
    originalTitle: 'Oppenheimer',
    overview: 'Історія американського вченого Дж. Роберта Оппенгеймера та його ролі в розробці атомної бомби. Фільм досліджує складні моральні дилеми, з якими він стикнувся, і наслідки його роботи для людства.',
    quickPitch: 'Біографічний трилер про створення атомної бомби та моральну ціну наукового прогресу.',
    suitableFor: ['драма', 'історія', 'Нолан'],
    poster: { small: 'https://image.tmdb.org/t/p/w342/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', medium: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', large: 'https://image.tmdb.org/t/p/w780/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', original: 'https://image.tmdb.org/t/p/original/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg' },
    stats: { ratingoScore: 81, liveWatchers: 1800 },
    externalRatings: { imdb: { rating: 8.3 } },
    genres: [{ id: '1', name: 'Драма', slug: 'drama' }, { id: '7', name: 'Історичний', slug: 'history' }, { id: '3', name: 'Трилер', slug: 'thriller' }],
    releaseDate: '2023-07-19',
    digitalReleaseDate: '2023-09-12',
    runtime: 180,
    providers: [
      { id: 1, name: 'Netflix', type: 'stream' },
      { id: 6, name: 'Amazon Prime', type: 'stream' },
    ],
  },
};

// Similar movies demo
const similarMovies: MediaCardServerProps[] = [
  {
    id: 'm1', slug: 'blade-runner-2049', type: 'movie' as const, title: 'Blade Runner 2049',
    poster: { small: 'https://image.tmdb.org/t/p/w342/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg', medium: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg', large: '', original: '' },
    stats: { ratingoScore: 81 }, externalRatings: { imdb: { rating: 8.0 } },
  },
  {
    id: 'm2', slug: 'interstellar', type: 'movie' as const, title: 'Interstellar',
    poster: { small: 'https://image.tmdb.org/t/p/w342/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', medium: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', large: '', original: '' },
    stats: { ratingoScore: 87 }, externalRatings: { imdb: { rating: 8.7 } },
  },
  {
    id: 'm3', slug: 'inception', type: 'movie' as const, title: 'Inception',
    poster: { small: 'https://image.tmdb.org/t/p/w342/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', medium: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', large: '', original: '' },
    stats: { ratingoScore: 87 }, externalRatings: { imdb: { rating: 8.8 } },
  },
];

function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}г ${mins}хв` : `${mins}хв`;
}

export default async function MovieDetailsPage({ params }: MovieDetailsPageProps) {
  const { slug } = await params;
  const dict = getDictionary('uk');

  // Get demo data (will be replaced with API fetch)
  const movie = demoMovies[slug];

  if (!movie) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Film className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">{dict.errors.notFound}</h1>
          <Link href={'/' as Route} className="text-blue-400 hover:text-blue-300">
            {dict.details.backToHome}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950">
      {/* 0. App bar */}
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
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

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* 1. Hero with Quick Pitch */}
        <DetailsHero
          title={movie.title}
          originalTitle={movie.originalTitle}
          poster={movie.poster}
          backdrop={movie.backdrop}
          releaseDate={movie.releaseDate}
          genres={movie.genres}
          stats={movie.stats}
          externalRatings={movie.externalRatings}
          badgeKey={movie.badgeKey}
          rank={movie.rank}
          quickPitch={movie.quickPitch}
          dict={dict}
        />

        {/* 2. Standalone CTA (movies typically don't have verdicts) */}
        <DetailsCtaRow dict={dict} />

        {/* 3. "Suitable for" tags */}
        {movie.suitableFor && movie.suitableFor.length > 0 && (
          <section className="-mt-2">
            <p className="text-sm text-zinc-500">
              {dict.details.quickPitch.suitable}:{' '}
              <span className="text-zinc-400">{movie.suitableFor.join(', ')}</span>
            </p>
          </section>
        )}

        {/* 4. Overview - collapsed by default */}
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
            {movie.overview}
          </p>
        </details>

        {/* 5. Trailer button (TODO: add modal) */}
        {movie.primaryTrailerKey && (
          <section>
            <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
              ▶ {dict.details.trailer.watch} {movie.runtime && `(${formatRuntime(movie.runtime)})`}
            </button>
          </section>
        )}

        {/* 6. Movie release */}
        <MovieRelease
          releaseDate={movie.releaseDate}
          digitalReleaseDate={movie.digitalReleaseDate}
          dict={dict}
        />

        {/* 7. Where to watch */}
        <ProvidersList providers={movie.providers} dict={dict} />

        {/* 8. Similar */}
        <SimilarCarousel items={similarMovies} locale="uk" dict={dict} />
      </div>
    </main>
  );
}
