import { db } from '@/db';
import {
  movies,
  movieWatchersSnapshots,
  movieVideos,
  movieCast,
  movieWatchProviders,
  movieContentRatings,
} from '@/db/schema';
import { desc, isNotNull, and, sql, gt, asc, inArray, gte, lte, eq } from 'drizzle-orm';
import { TMDBClient } from '@/lib/api/tmdb';
import type { Movie, MovieCast } from '@/db/schema';

interface MovieQueryParams {
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
  sort?: 'trending' | 'watchers' | 'delta' | 'delta3m';
  days?: number;
  provider?: string | null;
  region?: string | null;
  category?: string | null;
}

export async function getMovies({
  limit = 20,
  offset = 0,
  order = 'desc',
  sort = 'trending',
  days = 0,
  provider = null,
  region = null,
  category = null,
}: MovieQueryParams = {}) {
  /**
   * Повертає трендові фільми з фільтрами та збагаченням (постери, спарклайни).
   *
   * @example
   * const list = await getMovies({ limit: 50, sort: 'delta', days: 7 });
   *
   * @returns Array<{
   *   id: number; tmdbId: number; title: string;
   *   posterUrl: string | null; watchersDelta: number | null; watchersSparkline: number[];
   * }>
   */
  const updatedAfter = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
  const useWindowDelta = sort === 'delta' && days > 0;
  const signClause = useWindowDelta
    ? sql`TRUE`
    : sort === 'delta'
      ? order === 'asc'
        ? sql`COALESCE("movies"."watchers_delta", 0) < 0`
        : sql`COALESCE("movies"."watchers_delta", 0) > 0`
      : sort === 'delta3m'
        ? order === 'asc'
          ? sql`COALESCE("movies"."delta_3m", 0) < 0`
          : sql`COALESCE("movies"."delta_3m", 0) > 0`
        : sql`TRUE`;

  const recencyClause = updatedAfter ? gt(movies.trendingUpdatedAt, updatedAfter) : sql`TRUE`;
  const baseQuery = db.select().from(movies);
  const whereClause = region
    ? and(
        isNotNull(movies.trendingScore),
        isNotNull(movies.ratingTrakt),
        recencyClause,
        signClause,
        sql`EXISTS (SELECT 1 FROM "movie_watch_providers" mwp WHERE mwp.movie_id = "movies"."id" AND mwp.region = ${region} ${provider ? sql`AND lower(mwp.provider_name) LIKE ${'%' + String(provider).toLowerCase() + '%'}` : sql``} ${category ? sql`AND mwp.category = ${category}` : sql``})`
      )
    : and(
        isNotNull(movies.trendingScore),
        isNotNull(movies.ratingTrakt),
        recencyClause,
        signClause
      );

  const poolLimit = Math.max(limit * 10, 100);
  const rows = await baseQuery
    .where(whereClause)
    .orderBy(
      useWindowDelta
        ? sql`"movies"."rating_trakt" DESC`
        : sort === 'watchers'
          ? order === 'asc'
            ? sql`"movies"."rating_trakt" ASC`
            : sql`"movies"."rating_trakt" DESC`
          : sort === 'delta'
            ? order === 'asc'
              ? sql`COALESCE("movies"."watchers_delta", 0) ASC`
              : sql`COALESCE("movies"."watchers_delta", 0) DESC`
            : sort === 'delta3m'
              ? order === 'asc'
                ? sql`COALESCE("movies"."delta_3m", 0) ASC`
                : sql`COALESCE("movies"."delta_3m", 0) DESC`
              : order === 'asc'
                ? sql`"movies"."trending_score" ASC`
                : sql`"movies"."trending_score" DESC`
    )
    .limit(useWindowDelta ? poolLimit : limit)
    .offset(useWindowDelta ? 0 : offset);

  const tmdbIds = rows.map((s: any) => s.tmdbId).filter((v: any) => typeof v === 'number');
  const now = new Date();
  const sparkRows =
    tmdbIds.length > 0
      ? await db
          .select({
            tmdbId: movieWatchersSnapshots.tmdbId,
            watchers: movieWatchersSnapshots.watchers,
            createdAt: movieWatchersSnapshots.createdAt,
          })
          .from(movieWatchersSnapshots)
          .where(inArray(movieWatchersSnapshots.tmdbId, tmdbIds))
          .orderBy(desc(movieWatchersSnapshots.createdAt))
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
        tmdbId: movieWatchersSnapshots.tmdbId,
        watchers: movieWatchersSnapshots.watchers,
        createdAt: movieWatchersSnapshots.createdAt,
      })
      .from(movieWatchersSnapshots)
      .where(
        and(
          inArray(movieWatchersSnapshots.tmdbId, tmdbIds),
          gte(movieWatchersSnapshots.createdAt, updatedAfter!),
          lte(movieWatchersSnapshots.createdAt, now)
        )
      )
      .orderBy(asc(movieWatchersSnapshots.createdAt));
    for (const r of windowRows as Array<{ tmdbId: number; watchers: number; createdAt: Date }>) {
      if (!earliestMap.has(r.tmdbId)) earliestMap.set(r.tmdbId, Number(r.watchers));
      latestMap.set(r.tmdbId, Number(r.watchers));
    }
  }
  type MovieEnriched = any & {
    watchersDelta: number | null;
    posterUrl: string | null;
    watchersSparkline: number[];
  };
  let out = rows.map((m: any): MovieEnriched => {
    const spark = (sparkMap.get(m.tmdbId) || []).slice().reverse();
    let deltaWindow: number | null = null;
    if (useWindowDelta && updatedAfter) {
      const earliest = earliestMap.get(m.tmdbId);
      const latest = latestMap.get(m.tmdbId);
      if (typeof earliest === 'number' && typeof latest === 'number' && earliest !== latest) {
        deltaWindow = latest - earliest;
      } else {
        deltaWindow = null;
      }
    }
    return {
      ...m,
      watchersDelta: typeof deltaWindow === 'number' ? deltaWindow : (m.watchersDelta ?? null),
      posterUrl: TMDBClient.getPosterUrl(m.posterUk || m.poster),
      watchersSparkline: spark,
    };
  });
  if (useWindowDelta) {
    const signed = out.filter((s: any) => {
      const v = Number(s.watchersDelta || 0);
      return order === 'asc' ? v < 0 : v > 0;
    });
    out = (signed.length > 0 ? signed : out)
      .sort((a: any, b: any) => {
        const va = Number(a.watchersDelta || 0);
        const vb = Number(b.watchersDelta || 0);
        return order === 'asc' ? va - vb : vb - va;
      })
      .slice(offset, offset + limit);
  }
  return out;
}

