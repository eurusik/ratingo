/**
 * Основний модуль для отримання related TMDB ID
 * @module related
 */

import { getTraktRecommendations } from './trakt';
import { getTmdbRecommendations } from './tmdb';
import type { RelatedResult } from './types';

/**
 * Отримати related TMDB ID для шоу
 *
 * @description
 * Спробує отримати рекомендації з Trakt, якщо не знайде - використає TMDB як fallback.
 * Результати фільтруються за жанрами для забезпечення релевантності.
 *
 * @param tmdbId - TMDB ID базового шоу
 * @param traktSlugOrId - Slug або ID шоу в Trakt
 * @returns Проміс з результатом { ids: number[], source: 'trakt' | 'tmdb' }
 *
 * @example
 * ```typescript
 * const result = await getRelatedTmdbIds(123, 'breaking-bad');
 * console.log(`Знайдено ${result.ids.length} related ID з ${result.source}`);
 * ```
 */
export async function getRelatedTmdbIds(
  tmdbId: number,
  traktSlugOrId: string | number
): Promise<RelatedResult> {
  let relatedTmdbIds: number[] = [];
  let relatedSource: 'trakt' | 'tmdb' = 'trakt';

  relatedTmdbIds = await getTraktRecommendations(traktSlugOrId, tmdbId);

  if (relatedTmdbIds.length === 0) {
    relatedTmdbIds = await getTmdbRecommendations(tmdbId);
    if (relatedTmdbIds.length > 0) {
      relatedSource = 'tmdb';
    }
  }

  return { ids: relatedTmdbIds, source: relatedSource };
}
