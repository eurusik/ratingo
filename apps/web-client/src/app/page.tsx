/**
 * Home page with real trending shows from API.
 */

import type { MediaCardServerProps } from '@/modules/home';
import { MediaCardServer, HeroSection, Top3SectionServer } from '@/modules/home';
import { getDictionary } from '@/shared/i18n';
import { catalogApi } from '@/core/api';

export default async function HomePage() {
  const dict = getDictionary('uk');
  
  // Fetch Top-3 hero items
  const heroItems = (await catalogApi.getHeroItems({ type: 'show' })) ?? [];
  
  // Fetch trending shows for grid
  const trendingData = await catalogApi.getTrendingShows({ limit: 20 });
  const shows = Array.isArray(trendingData) ? trendingData : (trendingData as any).data ?? [];

  // Map hero items to MediaCardServerProps
  const top3Cards: MediaCardServerProps[] = heroItems.map((item: any) => ({
    id: item.id,
    slug: item.slug,
    type: item.type,
    title: item.title,
    poster: item.poster ?? undefined,
    stats: item.stats,
    externalRatings: item.externalRatings,
    showProgress: item.showProgress ?? undefined,
    releaseDate: item.releaseDate ?? undefined,
    // 🎯 Hero має card metadata
    badgeKey: item.card?.badgeKey ?? undefined,
    ctaType: item.card?.primaryCta ?? 'OPEN',
    continuePoint: item.card?.continue ?? undefined,
  }));

  // Map trending shows to MediaCardServerProps
  const mediaCards: MediaCardServerProps[] = shows.map((show: any) => ({
    id: show.id,
    slug: show.slug,
    type: 'show',
    title: show.title,
    poster: show.poster ?? undefined,
    stats: show.stats,
    externalRatings: show.externalRatings,
    showProgress: show.showProgress ?? undefined,
    releaseDate: show.releaseDate ?? undefined,
    badgeKey: show.card?.badgeKey ?? undefined,
    ctaType: show.card?.primaryCta ?? 'OPEN',
    continuePoint: show.card?.continue ?? undefined,
  }));

  // Filter out hero items from trending to avoid duplicates
  const heroIds = new Set(heroItems.map((item: any) => item.id));
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

          {/* Cards grid with real data */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {catalogCards.map((item) => (
              <MediaCardServer key={item.id} {...item} locale="uk" />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
