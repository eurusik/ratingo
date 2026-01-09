/**
 * Home page with real trending shows and movies from API.
 */

import Link from 'next/link';
import type { MediaCardServerProps } from '@/modules/home';
import {
  MediaCardServer,
  HeroSection,
  Top3SectionServer,
  TrendingCarousel,
  MediaCardsWithStatus,
} from '@/modules/home';
import { getDictionary } from '@/shared/i18n';
import { catalogApi } from '@/core/api';
import { TrendingUp, Clapperboard, Sparkles, Film, Tv } from 'lucide-react';

/** Map API item to MediaCardServerProps */
function toCardProps(item: Record<string, unknown>, type: 'show' | 'movie'): MediaCardServerProps & { hasRecentEpisode?: boolean } {
  const card = item.card as Record<string, unknown> | undefined;
  // Use mediaItemId for saving (foreign key to media_items), fallback to id for shows
  const mediaItemId = (item.mediaItemId as string) ?? (item.id as string);
  return {
    id: mediaItemId,
    slug: item.slug as string,
    type,
    title: item.title as string,
    poster: (item.poster as MediaCardServerProps['poster']) ?? undefined,
    stats: (item.stats as MediaCardServerProps['stats']) ?? undefined,
    externalRatings: (item.externalRatings as MediaCardServerProps['externalRatings']) ?? undefined,
    showProgress: (item.showProgress as MediaCardServerProps['showProgress']) ?? undefined,
    releaseDate: (item.releaseDate as string) ?? undefined,
    badgeKey: (card?.badgeKey as MediaCardServerProps['badgeKey']) ?? undefined,
    listContext: (card?.listContext as string) ?? undefined,
    hasRecentEpisode: (item.hasRecentEpisode as boolean) ?? false,
  };
}

