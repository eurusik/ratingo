/**
 * GET /api/airings
 * Повертає майбутні ефіри (епізоди) для топових трендових шоу
 * в заданому вікні днів з фільтрами по `region/provider/category`.
 *
 * @example curl 'http://localhost:3000/api/airings?days=14&region=UA&category=flatrate&top=20&sort=watchers'
 *
 * Shape:
 * {
 *   airings: Array<{
 *     id: number;
 *     tmdbId: number;
 *     season: number | null;
 *     episode: number | null;
 *     airDate: string | null;
 *     airDateTs: number | null;
 *     network: string | null;
 *     type: string | null;
 *     show: { id: number; tmdbId: number; title: string; poster: string | null } | null;
 *   }>;
 *   count: number;
 * }
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { showAirings, shows } from '@/db/schema';
import { eq, isNotNull, and, sql } from 'drizzle-orm';
import { getIntParam, getStringParam, getOptionalStringParam } from '@/lib/http/params';
import { respondJson, respondError } from '@/lib/http/responses';
import { getCachedJson, setCachedJson, makeCacheKey } from '@/lib/cache';

/**
 * Обробник GET-запиту: обмежує ефіри топ-трендами, фільтрує
 * по часовому вікну та регіональних провайдерах, кешує відповідь.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = getIntParam(searchParams, 'days', 7, { min: 1, max: 30 });
    const regionParam = getOptionalStringParam(searchParams, 'region', { trim: true, upper: true });
    const providerParam = getOptionalStringParam(searchParams, 'provider', {
      trim: true,
      lower: true,
    });
    const categoryParam = getOptionalStringParam(searchParams, 'category', {
      trim: true,
      lower: true,
    });
    const topParam = getIntParam(searchParams, 'top', 20, { min: 1, max: 100 });
    const sortParam = getStringParam(searchParams, 'sort', 'watchers', { trim: true, lower: true });

    const cacheKey = makeCacheKey('airings', request.url);
    {
      const cached = await getCachedJson<{ airings: any[]; count: number }>(cacheKey);
      if (cached) {
        return respondJson(cached, {
          headers: {
            'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=120',
          },
        });
      }
    }

    const today = new Date();
    const startTs = today.getTime();
    const endTs = startTs + days * 24 * 60 * 60 * 1000;

    // Fetch airings joined with trending shows
    // Determine top trending show IDs to restrict airings to current trends
    const topRows = await db
      .select({ id: shows.id })
      .from(shows)
      .where(isNotNull(shows.trendingScore))
      .orderBy(
        sortParam === 'watchers'
          ? sql`"shows"."rating_trakt" DESC`
          : sql`"shows"."trending_score" DESC`
      )
      .limit(topParam);
    const topIds = new Set(topRows.map((r: any) => r.id));

    const joined = await db
      .select()
      .from(showAirings)
      .innerJoin(shows, eq(showAirings.showId, shows.id))
      .where(
        and(
          isNotNull(shows.trendingScore),
          isNotNull(shows.ratingTrakt),
          regionParam
            ? sql`EXISTS (SELECT 1 FROM "show_watch_providers" swp WHERE swp.show_id = "shows"."id" AND swp.region = ${regionParam} ${providerParam ? sql`AND lower(swp.provider_name) LIKE ${'%' + providerParam + '%'}` : sql``} ${categoryParam ? sql`AND swp.category = ${categoryParam}` : sql``})`
            : sql`true`
        )
      );

    const windowAirings = (joined as any[])
      .map((r: any) => {
        const a = r.showAirings || r.show_airings || r;
        const s = r.shows;
        const airDateTs = a.airDate ? Date.parse(a.airDate) : null;
        return {
          ...a,
          airDateTs,
          show: s
            ? {
                id: s.id,
                tmdbId: s.tmdbId,
                title: (s as any).titleUk || s.title,
                poster: (s as any).posterUk || s.poster,
              }
            : null,
        };
      })
      .filter(
        (r: any) =>
          r.show &&
          topIds.has(r.show.id) &&
          typeof r.airDateTs === 'number' &&
          r.airDateTs >= startTs &&
          r.airDateTs <= endTs
      )
      .sort((a: any, b: any) => a.airDateTs - b.airDateTs);

    const payload = { airings: windowAirings, count: windowAirings.length };
    await setCachedJson(cacheKey, payload, 30);
    return respondJson(payload, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Error fetching airings:', error);
    return respondError('Failed to fetch airings', 500);
  }
}
