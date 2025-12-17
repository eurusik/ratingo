/**
 * Home page with real trending shows and movies from API.
 */

import Link from 'next/link';
import type { MediaCardServerProps } from '@/modules/home';
import { MediaCardServer, HeroSection, Top3SectionServer, TrendingCarousel } from '@/modules/home';
import { getDictionary } from '@/shared/i18n';
import { catalogApi } from '@/core/api';
import { Flame, Film, Clapperboard, Tv } from 'lucide-react';

/** Map API item to MediaCardServerProps */
function toCardProps(item: Record<string, unknown>, type: 'show' | 'movie'): MediaCardServerProps {
  return {
    id: item.id as string,
    slug: item.slug as string,
    type,
    title: item.title as string,
    poster: (item.poster as MediaCardServerProps['poster']) ?? undefined,
    stats: (item.stats as MediaCardServerProps['stats']) ?? undefined,
    externalRatings: (item.externalRatings as MediaCardServerProps['externalRatings']) ?? undefined,
    showProgress: (item.showProgress as MediaCardServerProps['showProgress']) ?? undefined,
    releaseDate: (item.releaseDate as string) ?? undefined,
    badgeKey: ((item.card as Record<string, unknown>)?.badgeKey as MediaCardServerProps['badgeKey']) ?? undefined,
  };
}

export default async function HomePage() {
  const dict = getDictionary('uk');
  
  // Fetch all data in parallel
  const [heroItems, trendingShowsData, trendingMoviesData, nowPlayingData, newOnDigitalData] = await Promise.all([
    catalogApi.getHeroItems({ type: 'show' }).catch(() => []),
    catalogApi.getTrendingShows({ limit: 12 }).catch(() => ({ data: [] })),
    catalogApi.getTrendingMovies({ limit: 12 }).catch(() => ({ data: [] })),
    catalogApi.getNowPlayingMovies({ limit: 12 }).catch(() => ({ data: [] })),
    catalogApi.getNewOnDigitalMovies({ limit: 12 }).catch(() => ({ data: [] })),
  ]);

  // Extract data arrays
  const shows = Array.isArray(trendingShowsData) 
    ? trendingShowsData 
    : ((trendingShowsData as Record<string, unknown>).data as unknown[]) ?? [];
  
  const trendingMovies = Array.isArray(trendingMoviesData)
    ? trendingMoviesData
    : ((trendingMoviesData as Record<string, unknown>).data as unknown[]) ?? [];
  
  const nowPlayingMovies = Array.isArray(nowPlayingData)
    ? nowPlayingData
    : ((nowPlayingData as Record<string, unknown>).data as unknown[]) ?? [];
  
  const newOnDigitalMovies = Array.isArray(newOnDigitalData)
    ? newOnDigitalData
    : ((newOnDigitalData as Record<string, unknown>).data as unknown[]) ?? [];

  // Map hero items to MediaCardServerProps
  const top3Cards = (heroItems ?? []).map((item) => 
    toCardProps(item as Record<string, unknown>, (item as Record<string, unknown>).type as 'show' | 'movie')
  );

  // Map all content to MediaCardServerProps
  const showCards = shows.map((show) => toCardProps(show as Record<string, unknown>, 'show'));
  const trendingMovieCards = trendingMovies.map((movie) => toCardProps(movie as Record<string, unknown>, 'movie'));
  const nowPlayingCards = nowPlayingMovies.map((movie) => toCardProps(movie as Record<string, unknown>, 'movie'));
  const newDigitalCards = newOnDigitalMovies.map((movie) => toCardProps(movie as Record<string, unknown>, 'movie'));

  // Filter out hero items from trending shows to avoid duplicates
  const heroIds = new Set((heroItems ?? []).map((item) => item.id));
  const catalogCards = showCards.filter(card => !heroIds.has(card.id));

  return (
    <main className="min-h-screen">
      {/* Hero Banner - Top 1 */}
      {top3Cards[0] && (
        <HeroSection
          item={{
            ...top3Cards[0],
            backdrop: (heroItems[0] as any)?.backdrop ?? null,
          }}
          locale="uk"
        />
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        {/* Top 2-3 */}
        {top3Cards.length >= 2 && (
          <Top3SectionServer items={top3Cards.slice(1)} locale="uk" className="mb-12" />
        )}

        {/* Trending Shows */}
        <TrendingCarousel
          title={dict.home.sections.trending}
          titleIcon={<Tv className="w-5 h-5 text-blue-500" />}
          actions={
            <Link
              href="/browse/trending"
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

        {/* Trending Movies */}
        {trendingMovieCards.length > 0 && (
          <TrendingCarousel
            title={dict.home.sections.movies}
            titleIcon={<Film className="w-5 h-5 text-purple-500" />}
            actions={
              <Link
                href="/browse/movies"
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

        {/* Now Playing in Theaters */}
        {nowPlayingCards.length > 0 && (
          <TrendingCarousel
            title="Зараз у кіно"
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

        {/* New on Digital */}
        {newDigitalCards.length > 0 && (
          <TrendingCarousel
            title="Нове на стрімінгу"
            titleIcon={<Flame className="w-5 h-5 text-orange-500" />}
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
      </div>
    </main>
  );
}
