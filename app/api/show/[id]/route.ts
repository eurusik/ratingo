/**
 * GET /api/show/[id]
 * Повертає деталі шоу за внутрішнім `showId` (id у БД),
 * включаючи пов’язані шоу, рейтинги та нормалізовані довідники.
 *
 * @example curl 'http://localhost:3000/api/show/123'
 *
 * Shape:
 * {
 *   id: number;
 *   tmdbId: number;
 *   title: string;
 *   posterUrl: string | null;
 *   backdropUrl: string | null;
 *   traktRatings?: { rating: number | null; votes: number | null };
 *   ratings?: { trakt: { avg: number | null; votes: number | null } | null; traktDistribution: { bucket: number; count: number }[] };
 *   cast: Array<{ id: number; name: string; roles: string[]; profile_path: string | null }>;
 *   watchProviders: Array<{ id: number; name: string; logo_path: string | null; region: string; category?: string | null; link_url?: string | null; rank?: number | null }>;
 *   contentRatingsByRegion: Record<string, string | null>;
 *   ratingImdb?: number | null;
 *   imdbVotes?: number | null;
 *   ratingMetacritic?: number | null;
 *   related: Array<{ id: number; tmdbId: number; title: string; posterUrl: string | null; primaryRating: number | null }>;
 * }
 */
import { NextRequest } from 'next/server';
import { respondError, respondJson } from '@/lib/http/responses';
import { getShowDetails } from '@/lib/queries/shows';
import { getCachedJson, setCachedJson, makeCacheKey } from '@/lib/cache';

/**
 * Обробник GET-запиту: валідуючи `id`, дістає деталі через `getShowDetails`,
 * кешує та повертає JSON.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const showId = parseInt(id, 10);

    if (isNaN(showId)) {
      return respondError('Invalid show ID', 400);
    }

    const cacheKey = makeCacheKey('show', request.url);
    const cached = await getCachedJson<any>(cacheKey);
    if (cached)
      return respondJson(cached, {
        headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=300' },
      });
    const details = await getShowDetails(showId);
    if (!details) return respondError('Show not found', 404);
    await setCachedJson(cacheKey, details, 60);
    return respondJson(details, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('Error fetching show details:', error);
    return respondError('Failed to fetch show details', 500);
  }
}
