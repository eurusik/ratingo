'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Button, Spinner } from '@heroui/react';
import { PosterTile, PosterTileSkeleton, type TrendingMedia } from '@/entities/media';
import { SaveButton } from '@/features/save-to-library';
import type { CatalogPage } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { fetchBrowsePage } from '../api/browse-client';
import type { BrowseCategory } from '../model/browse-category';
import { browseListKey } from '../model/browse-keys';
import { BROWSE_PAGE_SIZE, type BrowseState } from '../model/browse-state';
import { countLabel } from '../model/filter-labels';
import { useInfiniteSentinel } from '../model/use-infinite-sentinel';

const LIST_STALE_MS = 5 * 60_000;
const LOADING_TILES = 3;
const PRIORITY_TILES = 6;

const GRID_COLUMNS = {
  withSidebar: 'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
  fullWidth: 'lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
} as const;

interface ListEndProps {
  isLoadingMore: boolean;
  hasFailed: boolean;
  isComplete: boolean;
  countLabel: string;
  onRetry: () => void;
}

function ListEnd({ isLoadingMore, hasFailed, isComplete, countLabel, onRetry }: ListEndProps) {
  const { dict } = useTranslation();
  const labels = dict.browse.list;

  if (isLoadingMore) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted">
        <Spinner size="sm" />
        {labels.loading}
      </p>
    );
  }

  if (hasFailed) {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-sm md:max-w-md"
      >
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="font-semibold">{labels.failed}</span>
          <span className="text-muted">{labels.failedHint}</span>
        </span>
        <Button variant="secondary" size="sm" onPress={onRetry}>
          {labels.retry}
        </Button>
      </div>
    );
  }

  if (!isComplete) return null;
  return (
    <p className="text-center text-sm text-muted">
      {interpolate(labels.end, { result: countLabel })}
    </p>
  );
}

interface BrowseResultsProps {
  category: BrowseCategory;
  state: BrowseState;
  title: string;
  initialPage: CatalogPage<TrendingMedia>;
  hasSidebar: boolean;
}

function uniqueItems(pages: readonly CatalogPage<TrendingMedia>[]): TrendingMedia[] {
  const byId = new Map<string, TrendingMedia>();
  for (const media of pages.flatMap((page) => page.items)) {
    if (!byId.has(media.mediaItemId)) byId.set(media.mediaItemId, media);
  }
  return [...byId.values()];
}

export function BrowseResults({
  category,
  state,
  title,
  initialPage,
  hasSidebar,
}: BrowseResultsProps) {
  const { dict, locale } = useTranslation();
  const query = useInfiniteQuery({
    queryKey: browseListKey(category.slug, state),
    queryFn: ({ pageParam, signal }) =>
      fetchBrowsePage({
        slug: category.slug,
        state,
        offset: pageParam,
        limit: BROWSE_PAGE_SIZE,
        signal,
      }),
    initialPageParam: 0,
    initialData: { pages: [initialPage], pageParams: [0] },
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length * BROWSE_PAGE_SIZE : undefined,
    staleTime: LIST_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const items = uniqueItems(query.data.pages);
  const canLoadMore = query.hasNextPage && !query.isFetchNextPageError;
  const sentinelRef = useInfiniteSentinel(
    () => {
      if (!query.isFetchingNextPage) void query.fetchNextPage();
    },
    canLoadMore,
    query.data.pages.length,
  );

  return (
    <div className="flex flex-col gap-6">
      <ul
        aria-label={interpolate(dict.browse.list.label, { title })}
        className={`grid grid-cols-3 gap-x-2.5 gap-y-5 sm:grid-cols-4 md:grid-cols-5 md:gap-x-4 md:gap-y-6 ${GRID_COLUMNS[hasSidebar ? 'withSidebar' : 'fullWidth']}`}
      >
        {items.map((media, index) => (
          <li
            key={media.mediaItemId}
            className="[contain-intrinsic-size:auto_20rem] [content-visibility:auto]"
          >
            <PosterTile
              media={media}
              isPriority={index < PRIORITY_TILES}
              actions={<SaveButton media={media} tone="overlay" />}
            />
          </li>
        ))}
        {query.isFetchingNextPage
          ? Array.from({ length: LOADING_TILES }, (_, index) => (
              <li key={`loading-${index}`} aria-hidden>
                <PosterTileSkeleton />
              </li>
            ))
          : null}
      </ul>
      <div ref={sentinelRef} aria-hidden />
      <ListEnd
        isLoadingMore={query.isFetchingNextPage}
        hasFailed={query.isFetchNextPageError}
        isComplete={!query.hasNextPage && items.length > 0}
        countLabel={countLabel(dict, locale, category.type, items.length)}
        onRetry={() => void query.fetchNextPage()}
      />
    </div>
  );
}
