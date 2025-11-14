/**
 * Запити до БД для списків шоу, ефірів та деталей шоу.
 *
 * @example
 * import { getShows, getAirings, getShowDetails } from '@/lib/queries/shows';
 * const shows = await getShows({ limit: 20, sort: 'trending' });
 * const airings = await getAirings({ days: 14, region: 'UA' });
 * const details = await getShowDetails(123);
 */
import { db } from '@/db';
import {
  shows,
  showWatchersSnapshots,
  showAirings,
  showRelated,
  showRatings,
  showRatingBuckets,
  // normalized tables
  showVideos,
  showCast,
  showWatchProviders,
  watchProvidersRegistry,
  showContentRatings,
} from '@/db/schema';
import { desc, isNotNull, and, sql, gt, eq, asc, inArray, gte, lte } from 'drizzle-orm';
import { TMDBClient } from '@/lib/api/tmdb';
import type { Show, Airing } from '@/db/schema';
import { timeAsync } from '@/lib/sync/utils';

interface ShowQueryParams {
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
  sort?: 'trending' | 'watchers' | 'delta' | 'delta3m';
  days?: number;
  provider?: string | null;
  region?: string | null;
  category?: string | null; // 'flatrate' | 'free' | 'ads' | 'rent' | 'buy'
}

/**
 * Повертає трендові шоу з фільтрами та збагаченням (постери, спарклайни).
 *
 * @example
 * const list = await getShows({ limit: 50, sort: 'delta', days: 7 });
 *
 * @returns Array<{
 *   id: number; tmdbId: number; title: string;
 *   posterUrl: string | null; watchersDelta: number | null; watchersSparkline: number[];
 * }>
 */
export async function getShows({
  limit = 20,
  offset = 0,
  order = 'desc',
  sort = 'trending',
  days = 0,
  provider = null,
  region = null,
  category = null,
}: ShowQueryParams = {}) {
  const updatedAfter = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
  const useWindowDelta = sort === 'delta' && days > 0;

  const signClause =
    useWindowDelta
      ? sql`TRUE`
      : sort === 'delta'
      ? (order === 'asc'
          ? sql`COALESCE("shows"."watchers_delta", 0) < 0`
          : sql`COALESCE("shows"."watchers_delta", 0) > 0`)
      : sort === 'delta3m'
      ? (order === 'asc'
          ? sql`COALESCE("shows"."delta_3m", 0) < 0`
          : sql`COALESCE("shows"."delta_3m", 0) > 0`)
      : sql`TRUE`;

  const recencyClause = updatedAfter ? gt(shows.trendingUpdatedAt, updatedAfter) : sql`TRUE`;

  const baseQuery = db.select().from(shows);
  const whereClause = region
    ? and(
        isNotNull(shows.trendingScore),
        isNotNull(shows.ratingTrakt),
        recencyClause,
        signClause,
        sql`EXISTS (SELECT 1 FROM "show_watch_providers" swp WHERE swp.show_id = "shows"."id" AND swp.region = ${region} ${provider ? sql`AND lower(swp.provider_name) LIKE ${'%' + String(provider).toLowerCase() + '%'}` : sql``} ${category ? sql`AND swp.category = ${category}` : sql``})`
      )
    : and(
        isNotNull(shows.trendingScore),
        isNotNull(shows.ratingTrakt),
        recencyClause,
        signClause
      );

  const poolLimit = Math.max(limit * 10, 100);
  const trendingShows: Show[] = await timeAsync('getShows.base', async () =>
    baseQuery
      .where(whereClause)
      .orderBy(
        useWindowDelta
          ? sql`"shows"."rating_trakt" DESC`
          : sort === 'watchers'
          ? (order === 'asc' ? sql`"shows"."rating_trakt" ASC` : sql`"shows"."rating_trakt" DESC`)
          : sort === 'delta'
          ? (order === 'asc' ? sql`COALESCE("shows"."watchers_delta", 0) ASC` : sql`COALESCE("shows"."watchers_delta", 0) DESC`)
          : sort === 'delta3m'
          ? (order === 'asc' ? sql`COALESCE("shows"."delta_3m", 0) ASC` : sql`COALESCE("shows"."delta_3m", 0) DESC`)
          : (order === 'asc' ? sql`"shows"."trending_score" ASC` : sql`"shows"."trending_score" DESC`)
      )
      .limit(useWindowDelta ? poolLimit : limit)
      .offset(useWindowDelta ? 0 : offset)
  );

  // Enrich with poster URLs and recent watchers sparkline (last 10 snapshots)
  const now = new Date();
  type ShowEnriched = Show & {
    watchersDelta: number | null;
    posterUrl: string | null;
    watchersSparkline: number[];
  };
  const tmdbIds = trendingShows.map((s) => s.tmdbId).filter((v) => typeof v === 'number');
  const sparkRows = tmdbIds.length > 0
    ? await timeAsync('getShows.sparkRows', async () =>
        db
          .select({ tmdbId: showWatchersSnapshots.tmdbId, watchers: showWatchersSnapshots.watchers, createdAt: showWatchersSnapshots.createdAt })
          .from(showWatchersSnapshots)
          .where(inArray(showWatchersSnapshots.tmdbId, tmdbIds))
          .orderBy(desc(showWatchersSnapshots.createdAt))
          .limit(Math.max(10 * tmdbIds.length, 10))
      )
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
    const windowRows = await timeAsync('getShows.windowRows', async () =>
      db
        .select({ tmdbId: showWatchersSnapshots.tmdbId, watchers: showWatchersSnapshots.watchers, createdAt: showWatchersSnapshots.createdAt })
        .from(showWatchersSnapshots)
        .where(and(
          inArray(showWatchersSnapshots.tmdbId, tmdbIds),
          gte(showWatchersSnapshots.createdAt, updatedAfter!),
          lte(showWatchersSnapshots.createdAt, now)
        ))
        .orderBy(asc(showWatchersSnapshots.createdAt))
    );
    for (const r of windowRows as Array<{ tmdbId: number; watchers: number; createdAt: Date }>) {
      if (!earliestMap.has(r.tmdbId)) earliestMap.set(r.tmdbId, Number(r.watchers));
      latestMap.set(r.tmdbId, Number(r.watchers));
    }
  }
  const showsWithUrls: ShowEnriched[] = trendingShows.map((show: Show): ShowEnriched => {
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
    let finalShows: ShowEnriched[] = showsWithUrls;
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
    return finalShows;
  }

  return showsWithUrls;
}

