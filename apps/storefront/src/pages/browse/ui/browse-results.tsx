'use client';

import { memo } from 'react';
import { Button, Spinner } from '@heroui/react';
import type { PosterLoadPriority } from '@/entities/media';
import { SaveButton } from '@/features/save-to-library';
import type { CatalogPage } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useInfiniteSentinel } from '../lib/use-infinite-sentinel';
import type { BrowseCategory } from '../model/browse-category';
import { useCountLabel } from '../model/browse-labels';
import type { BrowseState } from '../model/browse-state';
import type { GridMedia } from '../model/grid-media';
import { useBrowseList } from '../model/use-browse-list';
import { browseGridClass } from './browse-grid';
import { PosterTile, PosterTileSkeleton } from './poster-tile';

const LOADING_TILES = 15;
const HIGH_PRIORITY_TILES = 3;

type ListEndStatus = 'loading' | 'failed' | 'complete' | 'idle';

interface ListProgress {
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  hasNextPage: boolean;
}

function listEndStatus(progress: ListProgress): ListEndStatus {
  if (progress.isFetchingNextPage) return 'loading';
  if (progress.isFetchNextPageError) return 'failed';
  return progress.hasNextPage ? 'idle' : 'complete';
}

function loadPriorityAt(index: number): PosterLoadPriority {
  return index < HIGH_PRIORITY_TILES ? 'high' : 'eager';
}

const BrowseTile = memo(function BrowseTile({
  media,
  loadPriority,
}: {
  media: GridMedia;
  loadPriority: PosterLoadPriority;
}) {
  return (
    <PosterTile
      media={media}
      loadPriority={loadPriority}
      actions={<SaveButton media={media} tone="overlay" />}
    />
  );
});

interface ListEndProps {
  status: ListEndStatus;
  resultLabel: string;
  onRetry: () => void;
}

function ListEnd({ status, resultLabel, onRetry }: ListEndProps) {
  const { dict } = useTranslation();
  const labels = dict.browse.list;
  const announcement = {
    loading: labels.loading,
    failed: labels.failed,
    complete: interpolate(labels.end, { result: resultLabel }),
    idle: '',
  }[status];

  return (
    <>
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {status === 'loading' ? (
        <p aria-hidden className="flex items-center justify-center gap-2 text-sm text-muted">
          <Spinner size="sm" />
          {labels.loading}
        </p>
      ) : null}
      {status === 'failed' ? (
        <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-sm md:max-w-md">
          <span aria-hidden className="flex flex-1 flex-col gap-0.5">
            <span className="font-semibold">{labels.failed}</span>
            <span className="text-muted">{labels.failedHint}</span>
          </span>
          <Button variant="secondary" size="sm" onPress={onRetry}>
            {labels.retry}
          </Button>
        </div>
      ) : null}
      {status === 'complete' ? (
        <p aria-hidden className="text-center text-sm text-muted">
          {announcement}
        </p>
      ) : null}
    </>
  );
}

interface BrowseResultsProps {
  category: BrowseCategory;
  state: BrowseState;
  title: string;
  initialPage: CatalogPage<GridMedia>;
}

export function BrowseResults({ category, state, title, initialPage }: BrowseResultsProps) {
  const { dict } = useTranslation();
  const countLabel = useCountLabel(category.type);
  const { query, items } = useBrowseList(category.slug, state, initialPage);
  const total = query.data.pages[0]?.total ?? items.length;

  const sentinelRef = useInfiniteSentinel({
    onReach: () => void query.fetchNextPage({ cancelRefetch: false }),
    isEnabled: query.hasNextPage && !query.isFetchNextPageError,
    rearmKey: query.data.pages.length,
  });

  const status = listEndStatus(query);

  return (
    <div className="flex flex-col gap-6">
      <ul
        aria-label={interpolate(dict.browse.list.label, { title })}
        className={browseGridClass(category.isFilterable)}
      >
        {items.map((media, index) => (
          <li key={media.mediaItemId}>
            <BrowseTile media={media} loadPriority={loadPriorityAt(index)} />
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
        status={status}
        resultLabel={countLabel(total)}
        onRetry={() => void query.fetchNextPage({ cancelRefetch: false })}
      />
    </div>
  );
}
