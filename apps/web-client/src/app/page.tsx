/**
 * Home page with real trending shows and movies from API.
 */

import Link from 'next/link';
import type { MediaCardServerProps } from '@/modules/home';
import { MediaCardServer, HeroSection, Top3SectionServer, TrendingCarousel, NewEpisodeCard } from '@/modules/home';
import { getDictionary } from '@/shared/i18n';
import { catalogApi } from '@/core/api';
import { TrendingUp, Clapperboard, Sparkles, Film, Tv } from 'lucide-react';

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
  const [heroItems, trendingShowsData, newEpisodesData, trendingMoviesData, nowPlayingData, newOnDigitalData] = await Promise.all([
    catalogApi.getHeroItems({ type: 'show' }).catch(() => []),
    catalogApi.getTrendingShows({ limit: 12 }).catch(() => ({ data: [] })),
    catalogApi.getNewEpisodes({ days: 7, limit: 10 }).catch(() => ({ data: [] })),
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

  // Extract new episodes
  const newEpisodes = (newEpisodesData as { data: unknown[] })?.data ?? [];

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

        {/* Серіали в тренді */}
        <TrendingCarousel
          title={dict.home.sections.shows}
          titleIcon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
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

        {/* Нові епізоди 📺 */}
        {newEpisodes.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Tv className="w-5 h-5 text-blue-400" />
                {dict.home.sections.newEpisodes}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 bg-zinc-900/50 rounded-xl p-2">
              {(newEpisodes as import('@/core/api/catalog').NewEpisodeItem[]).map((item) => (
                <NewEpisodeCard key={item.showId} item={item} locale="uk" />
              ))}
            </div>
          </section>
        )}

        {/* ═══ Візуальне розділення: Фільми ═══ */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-zinc-800" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-zinc-950 px-4 text-sm text-zinc-500 flex items-center gap-2">
              <Film className="w-4 h-4" />
              Фільми
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
      </div>
    </main>
  );
}