/**
 * Повертає ефіри для топових шоу у часовому вікні з регіональними фільтрами.
 *
 * @example
 * const air = await getAirings({ days: 7, region: 'UA', category: 'flatrate' });
 *
 * @returns Array<{
 *   id: number; tmdbId: number; season: number | null; episode: number | null;
 *   airDate: string | null; airDateTs: number | null; network: string | null; type: string | null;
 *   show: { id: number; tmdbId: number; title: string; poster: string | null } | null;
 * }>
 */
export async function getAirings({
  days = 7,
  region = null,
  provider = null,
  top = 20,
  sort = 'watchers',
  category = null,
}: {
  days?: number;
  region?: string | null;
  provider?: string | null;
  top?: number;
  sort?: string;
  category?: string | null;
} = {}) {
  const today = new Date();
  const startTs = today.getTime();
  const endTs = startTs + days * 24 * 60 * 60 * 1000;

  // Fetch top trending show IDs
  const topRows = await timeAsync('getAirings.top', async () =>
    db
      .select({ id: shows.id })
      .from(shows)
      .where(isNotNull(shows.trendingScore))
      .orderBy(
        sort === 'watchers' ? sql`"shows"."rating_trakt" DESC` : sql`"shows"."trending_score" DESC`
      )
      .limit(top)
  );
  const topIds = new Set(topRows.map((r: any) => r.id));

  const joined = await timeAsync('getAirings.join', async () =>
    db
      .select()
      .from(showAirings)
      .innerJoin(shows, eq(showAirings.showId, shows.id))
      .where(
        and(
          isNotNull(shows.trendingScore),
          isNotNull(shows.ratingTrakt),
          region
            ? sql`EXISTS (SELECT 1 FROM "show_watch_providers" swp WHERE swp.show_id = "shows"."id" AND swp.region = ${region} ${provider ? sql`AND lower(swp.provider_name) LIKE ${'%' + String(provider).toLowerCase() + '%'}` : sql``} ${category ? sql`AND swp.category = ${category}` : sql``})`
            : sql`true`
        )
      )
  );

  type AiringWithTs = Airing & {
    airDateTs: number | null;
    show: {
      id: number;
      tmdbId: number;
      title: string;
      poster: string | null;
    } | null;
  };

  const windowAirings: AiringWithTs[] = (joined as any[])
    .map((r: any): AiringWithTs => {
      const a = r.showAirings || r.show_airings || r;
      const s = r.shows;
      const airDateTs = a.airDate ? Date.parse(a.airDate) : null;
      return {
        ...a,
        airDateTs,
        show: s ? {
          id: s.id,
          tmdbId: s.tmdbId,
          title: s.titleUk || s.title,
          poster: s.posterUk || s.poster,
        } : null,
      };
    })
    .filter((r: AiringWithTs) => r.show && topIds.has(r.show.id) && typeof r.airDateTs === 'number' && r.airDateTs >= startTs && r.airDateTs <= endTs)
    .sort((a: AiringWithTs, b: AiringWithTs) => ((a.airDateTs ?? 0) - (b.airDateTs ?? 0)));

  return windowAirings;
}

