import { db } from '@/db';
import {
  movies,
  movieRatings,
  movieRatingBuckets,
  movieWatchersSnapshots,
  movieTranslations,
  movieVideos,
  movieWatchProviders,
  watchProvidersRegistry,
  movieCast,
  movieContentRatings,
} from '@/db/schema';
import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';
import { omdbClient } from '@/lib/api/omdb';
import { calculateTrendingScore } from '@/lib/utils';
import { eq, inArray, desc } from 'drizzle-orm';
import { MonthlyMaps } from './types';
import { LRUCache, cachedWithRetry, withRetry } from './utils';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type ProcessMovieContext = {
  monthly: MonthlyMaps;
  maxWatchers: number;
  tmdbDetailsCache: LRUCache<number, any>;
  tmdbTranslationCache: LRUCache<number, any>;
  tmdbProvidersCache: LRUCache<string, any[]>;
  tmdbExternalIdsCache: LRUCache<number, any>;
};

export type ProcessMovieResult = {
  updated: number;
  added: number;
  skipped: boolean;
  ratingsUpdated: number;
  bucketsUpserted: number;
  snapshotsInserted: number;
  snapshotsUnchanged: number;
  snapshotsProcessed: number;
  error?: string;
};

export async function processMovie(
  traktItem: any,
  ctx: ProcessMovieContext
): Promise<ProcessMovieResult> {
  const res: ProcessMovieResult = {
    updated: 0,
    added: 0,
    skipped: false,
    ratingsUpdated: 0,
    bucketsUpserted: 0,
    snapshotsInserted: 0,
    snapshotsUnchanged: 0,
    snapshotsProcessed: 0,
  };
  try {
    const traktMovie = traktItem.movie;
    const tmdbId = traktMovie?.ids?.tmdb;
    if (!tmdbId) {
      res.skipped = true;
      return res;
    }
    const [tmdbData, ukTranslation] = await Promise.all([
      cachedWithRetry(ctx.tmdbDetailsCache, tmdbId, 'tmdb.movie.details', () =>
        tmdbClient.getMovieDetails(tmdbId)
      ),
      cachedWithRetry(ctx.tmdbTranslationCache, tmdbId, 'tmdb.movie.translation', () =>
        tmdbClient.getMovieTranslation(tmdbId)
      ),
    ]);
    const [videosData, credits] = await Promise.allSettled([
      withRetry(() => tmdbClient.getMovieVideos(tmdbId), 3, 300),
      withRetry(() => tmdbClient.getMovieCredits(tmdbId), 3, 300),
    ]);
    const allVideos =
      videosData.status === 'fulfilled' && Array.isArray(videosData.value?.results)
        ? videosData.value.results
        : [];
    const videosFiltered = allVideos.filter(
      (video: any) =>
        video.site === 'YouTube' && (video.type === 'Trailer' || video.type === 'Teaser')
    );
    const cast = (
      credits.status === 'fulfilled' && Array.isArray(credits.value?.cast)
        ? credits.value.cast.slice(0, 12)
        : []
    ).map((c: any) => ({
      id: c.id,
      name: c.name,
      character: c.character || null,
      profile_path: c.profile_path || null,
    }));

    let imdbRating: number | null = null;
    let ratingMetacritic: number | null = null;
    let imdbVotes: number | null = null;
    if (process.env.OMDB_API_KEY) {
      try {
        const imdbId =
          traktMovie.ids.imdb ||
          (
            await cachedWithRetry(ctx.tmdbExternalIdsCache, tmdbId, 'tmdb.movie.externalIds', () =>
              tmdbClient.getMovieExternalIds(tmdbId)
            )
          )?.imdb_id ||
          null;
        if (imdbId) {
          const agg = await withRetry(() => omdbClient.getAggregatedRatingsMovie(imdbId), 3, 300);
          imdbRating =
            typeof agg.imdbRating === 'number' && Number.isFinite(agg.imdbRating)
              ? agg.imdbRating
              : null;
          imdbVotes =
            typeof agg.imdbVotes === 'number' && Number.isFinite(agg.imdbVotes)
              ? agg.imdbVotes
              : null;
          ratingMetacritic =
            typeof agg.metacritic === 'number' && Number.isFinite(agg.metacritic)
              ? agg.metacritic
              : typeof agg.metascore === 'number' && Number.isFinite(agg.metascore)
                ? agg.metascore
                : null;
        }
      } catch {}
    }

    let ratingTraktAvg: number | null = null;
    let ratingTraktVotes: number | null = null;
    let ratingDistribution: Record<string, number> | undefined;
    try {
      const tr = await withRetry(
        () => traktClient.getMovieRatings(traktMovie.ids.slug || traktMovie.ids.trakt),
        3,
        300
      );
      ratingTraktAvg = typeof tr.rating === 'number' ? tr.rating : null;
      ratingTraktVotes = typeof tr.votes === 'number' ? tr.votes : null;
      ratingDistribution = tr.distribution as any;
    } catch {}

    const primaryRating =
      (tmdbData.vote_average ? Number(tmdbData.vote_average) : null) ??
      ratingTraktAvg ??
      imdbRating ??
      null;
    const trendingScore = calculateTrendingScore(
      tmdbData.vote_average || 0,
      traktItem.watchers,
      ctx.maxWatchers
    );

    const prevRow = await db
      .select({ ratingTraktPrev: movies.ratingTrakt })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
      .limit(1);
    const deltaPrev =
      typeof prevRow[0]?.ratingTraktPrev === 'number'
        ? traktItem.watchers - prevRow[0].ratingTraktPrev
        : null;
    const sumRecent3 =
      (ctx.monthly.m0[tmdbId] || 0) + (ctx.monthly.m1[tmdbId] || 0) + (ctx.monthly.m2[tmdbId] || 0);
    const sumPrev3 =
      (ctx.monthly.m3[tmdbId] || 0) + (ctx.monthly.m4[tmdbId] || 0) + (ctx.monthly.m5[tmdbId] || 0);
    const delta3mVal = sumRecent3 - sumPrev3;
    const watchersDelta = deltaPrev ?? 0;

    const watchProvidersUa = await cachedWithRetry(
      ctx.tmdbProvidersCache,
      `${tmdbId}|UA`,
      'tmdb.movie.providers.UA',
      () => tmdbClient.getMovieWatchProvidersByRegion(tmdbId, 'UA')
    );
    const watchProvidersUs = await cachedWithRetry(
      ctx.tmdbProvidersCache,
      `${tmdbId}|US`,
      'tmdb.movie.providers.US',
      () => tmdbClient.getMovieWatchProvidersByRegion(tmdbId, 'US')
    );
    const watchProvidersCombined = (() => {
      const map = new Map<string, any>();
      for (const p of [...(watchProvidersUa || []), ...(watchProvidersUs || [])]) {
        const key = `${p.region}:${p.id}`;
        if (!map.has(key)) map.set(key, p);
      }
      return Array.from(map.values());
    })();

    const movieData: any = {
      tmdbId,
      imdbId: traktMovie.ids.imdb || null,
      title: traktMovie.title || tmdbData.title,
      titleUk: ukTranslation?.titleUk || null,
      overview: tmdbData.overview,
      overviewUk: ukTranslation?.overviewUk || null,
      poster: tmdbData.poster_path,
      posterUk: ukTranslation?.posterUk || null,
      backdrop: tmdbData.backdrop_path || null,
      ratingTmdb: tmdbData.vote_average,
      ratingTmdbCount: tmdbData.vote_count,
      popularityTmdb: tmdbData.popularity,
      ratingImdb: imdbRating ?? null,
      imdbVotes: imdbVotes ?? null,
      ratingMetacritic: ratingMetacritic ?? null,
      ratingTraktAvg,
      ratingTraktVotes,
      ratingTrakt: traktItem.watchers,
      watchersDelta,
      delta3m: delta3mVal,
      primaryRating,
      trendingScore,
      releaseDate: tmdbData.release_date || null,
      runtime: Array.isArray(tmdbData.runtime) ? tmdbData.runtime[0] : tmdbData.runtime || null,
      genres: Array.isArray(tmdbData.genres) ? tmdbData.genres : [],
      videos: videosFiltered,
      status: tmdbData.status || null,
      tagline: tmdbData.tagline || null,
      watchProviders: watchProvidersCombined,
      cast,
      trendingUpdatedAt: new Date(),
      updatedAt: new Date(),
    };

    await db.transaction(async (tx: Tx) => {
      const existing = await tx
        .select({ id: movies.id })
        .from(movies)
        .where(eq(movies.tmdbId, tmdbId))
        .limit(1);
      if (existing.length > 0) {
        await tx.update(movies).set(movieData).where(eq(movies.tmdbId, tmdbId));
        res.updated++;
      } else {
        await tx.insert(movies).values(movieData);
        res.added++;
      }
      const movieIdRow = await tx
        .select({ id: movies.id })
        .from(movies)
        .where(eq(movies.tmdbId, tmdbId))
        .limit(1);
      const movieIdVal = (movieIdRow[0] as any)?.id;
      if (movieIdVal) {
        const existingMR = await tx
          .select({ id: movieRatings.id })
          .from(movieRatings)
          .where(eq(movieRatings.movieId, movieIdVal))
          .limit(1);
        if (existingMR.length > 0) {
          await tx
            .update(movieRatings)
            .set({
              source: 'trakt',
              avg: ratingTraktAvg ?? null,
              votes: ratingTraktVotes ?? null,
              updatedAt: new Date(),
            })
            .where(eq(movieRatings.id, existingMR[0].id));
        } else {
          await tx
            .insert(movieRatings)
            .values({
              movieId: movieIdVal,
              source: 'trakt',
              avg: ratingTraktAvg ?? null,
              votes: ratingTraktVotes ?? null,
              updatedAt: new Date(),
            } as any);
        }
        res.ratingsUpdated++;
        if (ratingDistribution) {
          const existingBuckets = await tx
            .select({ id: movieRatingBuckets.id, bucket: movieRatingBuckets.bucket })
            .from(movieRatingBuckets)
            .where(eq(movieRatingBuckets.movieId, movieIdVal));
          const byBucket = new Map<number, number>();
          for (const row of existingBuckets as any[])
            byBucket.set(Number((row as any).bucket), Number((row as any).id));
          const updates: { id: number; count: number }[] = [];
          const inserts: any[] = [];
          for (const [bucketStr, countVal] of Object.entries(ratingDistribution)) {
            const bucket = parseInt(bucketStr, 10);
            const count = typeof countVal === 'number' && Number.isFinite(countVal) ? countVal : 0;
            if (!Number.isFinite(bucket) || bucket < 1 || bucket > 10) continue;
            const existingId = byBucket.get(bucket);
            if (existingId) updates.push({ id: existingId, count });
            else
              inserts.push({
                movieId: movieIdVal,
                source: 'trakt',
                bucket,
                count,
                updatedAt: new Date(),
              });
          }
          if (updates.length) {
            await Promise.all(
              updates.map((u) =>
                tx
                  .update(movieRatingBuckets)
                  .set({ count: u.count, updatedAt: new Date() })
                  .where(eq(movieRatingBuckets.id, u.id))
              )
            );
          }
          if (inserts.length) await tx.insert(movieRatingBuckets).values(inserts as any[]);
          res.bucketsUpserted += updates.length + inserts.length;
        }
        const existingVideos = await tx
          .select({ id: movieVideos.id, site: movieVideos.site, key: movieVideos.key })
          .from(movieVideos)
          .where(eq(movieVideos.movieId, movieIdVal));
        const byKey = new Map<string, number>();
        for (const r of existingVideos as any[])
          byKey.set(`${(r as any).site}|${(r as any).key}`, (r as any).id);
        const updOpsV: Array<{ id: number; payload: any }> = [];
        const insValsV: any[] = [];
        for (const v of videosFiltered) {
          const payload = {
            movieId: movieIdVal,
            site: String(v.site || ''),
            key: String(v.key || ''),
            name: v.name || null,
            type: v.type || null,
            locale: v.iso_639_1 || null,
            official: typeof v.official === 'boolean' ? v.official : null,
            publishedAt: v.published_at ? new Date(v.published_at) : null,
            updatedAt: new Date(),
          } as any;
          const k = `${payload.site}|${payload.key}`;
          const id = byKey.get(k);
          if (id) updOpsV.push({ id, payload });
          else insValsV.push(payload);
        }
        if (updOpsV.length)
          await Promise.all(
            updOpsV.map((u) =>
              tx.update(movieVideos).set(u.payload).where(eq(movieVideos.id, u.id))
            )
          );
        if (insValsV.length) await tx.insert(movieVideos).values(insValsV as any[]);

        if (watchProvidersCombined.length) {
          try {
            const providerIds = Array.from(
              new Set(
                (watchProvidersCombined || []).map((p: any) => Number(p.id || 0)).filter(Boolean)
              )
            );
            if (providerIds.length) {
              const existingReg = await tx
                .select({ tmdbId: watchProvidersRegistry.tmdbId, id: watchProvidersRegistry.id })
                .from(watchProvidersRegistry)
                .where(inArray(watchProvidersRegistry.tmdbId, providerIds));
              const byTmdbId = new Map<number, number>();
              for (const r of existingReg as any[])
                byTmdbId.set(Number((r as any).tmdbId), Number((r as any).id));
              const insReg: any[] = [];
              const updReg: Array<{ id: number; payload: any }> = [];
              const toSlug = (name: string | null | undefined) =>
                String(name || '')
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '') || null;
              for (const p of watchProvidersCombined) {
                const pid = Number(p.id || 0);
                if (!pid) continue;
                const payload = {
                  tmdbId: pid,
                  name: p.name || null,
                  logoPath: p.logo_path || null,
                  slug: toSlug(p.name),
                  updatedAt: new Date(),
                } as any;
                const existingId = byTmdbId.get(pid);
                if (existingId) updReg.push({ id: existingId, payload });
                else insReg.push({ ...payload, createdAt: new Date() });
              }
              if (insReg.length) await tx.insert(watchProvidersRegistry).values(insReg as any[]);
              for (const u of updReg)
                await tx
                  .update(watchProvidersRegistry)
                  .set(u.payload)
                  .where(eq(watchProvidersRegistry.id, u.id));
            }
          } catch {}
          const existingProviders = await tx
            .select({
              id: movieWatchProviders.id,
              region: movieWatchProviders.region,
              providerId: movieWatchProviders.providerId,
              category: movieWatchProviders.category,
            })
            .from(movieWatchProviders)
            .where(eq(movieWatchProviders.movieId, movieIdVal));
          const byKeyProv = new Map<string, number>();
          for (const r of existingProviders as any[])
            byKeyProv.set(
              `${(r as any).region}|${(r as any).providerId}|${(r as any).category}`,
              (r as any).id
            );
          const updProv: Array<{ id: number; payload: any }> = [];
          const insProv: any[] = [];
          for (const p of watchProvidersCombined) {
            const payload = {
              movieId: movieIdVal,
              region: String(p.region || ''),
              providerId: Number(p.id || 0),
              providerName: p.name || null,
              logoPath: p.logo_path || null,
              linkUrl: p.link || null,
              category: p.category || null,
              rank: typeof p.rank === 'number' ? p.rank : null,
              updatedAt: new Date(),
            } as any;
            const k = `${payload.region}|${payload.providerId}|${payload.category}`;
            const id = byKeyProv.get(k);
            if (id) updProv.push({ id, payload });
            else insProv.push(payload);
          }
          if (updProv.length)
            await Promise.all(
              updProv.map((u) =>
                tx
                  .update(movieWatchProviders)
                  .set(u.payload)
                  .where(eq(movieWatchProviders.id, u.id))
              )
            );
          if (insProv.length) await tx.insert(movieWatchProviders).values(insProv as any[]);
        }

        if (cast.length) {
          const existingCast = await tx
            .select({
              id: movieCast.id,
              personId: movieCast.personId,
              character: movieCast.character,
            })
            .from(movieCast)
            .where(eq(movieCast.movieId, movieIdVal));
          const byKeyCast = new Map<string, number>();
          for (const r of existingCast as any[])
            byKeyCast.set(`${(r as any).personId}|${(r as any).character ?? ''}`, (r as any).id);
          const updOps: Array<{ id: number; payload: any }> = [];
          const insVals: any[] = [];
          for (const c of cast) {
            const payload = {
              movieId: movieIdVal,
              personId: Number(c.id || 0),
              name: c.name || null,
              character: c.character || null,
              order: null,
              profilePath: c.profile_path || null,
              updatedAt: new Date(),
            } as any;
            const k = `${payload.personId}|${payload.character ?? ''}`;
            const id = byKeyCast.get(k);
            if (id) updOps.push({ id, payload });
            else insVals.push(payload);
          }
          if (updOps.length)
            await Promise.all(
              updOps.map((u) => tx.update(movieCast).set(u.payload).where(eq(movieCast.id, u.id)))
            );
          if (insVals.length) await tx.insert(movieCast).values(insVals as any[]);
        }

        res.snapshotsProcessed++;
        const lastSnapRow = await tx
          .select({ watchers: movieWatchersSnapshots.watchers })
          .from(movieWatchersSnapshots)
          .where(eq(movieWatchersSnapshots.tmdbId, tmdbId))
          .orderBy(desc(movieWatchersSnapshots.createdAt))
          .limit(1);
        const lastWatchersVal = lastSnapRow[0]?.watchers ?? null;
        if (lastWatchersVal === null || lastWatchersVal !== traktItem.watchers) {
          await tx
            .insert(movieWatchersSnapshots)
            .values({ movieId: movieIdVal, tmdbId, watchers: traktItem.watchers } as any);
          res.snapshotsInserted++;
        } else {
          res.snapshotsUnchanged++;
        }
      }
    });
  } catch (error) {
    res.error = `Movie sync error`;
  }
  return res;
}
/**
 * Пер-фільм обробка: збагачує дані фільму з TMDB/Trakt/OMDb,
 * оновлює нормалізовані таблиці й обчислює метрики (тренд, дельти).
 *
 * @example
 * import { processMovie } from '@/lib/sync/processMovie';
 * import { LRUCache } from '@/lib/sync/utils';
 * const ctx = {
 *   monthly: { m0:{}, m1:{}, m2:{}, m3:{}, m4:{}, m5:{} },
 *   maxWatchers: 10000,
 *   tmdbDetailsCache: new LRUCache(300),
 *   tmdbTranslationCache: new LRUCache(300),
 *   tmdbProvidersCache: new LRUCache(400),
 *   tmdbExternalIdsCache: new LRUCache(400),
 * };
 * const traktItem = { watchers: 1234, movie: { ids: { tmdb: 603 }, title: 'The Matrix' } };
 * const res = await processMovie(traktItem, ctx);
 * console.log(res.updated, res.added);
 */
