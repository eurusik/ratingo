/**
 * Browse page for category listings.
 * SSR first page + client-side infinite scroll.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/shared/i18n';
import { catalogApi } from '@/core/api';
import { getCategoryConfig, getValidCategorySlugs, type BrowseCategory } from '@/modules/browse';
import { BrowsePageHeader, MediaGrid } from '@/modules/browse';
import { BrowseInfiniteList } from './browse-infinite-list';
import type { MediaCardServerProps } from '@/modules/home';

// Generate static params for all categories
export function generateStaticParams() {
  return getValidCategorySlugs().map((category) => ({ category }));
}

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}

/**
 * Generate SEO metadata for browse pages.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const config = getCategoryConfig(category);
  const dict = getDictionary('uk');

  if (!config) {
    return { title: 'Не знайдено | Ratingo' };
  }

  // Get title from i18n based on category
  const categoryMap: Record<string, keyof typeof dict.browse> = {
    'trending': 'trending',
    'shows': 'shows',
    'movies': 'movies',
    'movies-trending': 'moviesTrending',
    'movies-now-playing': 'moviesNowPlaying',
    'movies-new-releases': 'moviesNewReleases',
    'movies-digital': 'moviesDigital',
  };
  const browseKey = categoryMap[category];
  const browseDict = browseKey ? dict.browse[browseKey] as { title: string; description: string } : undefined;
  
  const title = browseDict?.title || category;
  const description = browseDict?.description || '';

  return {
    title: `${title} | Ratingo`,
    description,
    openGraph: {
      title: `${title} | Ratingo`,
      description,
    },
  };
}

/**
 * Fetch initial data for SSR.
 */
async function fetchInitialData(category: BrowseCategory, page: number = 1) {
  const config = getCategoryConfig(category);
  if (!config) return { items: [], total: 0, hasMore: false };

  try {
    const offset = (page - 1) * config.pageSize;
    const params = { offset, limit: config.pageSize };
    
    // Call the appropriate API method based on category config
    const apiMethod = catalogApi[config.apiMethod];
    const response = await apiMethod(params) as unknown as {
      data: Array<{
        id: string;
        slug: string;
        title: string;
        poster?: { small: string; medium: string; large: string; original: string } | null;
        stats?: { qualityScore?: number | null; liveWatchers?: number | null } | null;
        externalRatings?: { imdb?: { rating: number } | null; tmdb?: { rating: number } | null } | null;
        releaseDate?: string | null;
      }>;
      meta: { total?: number };
    };
    
    const items: MediaCardServerProps[] = response.data.map((item) => ({
      id: item.id,
      slug: item.slug,
      type: config.mediaType,
      title: item.title,
      poster: item.poster ?? null,
      stats: item.stats ?? null,
      externalRatings: item.externalRatings ?? null,
      releaseDate: item.releaseDate ?? null,
    }));

    const total = response.meta.total ?? 0;
    return {
      items,
      total,
      hasMore: page * config.pageSize < total,
    };
  } catch (error) {
    console.error('Failed to fetch browse data:', error);
    return { items: [], total: 0, hasMore: false };
  }
}

export default async function BrowsePage({ params, searchParams }: PageProps) {
  const { category } = await params;
  const { page: pageParam } = await searchParams;
  
  const config = getCategoryConfig(category);
  if (!config) {
    notFound();
  }

  const page = Math.max(1, parseInt(pageParam || '1', 10));
  const { items, total, hasMore } = await fetchInitialData(category as BrowseCategory, page);
  
  const dict = getDictionary('uk');
  
  // Get title from i18n - map category slug to i18n key
  const categoryMap: Record<string, keyof typeof dict.browse> = {
    'trending': 'trending',
    'shows': 'shows',
    'movies': 'movies',
    'movies-trending': 'moviesTrending',
    'movies-now-playing': 'moviesNowPlaying',
    'movies-new-releases': 'moviesNewReleases',
    'movies-digital': 'moviesDigital',
  };
  const browseKey = categoryMap[category];
  const browseDict = browseKey ? dict.browse[browseKey] as { title: string; description: string } : undefined;
  const title = browseDict?.title || category;

  return (
    <main className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BrowsePageHeader
          title={title}
          subtitle={dict.browse.resultsCount.replace('{count}', total.toString())}
          backLabel={dict.browse.backToHome}
        />

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-400">{dict.browse.noResults}</p>
          </div>
        ) : (
          <>
            {/* SSR rendered grid */}
            <MediaGrid items={items} locale="uk" />

            {/* Client-side infinite scroll */}
            {hasMore && (
              <BrowseInfiniteList
                category={category as BrowseCategory}
                initialPage={page}
                pageSize={config.pageSize}
                loadingText={dict.browse.loading}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
