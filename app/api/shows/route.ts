/**
 * GET /api/shows
 * Повертає перелік трендових шоу з фільтрами та легким кешем.
 *
 * Параметри запиту: `limit`, `offset`, `order`, `sort`, `days`,
 * `provider`, `region`, `category`.
 *
 * Відповідь: `{ shows: ShowEnriched[], count: number }`.
 *
 * @example curl 'http://localhost:3000/api/shows?limit=20&sort=trending&order=desc'
 * @example curl 'http://localhost:3000/api/shows?limit=50&sort=delta&days=7&region=UA&provider=netflix&category=flatrate'
 *
 * Shape:
 * {
 *   shows: Array<{
 *     id: number;
 *     tmdbId: number;
 *     title: string;
 *     posterUrl: string | null;
 *     watchersDelta: number | null;
 *     watchersSparkline: number[];
 *     trendingScore?: number | null;
 *     ratingTrakt?: number | null;
 *   }>;
 *   count: number;
 * }
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { shows, showWatchersSnapshots } from '@/db/schema';
import type { Show } from '@/db/schema';
import { desc, isNotNull, and, sql, gt, asc, inArray, gte, lte } from 'drizzle-orm';
import { TMDBClient } from '@/lib/api/tmdb';
import {
  getIntParam,
  getStringParam,
  getDaysWindow,
  getOptionalStringParam,
} from '@/lib/http/params';
import { respondError, respondJson } from '@/lib/http/responses';
import { getCachedJson, setCachedJson, makeCacheKey } from '@/lib/cache';

/**
 * Обробник GET-запиту: читає параметри, вибирає з БД, додає спарклайни,
 * формує кешовану JSON-відповідь.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = getIntParam(searchParams, 'limit', 20);
    const offset = getIntParam(searchParams, 'offset', 0);
    const order = getStringParam(searchParams, 'order', 'desc', { lower: true });
    const sort = getStringParam(searchParams, 'sort', 'trending', { lower: true });
    const { days, updatedAfter } = getDaysWindow(searchParams, 'days', 0);

    const providerParam = getOptionalStringParam(searchParams, 'provider', {
      trim: true,
      lower: true,
    });
    const regionParam = getOptionalStringParam(searchParams, 'region', { trim: true, upper: true });
    const categoryParam = getOptionalStringParam(searchParams, 'category', {
      trim: true,
      lower: true,
    });

    const cacheKey = makeCacheKey('shows', request.url);
    {
      const cached = await getCachedJson<{ shows: any[]; count: number }>(cacheKey);
      if (cached) {
        console.log('[cache] HIT:', cacheKey);
        return respondJson(cached, {
          headers: {
            'Cache-Control': 'public, max-age=15, s-maxage=15, stale-while-revalidate=120',
            'X-Cache': 'HIT',
          },
        });
      }
      console.log('[cache] MISS:', cacheKey);
    }

    const useWindowDelta = sort === 'delta' && days > 0;
    const signClause = useWindowDelta
      ? sql`TRUE`
      : sort === 'delta'
        ? order === 'asc'
          ? sql`COALESCE("shows"."watchers_delta", 0) < 0`
          : sql`COALESCE("shows"."watchers_delta", 0) > 0`
        : sort === 'delta3m'
          ? order === 'asc'
            ? sql`COALESCE("shows"."delta_3m", 0) < 0`
            : sql`COALESCE("shows"."delta_3m", 0) > 0`
          : sql`TRUE`;

    const recencyClause = updatedAfter
      ? sql`COALESCE("shows"."trending_updated_at", "shows"."updated_at") > ${updatedAfter}`
      : sql`TRUE`;

    const baseQuery = db.select().from(shows);
    const whereClause = regionParam
      ? and(
          isNotNull(shows.trendingScore),
          isNotNull(shows.ratingTrakt),
          recencyClause,
          signClause,
          sql`EXISTS (SELECT 1 FROM "show_watch_providers" swp WHERE swp.show_id = "shows"."id" AND swp.region = ${regionParam} ${providerParam ? sql`AND lower(swp.provider_name) LIKE ${'%' + providerParam + '%'}` : sql``} ${categoryParam ? sql`AND swp.category = ${categoryParam}` : sql``})`
        )
      : and(
          isNotNull(shows.trendingScore),
          isNotNull(shows.ratingTrakt),
          recencyClause,
          signClause
        );

    const poolLimit = Math.max(limit * 10, 100);
    const trendingShows: Show[] = await baseQuery
      .where(whereClause)
      .orderBy(
        useWindowDelta
          ? sql`"shows"."rating_trakt" DESC`
          : sort === 'watchers'
            ? order === 'asc'
              ? sql`"shows"."rating_trakt" ASC`
              : sql`"shows"."rating_trakt" DESC`
            : sort === 'delta'
              ? order === 'asc'
                ? sql`COALESCE("shows"."watchers_delta", 0) ASC`
                : sql`COALESCE("shows"."watchers_delta", 0) DESC`
              : sort === 'delta3m'
                ? order === 'asc'
                  ? sql`COALESCE("shows"."delta_3m", 0) ASC`
                  : sql`COALESCE("shows"."delta_3m", 0) DESC`
                : order === 'asc'
                  ? sql`"shows"."trending_score" ASC`
                  : sql`"shows"."trending_score" DESC`
      )
      .limit(useWindowDelta ? poolLimit : limit)
      .offset(useWindowDelta ? 0 : offset);
    const tmdbIds = trendingShows.map((s) => s.tmdbId).filter((v) => typeof v === 'number');
    const now = new Date();
    const sparkRows =
      tmdbIds.length > 0
        ? await db
            .select({
              tmdbId: showWatchersSnapshots.tmdbId,
              watchers: showWatchersSnapshots.watchers,
              createdAt: showWatchersSnapshots.createdAt,
            })
            .from(showWatchersSnapshots)
            .where(inArray(showWatchersSnapshots.tmdbId, tmdbIds))
            .orderBy(desc(showWatchersSnapshots.createdAt))
            .limit(Math.max(10 * tmdbIds.length, 10))
        : [];
    const sparkMap = new Map<number, number[]>();
    for (const r of sparkRows as Array<{ tmdbId: number; watchers: number; createdAt: Date }>) {
      const arr = sparkMap.get(r.tmdbId) || [];
      if (arr.length < 10) arr.push(Number(r.watchers) || 0);
      sparkMap.set(r.tmdbId, arr);
    }
    const earliestMap = new Map<number, number>();
    const latestMap = new Map<number, number>();
    if (useWindowDelta && updatedAfter && tmdbIds.length > 0) {
      const windowRows = await db
        .select({
          tmdbId: showWatchersSnapshots.tmdbId,
          watchers: showWatchersSnapshots.watchers,
          createdAt: showWatchersSnapshots.createdAt,
        })
        .from(showWatchersSnapshots)
        .where(
          and(
            inArray(showWatchersSnapshots.tmdbId, tmdbIds),
            gte(showWatchersSnapshots.createdAt, updatedAfter!),
            lte(showWatchersSnapshots.createdAt, now)
          )
        )
        .orderBy(asc(showWatchersSnapshots.createdAt));
      for (const r of windowRows as Array<{ tmdbId: number; watchers: number; createdAt: Date }>) {
        if (!earliestMap.has(r.tmdbId)) earliestMap.set(r.tmdbId, Number(r.watchers));
        latestMap.set(r.tmdbId, Number(r.watchers));
      }
    }
    type ShowEnriched = Show & {
      watchersDelta: number | null;
      posterUrl: string | null;
      watchersSparkline: number[];
    };
    let finalShows: ShowEnriched[] = trendingShows.map((show: Show): ShowEnriched => {
      const spark = (sparkMap.get(show.tmdbId) || []).slice().reverse();
      let deltaWindow: number | null = null;
      if (useWindowDelta && updatedAfter) {
        const earliest = earliestMap.get(show.tmdbId);
        const latest = latestMap.get(show.tmdbId);
        if (typeof earliest === 'number' && typeof latest === 'number' && earliest !== latest) {
          deltaWindow = latest - earliest;
        } else {
          deltaWindow = null;
        }
      }
      return {
        ...show,
        watchersDelta: typeof deltaWindow === 'number' ? deltaWindow : (show.watchersDelta ?? null),
        posterUrl: TMDBClient.getPosterUrl(show.posterUk || show.poster),
        watchersSparkline: spark,
      };
    });
    if (useWindowDelta) {
      const signed = finalShows.filter((s: ShowEnriched) => {
        const v = Number(s.watchersDelta || 0);
        return order === 'asc' ? v < 0 : v > 0;
      });
      finalShows = (signed.length > 0 ? signed : finalShows)
        .sort((a: ShowEnriched, b: ShowEnriched) => {
          const va = Number(a.watchersDelta || 0);
          const vb = Number(b.watchersDelta || 0);
          return order === 'asc' ? va - vb : vb - va;
        })
        .slice(offset, offset + limit);
    }
    const payload = { shows: finalShows, count: finalShows.length };
    await setCachedJson(cacheKey, payload, 30);
    return respondJson(payload, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('Error fetching shows:', error);
    return respondError('Failed to fetch shows', 500);
  }
}
