/**
 * Пер- шоу обробка: збагачує дані шоу з TMDB/Trakt/OMDb,
 * оновлює нормалізовані таблиці й обчислює метрики (тренд, дельти).
 *
 * @example
 * import { processShow } from '@/lib/sync/processShow';
 * import { LRUCache } from '@/lib/sync/utils';
 * const ctx = {
 *   monthly: { m0:{}, m1:{}, m2:{}, m3:{}, m4:{}, m5:{} },
 *   maxWatchers: 10000,
 *   animeKeywords: ['anime', 'аніме'],
 *   tmdbDetailsCache: new LRUCache(300),
 *   tmdbTranslationCache: new LRUCache(300),
 *   tmdbProvidersCache: new LRUCache(400),
 *   tmdbContentRatingCache: new LRUCache(400),
 *   tmdbExternalIdsCache: new LRUCache(400),
 *   currentTrendingTmdbIds: new Set(),
 *   onRetryLabel: () => () => {}
 * };
 * const traktItem = { watchers: 1234, show: { ids: { tmdb: 1399 }, title: 'Example' } };
 * const res = await processShow(traktItem, ctx);
 * console.log(res.updated, res.added);
 */
import { db } from '@/db';
import {
  shows,
  showRelated,
  showRatings,
  showRatingBuckets,
  showWatchersSnapshots,
  showTranslations,
  genres as genresTable,
  showGenres,
  showVideos,
  showWatchProviders,
  watchProvidersRegistry,
  showCast,
  showContentRatings,
} from '@/db/schema';
import { tmdbClient } from '@/lib/api/tmdb';
import { traktClient } from '@/lib/api/trakt';
import { omdbClient } from '@/lib/api/omdb';
import { calculateTrendingScore } from '@/lib/utils';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { MonthlyMaps } from './types';
import { getRelatedTmdbIds } from './related';
import { LRUCache, cachedWithRetry, withRetry } from './utils';
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Контекст обробки одного шоу: кеші, конфіг та агрегації.
 *
 * @example
 * const ctx = { /* див. приклад вище */ };
 */
export type ProcessShowContext = {
  monthly: MonthlyMaps;
  maxWatchers: number;
  animeKeywords: string[];
  tmdbDetailsCache: LRUCache<number, any>;
  tmdbTranslationCache: LRUCache<number, any>;
  tmdbProvidersCache: LRUCache<string, any[]>;
  tmdbContentRatingCache: LRUCache<string, any>;
  tmdbExternalIdsCache: LRUCache<number, any>;
  currentTrendingTmdbIds: Set<number>;
  onRetryLabel: (label: string) => (attempt: number, err: any) => void;
};

/**
 * Результат обробки: лічильники змін і діагностика.
 *
 * @example
 * // { updated, added, ratingsUpdated, bucketsUpserted, ... }
 */
export type ProcessShowResult = {
  updated: number;
  added: number;
  skipped: boolean;
  ratingsUpdated: number;
  bucketsUpserted: number;
  snapshotsInserted: number;
  snapshotsUnchanged: number;
  snapshotsProcessed: number;
  relatedShowsInserted: number;
  relatedLinksAdded: number;
  relatedSourceCounts: { trakt: number; tmdb: number };
  relatedCandidatesTotal: number;
  relatedShowsWithCandidates: number; // 0/1 flag-like
  error?: string;
};

/**
 * Основна функція обробки одного Trakt-елемента.
 * Виконує: фільтрацію аніме, завантаження TMDB/OMDb/Trakt,
 * апсерти у БД, снить шот, пов’язані шоу та довідники.
 *
 * @example
 * const res = await processShow(traktItem, ctx);
 */
