'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { libraryApi, type MediaImportResult, type UserMediaState } from '@/shared/api';
import { scoreFromPercent } from '@/shared/lib';

const HISTORY_PAGE_SIZE = 100;
const HISTORY_MAX_PAGES = 10;
const RATED_SHOWS_GC_MS = 60 * 60 * 1000;

export interface RatedShow {
  mediaItemId: string;
  title: string;
  slug: string;
  imageUrl?: string;
  score?: number;
}

export function ratedImportIds(result: MediaImportResult): string[] {
  return result.details.imported
    .filter((item) => item.rating !== null && item.state === 'completed')
    .map((item) => item.mediaItemId);
}

export function pickRatedShows(
  entries: readonly UserMediaState[],
  ratedIds: ReadonlySet<string>,
): RatedShow[] {
  return entries.flatMap((entry) => {
    const summary = entry.mediaSummary;
    if (!summary || summary.type !== 'show' || !ratedIds.has(entry.mediaItemId)) return [];
    return [
      {
        mediaItemId: entry.mediaItemId,
        title: summary.title,
        slug: summary.slug,
        imageUrl: summary.poster?.medium,
        score: scoreFromPercent(entry.rating),
      },
    ];
  });
}

async function findRatedShows(ids: readonly string[]): Promise<RatedShow[]> {
  const wanted = new Set(ids);
  const found: RatedShow[] = [];
  for (let page = 0; page < HISTORY_MAX_PAGES && found.length < wanted.size; page++) {
    const { data } = await libraryApi.getHistory({
      state: 'completed',
      type: 'show',
      sort: 'recent',
      limit: HISTORY_PAGE_SIZE,
      offset: page * HISTORY_PAGE_SIZE,
    });
    found.push(...pickRatedShows(data, wanted));
    if (data.length < HISTORY_PAGE_SIZE) break;
  }
  return found;
}

export function useRatedImportedShows(result: MediaImportResult | undefined) {
  const ids = useMemo(() => (result ? ratedImportIds(result) : []), [result]);
  return useQuery({
    queryKey: ['media-import', 'rated-shows', ids] as const,
    enabled: ids.length > 0,
    staleTime: Infinity,
    gcTime: RATED_SHOWS_GC_MS,
    queryFn: () => findRatedShows(ids),
  });
}