/**
 * Повертає деталі шоу за внутрішнім `showId`: рейтинги, дистрибуція,
 * відео, каст, провайдери, контент-рейтинги, пов’язані шоу.
 *
 * @example
 * const det = await getShowDetails(123);
 *
 * @returns {
 *   id: number; tmdbId: number; title: string;
 *   posterUrl: string | null; backdropUrl: string | null;
 *   ratings?: { trakt: { avg: number | null; votes: number | null } | null; traktDistribution: { bucket: number; count: number }[] };
 *   cast: Array<{ id: number; name: string; roles: string[]; profile_path: string | null }>;
 *   watchProviders: Array<{ id: number; name: string; logo_path: string | null; region: string; category?: string | null; link_url?: string | null; rank?: number | null }>;
 *   contentRatingsByRegion: Record<string, string | null>;
 *   related: Array<{ id: number; tmdbId: number; title: string; posterUrl: string | null; primaryRating: number | null }>;
 * }
 */
export async function getShowDetails(showId: number) {
  // Fetch show from database
  const showData = await timeAsync('getShowDetails.base', async () =>
    db
      .select()
      .from(shows)
      .where(eq(shows.id, showId))
      .limit(1)
  );

  if (showData.length === 0) {
    return null;
  }

  const show = showData[0];

  // Resolve related shows via mapping table
  let related: Array<{ id: number; tmdbId: number; title: string; posterUrl: string | null; primaryRating: number | null }> = [];
  try {
    const relRows = await timeAsync('getShowDetails.related', async () =>
      db
        .select()
        .from(showRelated)
        .innerJoin(shows, eq(showRelated.relatedShowId, shows.id))
        .where(eq(showRelated.showId, showId))
        .limit(12)
    );
    related = relRows.map((row: any) => ({
      id: row.shows.id,
      tmdbId: row.shows.tmdbId,
      title: row.shows.titleUk || row.shows.title,
      posterUrl: TMDBClient.getPosterUrl(row.shows.posterUk || row.shows.poster),
      primaryRating: row.shows.primaryRating ?? null,
    }));
  } catch {}

  // Resolve Trakt ratings and distribution from DB
  let ratingsTrakt: { avg: number | null; votes: number | null } | null = null;
  type RatingBucket = { bucket: number; count: number };
  let traktDistribution: RatingBucket[] = [];
  try {
    const rRow = await timeAsync('getShowDetails.ratings', async () =>
      db
        .select({ avg: showRatings.avg, votes: showRatings.votes })
        .from(showRatings)
        .where(eq(showRatings.showId, showId))
        .limit(1)
    );
    if (rRow.length > 0) {
      ratingsTrakt = { avg: rRow[0].avg ?? null, votes: rRow[0].votes ?? null };
    }
    const bRows = await timeAsync('getShowDetails.ratingBuckets', async () =>
      db
        .select({ bucket: showRatingBuckets.bucket, count: showRatingBuckets.count })
        .from(showRatingBuckets)
        .where(eq(showRatingBuckets.showId, showId))
    );
    traktDistribution = bRows
      .map((b: any): RatingBucket => ({ bucket: Number(b.bucket), count: Number(b.count) }))
      .sort((a: RatingBucket, b: RatingBucket) => a.bucket - b.bucket);
  } catch {}

  // Prefer normalized videos/cast/providers; fallback to JSON columns
  let videos: any[] = [];
  let cast: any[] = [];
  let providers: any[] = [];
  let contentRatingsByRegion: Record<string, string | null> = {};
  try {
    const vRows = await timeAsync('getShowDetails.videos', async () =>
      db
        .select()
        .from(showVideos)
        .where(eq(showVideos.showId, showId))
    );
    videos = (vRows as any[]).map((v: any) => ({
      site: v.site,
      key: v.key,
      name: v.name,
      type: v.type,
      iso_639_1: v.locale, // stored as locale; component uses only 'type' and 'key'
      official: v.official ?? undefined,
      published_at: v.publishedAt ?? undefined,
    }));
  } catch {}
  try {
    const crRows = await timeAsync('getShowDetails.contentRatings', async () =>
      db
        .select({ region: showContentRatings.region, rating: showContentRatings.rating })
        .from(showContentRatings)
        .where(eq(showContentRatings.showId, showId))
    );
    for (const r of crRows as any[]) {
      const reg = String(r.region);
      contentRatingsByRegion[reg] = r.rating ?? null;
    }
  } catch {}
  try {
    const cRows = await timeAsync('getShowDetails.cast', async () =>
      db
        .select()
        .from(showCast)
        .where(eq(showCast.showId, showId))
    );
    cast = (cRows as any[]).map((c: any) => ({
      id: c.personId,
      name: c.name,
      roles: c.character ? [c.character] : [],
      profile_path: c.profilePath || null,
    }));
  } catch {}
  try {
    const pRows = await timeAsync('getShowDetails.providers', async () =>
      db
        .select({
          providerId: showWatchProviders.providerId,
          region: showWatchProviders.region,
          category: showWatchProviders.category,
          linkUrl: showWatchProviders.linkUrl,
          rank: showWatchProviders.rank,
          swpName: showWatchProviders.providerName,
          swpLogo: showWatchProviders.logoPath,
          regName: watchProvidersRegistry.name,
          regLogo: watchProvidersRegistry.logoPath,
        })
        .from(showWatchProviders)
        .leftJoin(watchProvidersRegistry, eq(showWatchProviders.providerId, watchProvidersRegistry.tmdbId))
        .where(eq(showWatchProviders.showId, showId))
    );
    providers = (pRows as any[]).map((p: any) => ({
      id: p.providerId,
      name: p.regName || p.swpName,
      logo_path: p.regLogo || p.swpLogo,
      region: p.region,
      category: p.category || null,
      link_url: p.linkUrl || null,
      rank: p.rank ?? null,
    }));
  } catch {}
  if (!Array.isArray(videos) || videos.length === 0) {
    videos = Array.isArray((show as any).videos) ? (show as any).videos : [];
  }
  if (!Array.isArray(cast) || cast.length === 0) {
    cast = Array.isArray((show as any).cast) ? (show as any).cast : [];
  }
  if (!Array.isArray(providers) || providers.length === 0) {
    providers = Array.isArray((show as any).watchProviders) ? (show as any).watchProviders : [];
  }

  return {
    ...show,
    posterUrl: TMDBClient.getPosterUrl((show as any).posterUk || show.poster),
    backdropUrl: TMDBClient.getBackdropUrl((show as any).backdrop || null),
    videos,
    genres: (show as any).genres || [],
    numberOfSeasons: (show as any).numberOfSeasons ?? null,
    numberOfEpisodes: (show as any).numberOfEpisodes ?? null,
    latestSeasonNumber: (show as any).latestSeasonNumber ?? null,
    latestSeasonEpisodes: (show as any).latestSeasonEpisodes ?? null,
    lastEpisodeNumber: (show as any).lastEpisodeNumber ?? null,
    lastEpisodeSeason: (show as any).lastEpisodeSeason ?? null,
    lastEpisodeAirDate: (show as any).lastEpisodeAirDate ?? null,
    nextEpisodeNumber: (show as any).nextEpisodeNumber ?? null,
    nextEpisodeSeason: (show as any).nextEpisodeSeason ?? null,
    nextEpisodeAirDate: (show as any).nextEpisodeAirDate ?? null,
    status: (show as any).status ?? null,
    firstAirDate: (show as any).firstAirDate ?? null,
    lastAirDate: (show as any).lastAirDate ?? null,
    tagline: (show as any).tagline ?? null,
    traktRatings: { rating: (show as any).ratingTraktAvg ?? null, votes: (show as any).ratingTraktVotes ?? null },
    ratings: {
      trakt: ratingsTrakt,
      traktDistribution,
    },
    cast,
    watchProviders: providers,
    contentRatingsByRegion,
    ratingImdb: (show as any).ratingImdb ?? null,
    imdbVotes: (show as any).imdbVotes ?? null,
    ratingMetacritic: (show as any).ratingMetacritic ?? null,
    related,
  };
}
