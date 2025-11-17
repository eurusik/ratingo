import { NextResponse } from 'next/server';
import {
  getIntParam,
  getStringParam,
  getDaysWindow,
  getOptionalStringParam,
} from '@/lib/http/params';
import { respondError, respondJson } from '@/lib/http/responses';
import { getCachedJson, setCachedJson, makeCacheKey } from '@/lib/cache';
import { getMovies } from '@/lib/queries/movies';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = getIntParam(searchParams, 'limit', 20);
    const offset = getIntParam(searchParams, 'offset', 0);
    const order = getStringParam(searchParams, 'order', 'desc', { lower: true });
    const sort = getStringParam(searchParams, 'sort', 'trending', { lower: true });
    const { days } = getDaysWindow(searchParams, 'days', 0);
    const providerParam = getOptionalStringParam(searchParams, 'provider', {
      trim: true,
      lower: true,
    });
    const regionParam = getOptionalStringParam(searchParams, 'region', { trim: true, upper: true });
    const categoryParam = getOptionalStringParam(searchParams, 'category', {
      trim: true,
      lower: true,
    });
    const cacheKey = makeCacheKey('movies', request.url);
    const cached = await getCachedJson<{ movies: any[]; count: number }>(cacheKey);
    if (cached) {
      return respondJson(cached, {
        headers: { 'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=120' },
      });
    }
    const useWindowDelta = sort === 'delta' && days > 0;
    const poolLimit = Math.max(limit * 10, 100);
    const list = await getMovies({
      limit: useWindowDelta ? poolLimit : limit,
      offset: useWindowDelta ? 0 : offset,
      order: order as any,
      sort: sort as any,
      days,
      provider: providerParam,
      region: regionParam,
      category: categoryParam,
    });
    let final = list;
    if (useWindowDelta) {
      final = list.slice(offset, offset + limit);
    }
    const payload = { movies: final, count: final.length };
    await setCachedJson(cacheKey, payload, 30);
    return respondJson(payload, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch (error) {
    return respondError('Failed to fetch movies', 500);
  }
}
/**
 * GET /api/movies
 * Повертає перелік трендових фільмів з фільтрами та легким кешем.
 *
 * Параметри запиту: `limit`, `offset`, `order`, `sort`, `days`,
 * `provider`, `region`, `category`.
 *
 * Відповідь: `{ movies: MovieEnriched[], count: number }`.
 *
 * @example curl 'http://localhost:3000/api/movies?limit=20&sort=trending&order=desc'
 * @example curl 'http://localhost:3000/api/movies?limit=50&sort=delta&days=7&region=UA&provider=netflix&category=flatrate'
 */