export async function processShow(traktItem: any, ctx: ProcessShowContext): Promise<ProcessShowResult> {
  const res: ProcessShowResult = {
    updated: 0,
    added: 0,
    skipped: false,
    ratingsUpdated: 0,
    bucketsUpserted: 0,
    snapshotsInserted: 0,
    snapshotsUnchanged: 0,
    snapshotsProcessed: 0,
    relatedShowsInserted: 0,
    relatedLinksAdded: 0,
    relatedSourceCounts: { trakt: 0, tmdb: 0 },
    relatedCandidatesTotal: 0,
    relatedShowsWithCandidates: 0,
  };
  try {
    const ANIME_GENRE_ID = 16;
    const traktShow = traktItem.show;
    const tmdbId = traktShow?.ids?.tmdb;
    if (!tmdbId) { res.skipped = true; return res; }

    // Early skip by Trakt title keyword
    const titleLower = String(traktShow.title || '').toLowerCase();
    if (ctx.animeKeywords.some(k => titleLower.includes(k))) { res.skipped = true; return res; }

    // Fetch details and UA translation
    const onRetryDetails = ctx.onRetryLabel('tmdb.details');
    const onRetryTranslation = ctx.onRetryLabel('tmdb.translation');
    const [tmdbShowData, ukTranslation] = await Promise.all([
      cachedWithRetry(ctx.tmdbDetailsCache, tmdbId, 'tmdb.details', () => tmdbClient.getShowDetails(tmdbId), onRetryDetails),
      cachedWithRetry(ctx.tmdbTranslationCache, tmdbId, 'tmdb.translation', () => tmdbClient.getShowTranslation(tmdbId), onRetryTranslation),
    ]);

    // Anime detection via TMDB genres or UA localized title
    const isAnime = tmdbShowData.genres?.some((g: any) => g.id === ANIME_GENRE_ID) ||
      ctx.animeKeywords.some(k => (ukTranslation?.titleUk || '').toLowerCase().includes(k));
    if (isAnime) { res.skipped = true; return res; }

    // Providers & content ratings
    const onRetryProvUA = ctx.onRetryLabel('tmdb.providers.UA');
    const onRetryProvUS = ctx.onRetryLabel('tmdb.providers.US');
    const onRetryCRUA = ctx.onRetryLabel('tmdb.content.UA');
    const onRetryCRUS = ctx.onRetryLabel('tmdb.content.US');
    const [watchProvidersUa, watchProvidersUs, contentRatingUa, contentRatingUs] = await Promise.all([
      cachedWithRetry(ctx.tmdbProvidersCache, `${tmdbId}|UA`, 'tmdb.providers.UA', () => tmdbClient.getWatchProvidersByRegion(tmdbId, 'UA'), onRetryProvUA),
      cachedWithRetry(ctx.tmdbProvidersCache, `${tmdbId}|US`, 'tmdb.providers.US', () => tmdbClient.getWatchProvidersByRegion(tmdbId, 'US'), onRetryProvUS),
      cachedWithRetry(ctx.tmdbContentRatingCache, `${tmdbId}|UA`, 'tmdb.content.UA', () => tmdbClient.getContentRatingByRegion(tmdbId, 'UA'), onRetryCRUA),
      cachedWithRetry(ctx.tmdbContentRatingCache, `${tmdbId}|US`, 'tmdb.content.US', () => tmdbClient.getContentRatingByRegion(tmdbId, 'US'), onRetryCRUS),
    ]);

    // Videos & Cast
    const [videosData, credits] = await Promise.allSettled([
      withRetry(() => tmdbClient.getShowVideos(tmdbId), 3, 300, ctx.onRetryLabel('tmdb.videos')),
      withRetry(() => tmdbClient.getAggregateCredits(tmdbId), 3, 300, ctx.onRetryLabel('tmdb.credits')),
    ]);
    const allVideos = videosData.status === 'fulfilled' && Array.isArray(videosData.value?.results) ? videosData.value.results : [];
    const videosFiltered = allVideos.filter((video: any) => video.site === 'YouTube' && (video.type === 'Trailer' || video.type === 'Teaser'));
    const cast = (credits.status === 'fulfilled' && Array.isArray(credits.value?.cast) ? credits.value.cast.slice(0, 12) : []).map((c: any) => ({
      id: c.id,
      name: c.name,
      roles: Array.isArray(c.roles) ? c.roles.map((r: any) => r.character || r.job).filter(Boolean) : (c.character ? [c.character] : []),
      profile_path: c.profile_path || null,
    }));

    // OMDb aggregated ratings
    let imdbRating: number | null = null;
    let ratingMetacritic: number | null = null;
    let imdbVotes: number | null = null;
    if (process.env.OMDB_API_KEY) {
      try {
        const imdbId = traktShow.ids.imdb || (await cachedWithRetry(ctx.tmdbExternalIdsCache, tmdbId, 'tmdb.externalIds', () => tmdbClient.getShowExternalIds(tmdbId), ctx.onRetryLabel('tmdb.externalIds')))?.imdb_id || null;
        if (imdbId) {
          const agg = await withRetry(() => omdbClient.getAggregatedRatings(imdbId), 3, 300, ctx.onRetryLabel('omdb.agg'));
          imdbRating = typeof agg.imdbRating === 'number' && Number.isFinite(agg.imdbRating) ? agg.imdbRating : null;
          imdbVotes = typeof agg.imdbVotes === 'number' && Number.isFinite(agg.imdbVotes) ? agg.imdbVotes : null;
          ratingMetacritic = typeof agg.metacritic === 'number' && Number.isFinite(agg.metacritic)
            ? agg.metacritic
            : (typeof agg.metascore === 'number' && Number.isFinite(agg.metascore) ? agg.metascore : null);
        }
      } catch {}
    }

    // Trakt ratings (avg/votes + buckets)
    let ratingTraktAvg: number | null = null;
    let ratingTraktVotes: number | null = null;
    let ratingDistribution: Record<string, number> | undefined;
    try {
      const tr = await withRetry(() => traktClient.getShowRatings(traktShow.ids.slug || traktShow.ids.trakt), 3, 300, ctx.onRetryLabel('trakt.ratings'));
      ratingTraktAvg = typeof tr.rating === 'number' ? tr.rating : null;
      ratingTraktVotes = typeof tr.votes === 'number' ? tr.votes : null;
      ratingDistribution = tr.distribution as any;
    } catch {}

    // Score & deltas
    const primaryRating = (tmdbShowData.vote_average ? Number(tmdbShowData.vote_average) : null) ?? (ratingTraktAvg ?? null) ?? (imdbRating ?? null);
    const trendingScore = calculateTrendingScore(
      tmdbShowData.vote_average || 0,
      traktItem.watchers,
      ctx.maxWatchers
    );

    const prevRow = await db
      .select({ ratingTraktPrev: shows.ratingTrakt })
      .from(shows).where(eq(shows.tmdbId, tmdbId)).limit(1);
    const deltaPrev = typeof prevRow[0]?.ratingTraktPrev === 'number' ? (traktItem.watchers - prevRow[0].ratingTraktPrev) : null;
    const deltaMonthly = (typeof ctx.monthly.m0[tmdbId] === 'number' && typeof ctx.monthly.m1[tmdbId] === 'number')
      ? (ctx.monthly.m0[tmdbId] - ctx.monthly.m1[tmdbId])
      : null;
    const sumRecent3 = (ctx.monthly.m0[tmdbId] || 0) + (ctx.monthly.m1[tmdbId] || 0) + (ctx.monthly.m2[tmdbId] || 0);
    const sumPrev3 = (ctx.monthly.m3[tmdbId] || 0) + (ctx.monthly.m4[tmdbId] || 0) + (ctx.monthly.m5[tmdbId] || 0);
    let delta3mVal = sumRecent3 - sumPrev3;
    if (delta3mVal === 0) {
      try {
        const snaps = await db
          .select({ watchers: showWatchersSnapshots.watchers })
          .from(showWatchersSnapshots)
          .where(eq(showWatchersSnapshots.tmdbId, tmdbId))
          .orderBy(desc(showWatchersSnapshots.createdAt))
          .limit(6);
        if (Array.isArray(snaps) && snaps.length >= 4) {
          const recent = snaps.slice(0, 3).reduce((sum: number, r: any) => sum + (Number(r.watchers) || 0), 0);
          const prev3 = snaps.slice(3, 6).reduce((sum: number, r: any) => sum + (Number(r.watchers) || 0), 0);
          delta3mVal = recent - prev3;
        }
      } catch {}
    }
    const watchersDelta = (deltaMonthly ?? deltaPrev ?? 0);

    // Related candidates
    ctx.currentTrendingTmdbIds.add(tmdbId);
    const { ids: relatedTmdbIds, source: relatedSource } = await getRelatedTmdbIds(tmdbId, traktShow.ids.slug || traktShow.ids.trakt);
    res.relatedCandidatesTotal += relatedTmdbIds.length;
    if (relatedTmdbIds.length > 0) res.relatedShowsWithCandidates += 1;

    // Season/episode payload pieces
    const seasonsArr = Array.isArray(tmdbShowData.seasons) ? tmdbShowData.seasons : [];
    let latestSeasonNumber: number | null = null;
    let latestSeasonEpisodes: number | null = null;
    if (seasonsArr.length > 0) {
      const sortedSeasons = seasonsArr
        .filter((s: any) => typeof s.season_number === 'number')
        .sort((a: any, b: any) => (b.season_number ?? 0) - (a.season_number ?? 0));
      const latest = sortedSeasons.find((s: any) => s.season_number !== 0) || sortedSeasons[0];
      latestSeasonNumber = typeof latest?.season_number === 'number' ? latest.season_number : null;
      latestSeasonEpisodes = typeof latest?.episode_count === 'number' ? latest.episode_count : null;
    }
    const lastEpisodeSeason = tmdbShowData.last_episode_to_air?.season_number ?? null;
    const lastEpisodeNumber = tmdbShowData.last_episode_to_air?.episode_number ?? null;
    const lastEpisodeAirDate = tmdbShowData.last_episode_to_air?.air_date ?? null;
    const nextEpisodeSeason = (tmdbShowData as any)?.next_episode_to_air?.season_number ?? null;
    const nextEpisodeNumber = (tmdbShowData as any)?.next_episode_to_air?.episode_number ?? null;
    const nextEpisodeAirDate = (tmdbShowData as any)?.next_episode_to_air?.air_date ?? null;

    const watchProvidersCombined = (() => {
      const map = new Map<string, any>();
      for (const p of [...(watchProvidersUa || []), ...(watchProvidersUs || [])]) {
        const key = `${p.region}:${p.id}`;
        if (!map.has(key)) map.set(key, p);
      }
      return Array.from(map.values());
    })();

    const showData: any = {
      tmdbId,
      imdbId: traktShow.ids.imdb || null,
      title: traktShow.title || tmdbShowData.name,
      titleUk: ukTranslation?.titleUk || null,
      overview: tmdbShowData.overview,
      overviewUk: ukTranslation?.overviewUk || null,
      poster: tmdbShowData.poster_path,
      posterUk: ukTranslation?.posterUk || null,
      ratingTmdb: tmdbShowData.vote_average,
      ratingTmdbCount: tmdbShowData.vote_count,
      popularityTmdb: tmdbShowData.popularity,
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
      firstAirDate: tmdbShowData.first_air_date || null,
      backdrop: tmdbShowData.backdrop_path || null,
      genres: Array.isArray(tmdbShowData.genres) ? tmdbShowData.genres : [],
      videos: videosFiltered,
      numberOfSeasons: typeof tmdbShowData.number_of_seasons === 'number' ? tmdbShowData.number_of_seasons : null,
      numberOfEpisodes: typeof tmdbShowData.number_of_episodes === 'number' ? tmdbShowData.number_of_episodes : null,
      latestSeasonNumber,
      latestSeasonEpisodes,
      lastEpisodeSeason,
      lastEpisodeNumber,
      lastEpisodeAirDate,
      nextEpisodeSeason,
      nextEpisodeNumber,
      nextEpisodeAirDate,
      status: tmdbShowData.status || null,
      tagline: tmdbShowData.tagline || null,
      contentRating: contentRatingUa || null,
      watchProviders: watchProvidersCombined,
      cast,
      related: relatedTmdbIds,
      trendingUpdatedAt: new Date(),
      updatedAt: new Date(),
    };

    await db.transaction(async (tx: Tx) => {
      // Upsert show
      const existingShow = await tx
        .select({ id: shows.id })
        .from(shows)
        .where(eq(shows.tmdbId, tmdbId))
        .limit(1);

      if (existingShow.length > 0) {
        await tx.update(shows).set(showData).where(eq(shows.tmdbId, tmdbId));
        res.updated++;
      } else {
        await tx.insert(shows).values(showData);
        res.added++;
      }

      // showId
      const showIdRow = await tx.select({ id: shows.id }).from(shows).where(eq(shows.tmdbId, tmdbId)).limit(1);
      const showIdVal = (showIdRow[0] as any)?.id;

      if (showIdVal) {
        // Ratings
        const existingSR = await tx.select({ id: showRatings.id }).from(showRatings).where(eq(showRatings.showId, showIdVal)).limit(1);
        if (existingSR.length > 0) {
          await tx.update(showRatings).set({ source: 'trakt', avg: ratingTraktAvg ?? null, votes: ratingTraktVotes ?? null, updatedAt: new Date() }).where(eq(showRatings.id, existingSR[0].id));
        } else {
          await tx.insert(showRatings).values({ showId: showIdVal, source: 'trakt', avg: ratingTraktAvg ?? null, votes: ratingTraktVotes ?? null, updatedAt: new Date() });
        }
        res.ratingsUpdated++;

        // Rating buckets
        if (ratingDistribution) {
          const existingBuckets = await tx
            .select({ id: showRatingBuckets.id, bucket: showRatingBuckets.bucket })
            .from(showRatingBuckets)
            .where(and(eq(showRatingBuckets.showId, showIdVal), eq(showRatingBuckets.source, 'trakt')));
          const byBucket = new Map<number, number>();
          for (const row of existingBuckets as any[]) byBucket.set(Number((row as any).bucket), Number((row as any).id));
          const updates: { id: number; count: number }[] = [];
          const inserts: any[] = [];
          for (const [bucketStr, countVal] of Object.entries(ratingDistribution)) {
            const bucket = parseInt(bucketStr, 10);
            const count = typeof countVal === 'number' && Number.isFinite(countVal) ? countVal : 0;
            if (!Number.isFinite(bucket) || bucket < 1 || bucket > 10) continue;
            const existingId = byBucket.get(bucket);
            if (existingId) updates.push({ id: existingId, count });
            else inserts.push({ showId: showIdVal, source: 'trakt', bucket, count, updatedAt: new Date() });
          }
          if (updates.length) {
            await Promise.all(updates.map(u => tx.update(showRatingBuckets).set({ count: u.count, updatedAt: new Date() }).where(eq(showRatingBuckets.id, u.id))));
          }
          if (inserts.length) {
            await tx.insert(showRatingBuckets).values(inserts as any[]);
          }
          res.bucketsUpserted += updates.length + inserts.length;
        }

        // Translations
        const localeUk = 'uk-UA';
        const localeEn = 'en-US';
        const trExisting = await tx
          .select({ id: showTranslations.id, locale: showTranslations.locale })
          .from(showTranslations)
          .where(eq(showTranslations.showId, showIdVal));
        const byLocale = new Map<string, number>();
        for (const r of trExisting as any[]) byLocale.set((r as any).locale, (r as any).id);
        const trUpdates: Array<{ id: number; payload: any }> = [];
        const trInserts: any[] = [];
        if (byLocale.has(localeUk)) {
          trUpdates.push({ id: byLocale.get(localeUk)!, payload: { title: ukTranslation?.titleUk || null, overview: ukTranslation?.overviewUk || null, tagline: tmdbShowData.tagline || null, updatedAt: new Date() } });
        } else {
          trInserts.push({ showId: showIdVal, locale: localeUk, title: ukTranslation?.titleUk || null, overview: ukTranslation?.overviewUk || null, tagline: tmdbShowData.tagline || null });
        }
        if (byLocale.has(localeEn)) {
          trUpdates.push({ id: byLocale.get(localeEn)!, payload: { title: tmdbShowData.name || null, overview: tmdbShowData.overview || null, tagline: tmdbShowData.tagline || null, updatedAt: new Date() } });
        } else {
          trInserts.push({ showId: showIdVal, locale: localeEn, title: tmdbShowData.name || null, overview: tmdbShowData.overview || null, tagline: tmdbShowData.tagline || null });
        }
        if (trUpdates.length) {
          await Promise.all(trUpdates.map(u => tx.update(showTranslations).set(u.payload).where(eq(showTranslations.id, u.id))));
        }
        if (trInserts.length) {
          await tx.insert(showTranslations).values(trInserts as any[]);
        }

        // Genres registry + mapping
        if (Array.isArray(tmdbShowData.genres) && tmdbShowData.genres.length > 0) {
          const tmdbGenreIds = tmdbShowData.genres.map((g: any) => Number(g.id)).filter((id: any) => Number.isFinite(id));
          const existingGenres = await tx.select({ id: genresTable.id, tmdbId: genresTable.tmdbId }).from(genresTable).where(inArray(genresTable.tmdbId, tmdbGenreIds));
          const existingMap = new Map<number, number>();
          for (const g of existingGenres as any[]) existingMap.set((g as any).tmdbId, (g as any).id);
          const missing = tmdbShowData.genres.filter((g: any) => !existingMap.has(Number(g.id)));
          if (missing.length) {
            try { await tx.insert(genresTable).values(missing.map((mg: any) => ({ tmdbId: Number(mg.id), nameEn: String(mg.name || '') || 'Unknown' })) as any[]); } catch {}
          }
          const allGenres = await tx.select({ id: genresTable.id, tmdbId: genresTable.tmdbId }).from(genresTable).where(inArray(genresTable.tmdbId, tmdbGenreIds));
          const idByTmdb = new Map<number, number>();
          for (const g of allGenres as any[]) idByTmdb.set((g as any).tmdbId, (g as any).id);
          const existingLinks = await tx.select({ genreId: showGenres.genreId }).from(showGenres).where(eq(showGenres.showId, showIdVal));
          const existingSet = new Set<number>((existingLinks as any[]).map((x: any) => Number(x.genreId)));
          const linkValues: any[] = [];
          for (const tmdbGid of tmdbGenreIds) {
            const gid = idByTmdb.get(tmdbGid);
            if (!gid || existingSet.has(gid)) continue;
            linkValues.push({ showId: showIdVal, genreId: gid });
          }
          if (linkValues.length) {
            await tx.insert(showGenres).values(linkValues as any[]);
          }
        }

        // Videos
        if (videosFiltered.length) {
          const existingVideos = await tx.select({ id: showVideos.id, site: showVideos.site, key: showVideos.key }).from(showVideos).where(eq(showVideos.showId, showIdVal));
          const byKey = new Map<string, number>();
          for (const r of existingVideos as any[]) byKey.set(`${(r as any).site}|${(r as any).key}`, (r as any).id);
          const updOps: Array<{ id: number; payload: any }> = [];
          const insVals: any[] = [];
          for (const v of videosFiltered) {
            const payload = {
              showId: showIdVal,
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
            if (id) updOps.push({ id, payload }); else insVals.push(payload);
          }
          if (updOps.length) await Promise.all(updOps.map(u => tx.update(showVideos).set(u.payload).where(eq(showVideos.id, u.id))));
          if (insVals.length) await tx.insert(showVideos).values(insVals as any[]);
        }

        // Watch providers
        if (watchProvidersCombined.length) {
          // Upsert canonical registry for providers
          try {
            const providerIds = Array.from(new Set((watchProvidersCombined || []).map((p: any) => Number(p.id || 0)).filter(Boolean)));
            if (providerIds.length) {
              const existingReg = await tx
                .select({ tmdbId: watchProvidersRegistry.tmdbId, id: watchProvidersRegistry.id })
                .from(watchProvidersRegistry)
                .where(inArray(watchProvidersRegistry.tmdbId, providerIds));
              const byTmdbId = new Map<number, number>();
              for (const r of existingReg as any[]) byTmdbId.set(Number((r as any).tmdbId), Number((r as any).id));
              const insReg: any[] = [];
              const updReg: Array<{ id: number; payload: any }> = [];
              const toSlug = (name: string | null | undefined) => (String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || null;
              for (const p of watchProvidersCombined) {
                const tmdbId = Number(p.id || 0);
                if (!tmdbId) continue;
                const payload = {
                  tmdbId,
                  name: p.name || null,
                  logoPath: p.logo_path || null,
                  slug: toSlug(p.name),
                  updatedAt: new Date(),
                } as any;
                const existingId = byTmdbId.get(tmdbId);
                if (existingId) {
                  updReg.push({ id: existingId, payload });
                } else {
                  insReg.push({ ...payload, createdAt: new Date() });
                }
              }
              if (insReg.length) await tx.insert(watchProvidersRegistry).values(insReg as any[]);
              for (const u of updReg) {
                await tx.update(watchProvidersRegistry).set(u.payload).where(eq(watchProvidersRegistry.id, u.id));
              }
            }
          } catch (e) {
            console.warn('Failed to upsert watch providers registry:', e);
          }

          const existingProviders = await tx
            .select({ id: showWatchProviders.id, region: showWatchProviders.region, providerId: showWatchProviders.providerId, category: showWatchProviders.category })
            .from(showWatchProviders)
            .where(eq(showWatchProviders.showId, showIdVal));
          const byKeyProv = new Map<string, number>();
          for (const r of existingProviders as any[]) byKeyProv.set(`${(r as any).region}|${(r as any).providerId}|${(r as any).category}`, (r as any).id);
          const updProv: Array<{ id: number; payload: any }> = [];
          const insProv: any[] = [];
          for (const p of watchProvidersCombined) {
            const payload = {
              showId: showIdVal,
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
            if (id) updProv.push({ id, payload }); else insProv.push(payload);
          }
          if (updProv.length) await Promise.all(updProv.map(u => tx.update(showWatchProviders).set(u.payload).where(eq(showWatchProviders.id, u.id))));
          if (insProv.length) await tx.insert(showWatchProviders).values(insProv as any[]);
        }

        // Content ratings per region
        {
          const regions = ['UA', 'US'] as const;
          const existingCR = await tx.select({ id: showContentRatings.id, region: showContentRatings.region }).from(showContentRatings).where(eq(showContentRatings.showId, showIdVal));
          const byRegion = new Map<string, number>();
          for (const r of existingCR as any[]) byRegion.set((r as any).region, (r as any).id);
          const insVals: any[] = [];
          const updOps: Array<{ id: number; payload: any }> = [];
          for (const region of regions) {
            const rating = region === 'UA' ? contentRatingUa : contentRatingUs;
            if (!rating) continue;
            const payload = { showId: showIdVal, region, rating, updatedAt: new Date() } as any;
            const id = byRegion.get(region);
            if (id) updOps.push({ id, payload }); else insVals.push(payload);
          }
          if (updOps.length) await Promise.all(updOps.map(u => tx.update(showContentRatings).set(u.payload).where(eq(showContentRatings.id, u.id))));
          if (insVals.length) await tx.insert(showContentRatings).values(insVals as any[]);
        }

        // Cast
        if (cast.length) {
          const existingCast = await tx.select({ id: showCast.id, personId: showCast.personId, character: showCast.character }).from(showCast).where(eq(showCast.showId, showIdVal));
          const byKeyCast = new Map<string, number>();
          for (const r of existingCast as any[]) byKeyCast.set(`${(r as any).personId}|${(r as any).character ?? ''}`, (r as any).id);
          const updOps: Array<{ id: number; payload: any }> = [];
          const insVals: any[] = [];
          for (const c of cast) {
            const character = Array.isArray(c.roles) && c.roles.length > 0 ? String(c.roles[0]) : null;
            const payload = { showId: showIdVal, personId: Number(c.id || 0), name: c.name || null, character, order: null, profilePath: c.profile_path || null, updatedAt: new Date() } as any;
            const k = `${payload.personId}|${payload.character ?? ''}`;
            const id = byKeyCast.get(k);
            if (id) updOps.push({ id, payload }); else insVals.push(payload);
          }
          if (updOps.length) await Promise.all(updOps.map(u => tx.update(showCast).set(u.payload).where(eq(showCast.id, u.id))));
          if (insVals.length) await tx.insert(showCast).values(insVals as any[]);
        }

        // Watchers snapshot
        res.snapshotsProcessed++;
        const lastSnapRow = await tx
          .select({ watchers: showWatchersSnapshots.watchers })
          .from(showWatchersSnapshots)
          .where(eq(showWatchersSnapshots.tmdbId, tmdbId))
          .orderBy(desc(showWatchersSnapshots.createdAt))
          .limit(1);
        const lastWatchersVal = lastSnapRow[0]?.watchers ?? null;
        if (lastWatchersVal === null || lastWatchersVal !== traktItem.watchers) {
          await tx.insert(showWatchersSnapshots).values({ showId: showIdVal, tmdbId, watchers: traktItem.watchers });
          res.snapshotsInserted++;
        } else {
          res.snapshotsUnchanged++;
        }

        // Related mappings
        if (relatedTmdbIds.length > 0) {
          const relRows = await tx.select({ id: shows.id, tmdbId: shows.tmdbId }).from(shows).where(inArray(shows.tmdbId, relatedTmdbIds)).limit(50);
          const existingSetTmdb = new Set<number>(relRows.map((r: any) => r.tmdbId));
          const missingIds = relatedTmdbIds.filter(id => !existingSetTmdb.has(id)).slice(0, 12);
          for (const relTmdbId of missingIds) {
            try {
              const relDetails: any = await tmdbClient.getShowDetails(relTmdbId);
              const relUk = await tmdbClient.getShowTranslation(relTmdbId);
              const relUa = await tmdbClient.getWatchProvidersByRegion(relTmdbId, 'UA');
              const relUs = await tmdbClient.getWatchProvidersByRegion(relTmdbId, 'US');
              const relProviders = (() => {
                const map = new Map<string, any>();
                for (const p of [...(relUa || []), ...(relUs || [])]) {
                  const key = `${p.region}:${p.id}`;
                  if (!map.has(key)) map.set(key, p);
                }
                return Array.from(map.values());
              })();
              let relImdbRating: number | null = null;
              let relImdbVotes: number | null = null;
              let relMetacritic: number | null = null;
              if (process.env.OMDB_API_KEY) {
                try {
                  const relExt = await tmdbClient.getShowExternalIds(relTmdbId);
                  const relImdbId = relExt?.imdb_id || null;
                  if (relImdbId) {
                    const agg = await omdbClient.getAggregatedRatings(relImdbId);
                    relImdbRating = typeof agg.imdbRating === 'number' && Number.isFinite(agg.imdbRating) ? agg.imdbRating : null;
                    relImdbVotes = typeof agg.imdbVotes === 'number' && Number.isFinite(agg.imdbVotes) ? agg.imdbVotes : null;
                    relMetacritic = typeof agg.metacritic === 'number' && Number.isFinite(agg.metacritic) ? agg.metacritic : (typeof agg.metascore === 'number' && Number.isFinite(agg.metascore) ? agg.metascore : null);
                  }
                } catch {}
              }
              const relPrimary = (typeof relDetails?.vote_average === 'number' ? Number(relDetails.vote_average) : null) ?? (relImdbRating ?? null);
              const relData: any = {
                tmdbId: relTmdbId,
                title: relDetails?.name || 'Unknown',
                titleUk: relUk?.titleUk || null,
                overview: relDetails?.overview || null,
                overviewUk: relUk?.overviewUk || null,
                poster: relDetails?.poster_path || null,
                posterUk: relUk?.posterUk || null,
                backdrop: relDetails?.backdrop_path || null,
                ratingTmdb: typeof relDetails?.vote_average === 'number' ? relDetails.vote_average : null,
                ratingTmdbCount: typeof relDetails?.vote_count === 'number' ? relDetails.vote_count : null,
                popularityTmdb: typeof relDetails?.popularity === 'number' ? relDetails.popularity : null,
                ratingImdb: relImdbRating,
                imdbVotes: relImdbVotes,
                ratingMetacritic: relMetacritic,
                watchProviders: relProviders,
                contentRating: null,
                videos: [],
                primaryRating: relPrimary,
                updatedAt: new Date(),
              };
              await tx.insert(shows).values(relData);
              res.relatedShowsInserted++;
            } catch {}
          }
          // Link relations
          const relRows2 = await tx.select({ id: shows.id, tmdbId: shows.tmdbId }).from(shows).where(inArray(shows.tmdbId, relatedTmdbIds)).limit(50);
          const relMap2 = new Map<number, number>();
          for (const r of relRows2 as any[]) { relMap2.set((r as any).tmdbId, (r as any).id); }
          const existingLinks = await tx.select({ relatedShowId: showRelated.relatedShowId }).from(showRelated).where(eq(showRelated.showId, showIdVal));
          const existingSet = new Set<number>((existingLinks as any[]).map((x: any) => x.relatedShowId));
          const relInsertVals: any[] = [];
          for (let i = 0; i < relatedTmdbIds.length; i++) {
            const relTmdbId = relatedTmdbIds[i];
            const relIdVal = relMap2.get(relTmdbId);
            if (!relIdVal || existingSet.has(relIdVal)) continue;
            relInsertVals.push({ showId: showIdVal, relatedShowId: relIdVal, source: relatedSource, rank: i + 1, score: null, updatedAt: new Date() });
            res.relatedLinksAdded++;
            res.relatedSourceCounts[relatedSource]++;
          }
          if (relInsertVals.length) await tx.insert(showRelated).values(relInsertVals as any[]);
        }
      }
    });
  } catch (error) {
    res.error = `Show sync error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
  return res;
}
