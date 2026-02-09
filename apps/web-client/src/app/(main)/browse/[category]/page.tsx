/**
 * Browse page for category listings.
 * SSR first page + client-side infinite scroll.
 */

import type { Metadata } from 'next';
import type { Route } from 'next';
import { notFound } from 'next/navigation';
import { getDictionary, getByPath } from '@/shared/i18n';
import { catalogApi } from '@/core/api';
import {
  getCategoryConfig,
  getSortOptions,
  getValidCategorySlugs,
  categorySupportsFilters,
  categoryHasPoolSelector,
  type BrowseCategory,
} from '@/modules/browse';
import { BrowsePageHeader, BrowseMediaGrid, BrowseFilters, PoolSelector } from '@/modules/browse';
import { BrowseInfiniteList } from './browse-infinite-list';
import type { MediaCardServerProps } from '@/modules/home';

// Generate static params for all categories
export function generateStaticParams() {
  return getValidCategorySlugs().map((category) => ({ category }));
}

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
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

  const title = getByPath(dict, config.titleKey);
  const description = getByPath(dict, config.descriptionKey);

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
async function fetchInitialData(
  category: BrowseCategory,
  page: number = 1,
  filters: { sort?: string } = {},
) {
  const config = getCategoryConfig(category);
  if (!config) return { items: [], total: 0, hasMore: false };

  try {
    const offset = (page - 1) * config.pageSize;
    const params: Record<string, string | number> = {
      offset,
      limit: config.pageSize,
    };

    // Add filters if provided
    if (filters.sort) params.sort = filters.sort;

    // Call the appropriate API method based on category config
    const apiMethod = catalogApi[config.apiMethod];
    const response = (await apiMethod(params as Parameters<typeof apiMethod>[0])) as unknown as {
      data: Array<{
        id: string;
        slug: string;
        title: string;
        poster?: { small: string; medium: string; large: string; original: string } | null;
        stats?: { qualityScore?: number | null; liveWatchers?: number | null } | null;
        externalRatings?: {
          imdb?: { rating: number } | null;
          tmdb?: { rating: number } | null;
        } | null;
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
  const { page: pageParam, sort } = await searchParams;

  const config = getCategoryConfig(category);
  if (!config) {
    notFound();
  }

  const page = Math.max(1, parseInt(pageParam || '1', 10));
  const validSort =
    sort && (getSortOptions(config) as readonly string[]).includes(sort) ? sort : undefined;
  const { items, total, hasMore } = await fetchInitialData(category as BrowseCategory, page, {
    sort: validSort,
  });

  const dict = getDictionary('uk');
  const title = getByPath(dict, config.titleKey);

  // Check if this category supports filters (trending endpoints)
  const supportsFilters = categorySupportsFilters(config);

  // Check if this category has pool selector
  const hasPoolSelector = categoryHasPoolSelector(config);

  return (
    <main className="min-h-screen bg-cinema-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <BrowsePageHeader
            title={title}
            subtitle={dict.browse.resultsCount.replace('{count}', total.toString())}
            backLabel={dict.browse.backToHome}
          />

          <div className="flex items-center gap-3">
            {hasPoolSelector && config.pool && config.poolCounterpart && (
              <PoolSelector
                currentPool={config.pool}
                trendingHref={
                  `/browse/${config.pool === 'trending' ? config.slug : config.poolCounterpart}` as Route
                }
                popularHref={
                  `/browse/${config.pool === 'popular' ? config.slug : config.poolCounterpart}` as Route
                }
                labels={{
                  trending: dict.browse.pool.trending,
                  popular: dict.browse.pool.popular,
                }}
              />
            )}

            {supportsFilters && (
              <BrowseFilters
                sortOptions={getSortOptions(config)}
                labels={{
                  sort: dict.browse.filters.sort,
                  sortOptions: dict.browse.filters.sortOptions,
                  sortTooltips: dict.browse.filters.sortTooltips,
                }}
              />
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-cinema-text-muted">{dict.browse.noResults}</p>
          </div>
        ) : (
          <>
            {/* SSR rendered grid with SavedStatusProvider */}
            <BrowseMediaGrid items={items} locale="uk" />

            {/* Client-side infinite scroll */}
            {hasMore && (
              <BrowseInfiniteList
                key={`${category}-${validSort || 'trending'}`}
                category={category as BrowseCategory}
                initialPage={page}
                pageSize={config.pageSize}
                sort={validSort}
                loadingText={dict.browse.loading}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
