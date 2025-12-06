import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';
import { withRetry } from './utils';

export async function getRelatedTmdbIds(
  tmdbId: number,
  traktSlugOrId: string | number
): Promise<{ ids: number[]; source: 'trakt' | 'tmdb' }> {
  let relatedTmdbIds: number[] = [];
  let relatedSource: 'trakt' | 'tmdb' = 'trakt';
  try {
    const related = await withRetry(() => traktClient.getRelatedShows(traktSlugOrId, 12));
    relatedTmdbIds = Array.isArray(related)
      ? Array.from(
          new Set(
            related
              .map((r: any) => r?.show?.ids?.tmdb)
              .filter((id: any) => typeof id === 'number' && Number.isFinite(id) && id > 0)
          )
        )
      : [];
  } catch {}
  if (relatedTmdbIds.length === 0) {
    try {
      const recs = await withRetry(() => tmdbClient.getRecommendations(tmdbId, 1));
      const results = Array.isArray(recs?.results) ? recs.results : [];
      relatedTmdbIds = Array.from(
        new Set<number>(
          results
            .filter((r: any) => (Array.isArray(r?.genre_ids) ? !r.genre_ids.includes(16) : true))
            .map((r: any) => r?.id)
            .filter((id: any) => typeof id === 'number' && Number.isFinite(id) && id > 0)
        )
      ).slice(0, 12);
      if (relatedTmdbIds.length > 0) relatedSource = 'tmdb';
    } catch {}
  }
  return { ids: relatedTmdbIds, source: relatedSource };
}