/**
 * Отримує деталі конкретного фільму з усіма зв'язаними даними
 */
export async function getMovieDetails(movieId: number) {
  const movieRows = (await db
    .select()
    .from(movies)
    .where(eq(movies.id, movieId))
    .limit(1)) as Movie[];
  const movie = movieRows[0];

  if (!movie) return null;

  // Get watch providers
  const providers = await db
    .select({
      providerId: movieWatchProviders.providerId,
      providerName: movieWatchProviders.providerName,
      logoPath: movieWatchProviders.logoPath,
      rank: movieWatchProviders.rank,
      region: movieWatchProviders.region,
      category: movieWatchProviders.category,
    })
    .from(movieWatchProviders)
    .where(eq(movieWatchProviders.movieId, movieId))
    .orderBy(asc(movieWatchProviders.rank));

  type CastPerson = { id: number; name: string; roles: string[]; profile_path: string | null };
  let cast: CastPerson[] = [];
  try {
    const castRows = (await db
      .select()
      .from(movieCast)
      .where(eq(movieCast.movieId, movieId))
      .orderBy(asc(movieCast.order))
      .limit(20)) as MovieCast[];
    cast = castRows.map(({ personId, name, character, profilePath }) => ({
      id: Number(personId),
      name: String(name || ''),
      roles: character ? [String(character)] : [],
      profile_path: profilePath || null,
    }));
  } catch {}
  if (!Array.isArray(cast) || cast.length === 0) {
    type RawCastItem = {
      id?: number | string;
      name?: string;
      character?: string;
      profile_path?: string | null;
    };
    const rawCastUnknown = (movie as any).cast;
    const rawCast: RawCastItem[] = Array.isArray(rawCastUnknown)
      ? (rawCastUnknown as unknown[]).filter(
          (item): item is RawCastItem => !!item && typeof item === 'object'
        )
      : [];
    cast = rawCast.map(({ id, name, character, profile_path }) => ({
      id: Number(id ?? 0),
      name: String(name ?? ''),
      roles: character ? [String(character)] : [],
      profile_path: profile_path ?? null,
    }));
  }

  // Get videos
  const videos = await db
    .select()
    .from(movieVideos)
    .where(eq(movieVideos.movieId, movieId))
    .limit(10);

  // Get content ratings
  const contentRatings = await db
    .select()
    .from(movieContentRatings)
    .where(eq(movieContentRatings.movieId, movieId));

  // Get watchers sparkline
  const sparkRows = await db
    .select({
      watchers: movieWatchersSnapshots.watchers,
      createdAt: movieWatchersSnapshots.createdAt,
    })
    .from(movieWatchersSnapshots)
    .where(eq(movieWatchersSnapshots.tmdbId, movie.tmdbId))
    .orderBy(desc(movieWatchersSnapshots.createdAt))
    .limit(30);

  const watchersSparkline = sparkRows.map((r) => Number(r.watchers) || 0).reverse();

  return {
    ...movie,
    posterUrl: TMDBClient.getPosterUrl(movie.posterUk || movie.poster),
    backdropUrl: movie.backdrop ? TMDBClient.getBackdropUrl(movie.backdrop) : null,
    providers,
    cast,
    videos,
    contentRatings,
    watchersSparkline,
    primaryRating: movie.ratingTmdb || movie.ratingTrakt || movie.ratingImdb || null,
  };
}
/**
 * Запити до БД для списків фільмів та деталей фільмів.
 *
 * @example
 * import { getMovies } from '@/lib/queries/movies';
 * const movies = await getMovies({ limit: 20, sort: 'trending' });
 */
