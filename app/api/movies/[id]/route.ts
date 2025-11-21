import { NextRequest } from 'next/server';
import { respondError, respondJson } from '@/lib/http/responses';
import { getMovieDetails } from '@/lib/queries/movies';
import { getCachedJson, setCachedJson, makeCacheKey } from '@/lib/cache';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const movieId = parseInt(id, 10);

    if (isNaN(movieId)) {
      return respondError('Invalid movie ID', 400);
    }

    const cacheKey = makeCacheKey('movie', request.url);
    const cached = await getCachedJson<any>(cacheKey);
    if (cached) {
      console.log('[cache] HIT:', cacheKey);
      return respondJson(cached, {
        headers: {
          'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=300',
          'X-Cache': 'HIT',
        },
      });
    }
    console.log('[cache] MISS:', cacheKey);
    const details = await getMovieDetails(movieId);
    if (!details) return respondError('Movie not found', 404);
    await setCachedJson(cacheKey, details, 60);
    return respondJson(details, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    console.error('Error fetching movie details:', error);
    return respondError('Failed to fetch movie details', 500);
  }
}
