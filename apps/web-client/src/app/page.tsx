/**
 * Home page with real trending shows from API.
 */

import type { MediaCardServerProps } from '@/modules/home';
import { MediaCardServer, HeroSection, Top3SectionServer, TrendingCarousel } from '@/modules/home';
import { getDictionary } from '@/shared/i18n';
import { catalogApi } from '@/core/api';
import { Flame } from 'lucide-react';

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
  
  // Fetch Top-3 hero items
  const heroItems = (await catalogApi.getHeroItems({ type: 'show' })) ?? [];
  
  // Fetch trending shows for grid
  const trendingData = await catalogApi.getTrendingShows({ limit: 20 });
  const shows = Array.isArray(trendingData) 
    ? trendingData 
    : ((trendingData as Record<string, unknown>).data as unknown[]) ?? [];

  // Map hero items to MediaCardServerProps
  const top3Cards = heroItems.map((item) => 
    toCardProps(item as Record<string, unknown>, (item as Record<string, unknown>).type as 'show' | 'movie')
  );

  // Map trending shows to MediaCardServerProps
  const mediaCards = shows.map((show) => 
    toCardProps(show as Record<string, unknown>, 'show')
  );

  // Filter out hero items from trending to avoid duplicates
  const heroIds = new Set(heroItems.map((item) => item.id));
  const catalogCards = mediaCards.filter(card => !heroIds.has(card.id));

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Top 2-3 */}
        {top3Cards.length >= 2 && (
          <Top3SectionServer items={top3Cards.slice(1)} locale="uk" className="mb-12" />
        )}

        {/* Trending section */}
        <TrendingCarousel
          title={dict.home.sections.trending}
          titleIcon={<Flame className="w-5 h-5 text-orange-500" />}
          actions={
            <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              {dict.common.showAll} →
            </button>
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
      </div>
    </main>
  );
}