export default async function HomePage() {
  const dict = getDictionary('uk');

  // Fetch all data in parallel
  const [
    heroItems,
    trendingShowsData,
    trendingMoviesData,
    nowPlayingData,
    newOnDigitalData,
  ] = await Promise.all([
    catalogApi.getHeroItems({ type: 'show' }).catch(() => []),
    catalogApi.getTrendingShows({ limit: 12 }).catch(() => ({ data: [] })),
    catalogApi.getTrendingMovies({ limit: 12 }).catch(() => ({ data: [] })),
    catalogApi.getNowPlayingMovies({ limit: 12 }).catch(() => ({ data: [] })),
    catalogApi.getNewOnDigitalMovies({ limit: 12 }).catch(() => ({ data: [] })),
  ]);

  // Extract data arrays
  const shows = Array.isArray(trendingShowsData)
    ? trendingShowsData
    : (((trendingShowsData as Record<string, unknown>).data as unknown[]) ?? []);

  const trendingMovies = Array.isArray(trendingMoviesData)
    ? trendingMoviesData
    : (((trendingMoviesData as Record<string, unknown>).data as unknown[]) ?? []);

  const nowPlayingMovies = Array.isArray(nowPlayingData)
    ? nowPlayingData
    : (((nowPlayingData as Record<string, unknown>).data as unknown[]) ?? []);

  const newOnDigitalMovies = Array.isArray(newOnDigitalData)
    ? newOnDigitalData
    : (((newOnDigitalData as Record<string, unknown>).data as unknown[]) ?? []);

  // Map hero items to MediaCardServerProps
  const top3Cards = (heroItems ?? []).map((item) =>
    toCardProps(
      item as Record<string, unknown>,
      (item as Record<string, unknown>).type as 'show' | 'movie',
    ),
  );

  // Map all content to MediaCardServerProps
  const showCards = shows.map((show) => toCardProps(show as Record<string, unknown>, 'show'));
  const trendingMovieCards = trendingMovies.map((movie) =>
    toCardProps(movie as Record<string, unknown>, 'movie'),
  );
  const nowPlayingCards = nowPlayingMovies.map((movie) =>
    toCardProps(movie as Record<string, unknown>, 'movie'),
  );
  const newDigitalCards = newOnDigitalMovies.map((movie) =>
    toCardProps(movie as Record<string, unknown>, 'movie'),
  );

  // Filter out hero items from trending shows to avoid duplicates
  const heroIds = new Set((heroItems ?? []).map((item) => item.id));
  const catalogCards = showCards.filter((card) => !heroIds.has(card.id));

  // Collect all media item IDs for batch status fetching
  const allMediaItemIds = [
    ...top3Cards.map((c) => c.id),
    ...catalogCards.map((c) => c.id),
    ...trendingMovieCards.map((c) => c.id),
    ...nowPlayingCards.map((c) => c.id),
    ...newDigitalCards.map((c) => c.id),
  ].filter(Boolean);

  return (
    <MediaCardsWithStatus mediaItemIds={allMediaItemIds}>
      <main className="min-h-screen">
        {/* Hero Banner - Top 1 */}
        {top3Cards[0] && (
          <HeroSection
            item={{
              ...top3Cards[0],
              backdrop:
                (
                  heroItems[0] as {
                    backdrop?: {
                      small: string;
                      medium: string;
                      large: string;
                      original: string;
                    } | null;
                  }
                )?.backdrop ?? null,
            }}
            locale="uk"
          />
        )}

        {/* Main content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
          {/* Top 2-3: show only when we have at least 2 cards for this section */}
          {top3Cards.length >= 3 && (
            <Top3SectionServer items={top3Cards.slice(1, 3)} locale="uk" className="mb-12" />
          )}

          {/* Серіали в тренді */}
          <TrendingCarousel
            title={dict.home.sections.shows}
            titleIcon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
            actions={
              <Link
                href="/browse/shows-trending"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                {dict.common.showAll} →
              </Link>
            }
          >
            {catalogCards.map((item) => (
              <div
                key={item.id}
                className="flex-none w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px]"
              >
                <MediaCardServer {...item} locale="uk" />
              </div>
            ))}
          </TrendingCarousel>

          {/* Нові епізоди в тренді 📺 */}
          {(() => {
            // Filter trending shows with recent episodes
            const showsWithNewEpisodes = showCards.filter((card) => card.hasRecentEpisode);

            if (showsWithNewEpisodes.length === 0) return null;

            return (
              <section className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Tv className="w-5 h-5 text-blue-400" />
                    {dict.home.sections.newEpisodes}
                  </h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {showsWithNewEpisodes.slice(0, 6).map((item) => (
                    <MediaCardServer key={item.id} {...item} locale="uk" />
                  ))}
                </div>
              </section>
            );
          })()}

          {/* ═══ Візуальне розділення: Фільми ═══ */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-zinc-950 px-4 text-sm text-zinc-500 flex items-center gap-2">
                <Film className="w-4 h-4" />
                {dict.mediaType.movies}
              </span>
            </div>
          </div>

          {/* Зараз у кіно 🎬 */}
          {nowPlayingCards.length > 0 && (
            <TrendingCarousel
              title={dict.browse.moviesNowPlaying.title}
              titleIcon={<Clapperboard className="w-5 h-5 text-red-500" />}
              actions={
                <Link
                  href="/browse/movies-now-playing"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {dict.common.showAll} →
                </Link>
              }
            >
              {nowPlayingCards.map((item) => (
                <div
                  key={item.id}
                  className="flex-none w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px]"
                >
                  <MediaCardServer {...item} locale="uk" />
                </div>
              ))}
            </TrendingCarousel>
          )}

          {/* Нове на стрімінгу ✨ */}
          {newDigitalCards.length > 0 && (
            <TrendingCarousel
              title={dict.browse.moviesDigital.title}
              titleIcon={<Sparkles className="w-5 h-5 text-amber-400" />}
              actions={
                <Link
                  href="/browse/movies-digital"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {dict.common.showAll} →
                </Link>
              }
            >
              {newDigitalCards.map((item) => (
                <div
                  key={item.id}
                  className="flex-none w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px]"
                >
                  <MediaCardServer {...item} locale="uk" />
                </div>
              ))}
            </TrendingCarousel>
          )}

          {/* Фільми в тренді */}
          {trendingMovieCards.length > 0 && (
            <TrendingCarousel
              title={dict.home.sections.movies}
              titleIcon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
              actions={
                <Link
                  href="/browse/movies-trending"
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {dict.common.showAll} →
                </Link>
              }
            >
              {trendingMovieCards.map((item) => (
                <div
                  key={item.id}
                  className="flex-none w-[150px] sm:w-[180px] md:w-[200px] lg:w-[220px]"
                >
                  <MediaCardServer {...item} locale="uk" />
                </div>
              ))}
            </TrendingCarousel>
          )}
        </div>
      </main>
    </MediaCardsWithStatus>
  );
}
