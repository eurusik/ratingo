'use client';

import { useQuery } from '@tanstack/react-query';
import { libraryApi, type MediaImportResult, type UserMediaState } from '@/shared/api';
import { scoreFromPercent } from '@/shared/lib';

const HISTORY_SCAN_LIMIT = 100;

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

export function useRatedImportedShows(result: MediaImportResult | undefined) {
  const ids = result ? ratedImportIds(result) : [];
  return useQuery({
    queryKey: ['media-import', 'rated-shows', ids] as const,
    enabled: ids.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      const page = await libraryApi.getHistory({
        state: 'completed',
        type: 'show',
        sort: 'recent',
        limit: HISTORY_SCAN_LIMIT,
        offset: 0,
      });
      return pickRatedShows(page.data, new Set(ids));
    },
  });
}
