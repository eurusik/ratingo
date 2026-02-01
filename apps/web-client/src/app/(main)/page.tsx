/**
 * Home page with trending shows and movies.
 */

// Revalidate every 60 seconds to keep trending data fresh
export const revalidate = 60;

import Link from 'next/link';
import {
  MediaCardServer,
  HeroSection,
  Top3SectionServer,
  TrendingCarousel,
  MediaCardsWithStatus,
  NewEpisodesSection,
  toCardProps,
  mapNewEpisodes,
} from '@/modules/home';
import { getDictionary } from '@/shared/i18n';
import { LazySection } from '@/shared/components';
import { catalogApi, type HeroData, type WatchingNowData } from '@/core/api';
import { TrendingUp, Clapperboard, Sparkles, Film } from 'lucide-react';

export default async function HomePage() {
  const dict = getDictionary('uk');

  // Fetch all data in parallel (silent fallback on error)
  // Home context applies stricter freshness filtering (excludes finished classics)
  const [
    heroItems,
    watchingNowItems,
    trendingShowsData,
    trendingMoviesData,
    nowPlayingData,
    newOnDigitalData,
    newEpisodesData,
  ] = await Promise.all([
    catalogApi.getHeroItems({ type: 'show' }).catch((): HeroData => []),
    catalogApi.getWatchingNow().catch((): WatchingNowData => []),
    catalogApi.getTrendingShows({ limit: 12, context: 'home' }).catch(() => ({ data: [] })),
    catalogApi.getTrendingMovies({ limit: 12, context: 'home' }).catch(() => ({ data: [] })),
    catalogApi.getNowPlayingMovies({ limit: 12 }).catch(() => ({ data: [] })),
    catalogApi.getNewOnDigitalMovies({ limit: 12 }).catch(() => ({ data: [] })),
    catalogApi.getNewEpisodes({ days: 7, limit: 15 }).catch(() => ({ data: [] })),
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

  // Map to card props
  const heroCards = (heroItems ?? []).map((item) =>
    toCardProps(item as Record<string, unknown>, (item as { type: 'show' | 'movie' }).type),
  );

  // Filter watching-now to exclude items already in hero (avoid duplicates)
  const heroMediaItemIds = new Set((heroItems ?? []).map((item) => item.mediaItemId));
  const filteredWatchingNowItems = (watchingNowItems ?? []).filter(
    (item) => !heroMediaItemIds.has(item.mediaItemId),
  );
  const watchingNowCards = filteredWatchingNowItems.map((item) =>
    toCardProps(item as Record<string, unknown>, (item as { type: 'show' | 'movie' }).type),
  );

  const showCards = shows.map((show) => toCardProps(show as Record<string, unknown>, 'show'));
  const trendingMovieCards = trendingMovies.map((m) =>
    toCardProps(m as Record<string, unknown>, 'movie'),
  );
  const nowPlayingCards = nowPlayingMovies.map((m) =>
    toCardProps(m as Record<string, unknown>, 'movie'),
  );
  const newDigitalCards = newOnDigitalMovies.map((m) =>
    toCardProps(m as Record<string, unknown>, 'movie'),
  );

  // Filter out hero and watching-now items from trending shows
  const watchingNowMediaItemIds = new Set((watchingNowItems ?? []).map((item) => item.mediaItemId));
  const catalogCards = showCards.filter(
    (card) => !heroMediaItemIds.has(card.id) && !watchingNowMediaItemIds.has(card.id),
  );

  // Map new episodes API response to component format
  const newEpisodeItems = mapNewEpisodes(newEpisodesData);

  // Collect all media item IDs for batch status fetching
  const allMediaItemIds = [
    ...heroCards.map((c) => c.id),
    ...watchingNowCards.map((c) => c.id),
    ...catalogCards.map((c) => c.id),
    ...trendingMovieCards.map((c) => c.id),
    ...nowPlayingCards.map((c) => c.id),
    ...newDigitalCards.map((c) => c.id),
  ].filter(Boolean);

  return (
    <MediaCardsWithStatus mediaItemIds={allMediaItemIds}>
      <main className="min-h-screen">
        {/* Hero Banner */}
        {heroCards[0] && heroItems[0] && (
          <HeroSection
            item={{
              ...heroCards[0],
              showProgress: heroItems[0].showProgress ?? null,
              backdrop: heroItems[0].backdrop ?? null,
            }}
            locale="uk"
          />
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
          {/* Top Picks (Hero items #2-4) */}
          {heroCards.length >= 4 && (
            <Top3SectionServer
              items={heroCards.slice(1, 4)}
              title={dict.home.sections.topPicks}
              locale="uk"
              className="mb-12"
              count={3}
            />
          )}

          {/* Trending Shows */}
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

          {/* Watching Now (fresh content by watchers - bridges shows and movies) */}
          {watchingNowCards.length > 0 && (
            <Top3SectionServer
              items={watchingNowCards}
              title={dict.home.sections.watchingNow}
              locale="uk"
              className="my-12"
              count={3}
              startRank={1}
              variant="watchingNow"
            />
          )}

          {/* New Episodes */}
          {newEpisodeItems.length > 0 && <NewEpisodesSection items={newEpisodeItems} locale="uk" />}

          {/* Movies Section - Lazy loaded (below fold) */}
          <LazySection minHeight="600px" rootMargin="200px">
            {/* Visual Separator: Movies */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-cinema-borderSoft" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-cinema-page px-4 text-sm text-cinema-text-muted flex items-center gap-2">
                  <Film className="w-4 h-4" />
                  {dict.mediaType.movies}
                </span>
              </div>
            </div>

            {/* Now Playing */}
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

            {/* New on Streaming */}
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

            {/* Trending Movies */}
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
          </LazySection>
        </div>
      </main>
    </MediaCardsWithStatus>
  );
}
