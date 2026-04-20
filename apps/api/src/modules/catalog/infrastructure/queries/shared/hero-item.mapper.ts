import { and, desc, eq, inArray, lte } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MS_PER_DAY } from '../../../../../common/constants';
import { MediaType } from '../../../../../common/enums/media-type.enum';
import { ImageMapper } from '../../../../../common/mappers/image.mapper';
import {
  type HeroMediaItem,
  type HeroShowProgress,
} from '../../../../../common/types/hero-media.types';
import * as schema from '../../../../../database/schema';
import { HERO_THRESHOLDS } from '../../../domain/constants/catalog.constants';

/**
 * Raw row type from hero/watching-now queries.
 */
export interface HeroQueryRow {
  id: string;
  type: MediaType;
  slug: string;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: Date | null;
  videos: unknown;
  ratingoScore: number | null;
  qualityScore: number | null;
  popularityScore: number | null;
  watchersCount: number | null;
  totalWatchers: number | null;
  rating: number;
  voteCount: number;
  ratingImdb: number | null;
  voteCountImdb: number | null;
  ratingTrakt: number | null;
  voteCountTrakt: number | null;
  ratingMetacritic: number | null;
  ratingRottenTomatoes: number | null;
  ratingRottenTomatoesAudience: number | null;
}

/**
 * Extracts YouTube trailer key from videos array.
 */
export function extractPrimaryTrailerKey(videos: unknown): string | null {
  if (!Array.isArray(videos) || videos.length === 0) return null;
  const first = videos[0];
  if (!first || typeof first !== 'object') return null;
  const { key } = first as Record<string, unknown>;
  return typeof key === 'string' ? key : null;
}

/**
 * Maps raw database rows to HeroMediaItem DTOs.
 */
export function mapHeroResults(
  results: HeroQueryRow[],
  showProgressMap: Map<string, HeroShowProgress>,
  now: Date,
): HeroMediaItem[] {
  const ninetyDaysAgo = new Date(now.getTime() - HERO_THRESHOLDS.NEW_RELEASE_DAYS * MS_PER_DAY);
  const fiveYearsAgo = new Date(
    now.getFullYear() - HERO_THRESHOLDS.CLASSIC_YEARS,
    now.getMonth(),
    now.getDate(),
  );

  return results.map((item) => {
    const releaseDate = item.releaseDate ? new Date(item.releaseDate) : null;
    const primaryTrailerKey = extractPrimaryTrailerKey(item.videos);

    const baseItem = {
      id: item.id,
      mediaItemId: item.id,
      type: item.type,
      slug: item.slug,
      title: item.title,
      originalTitle: item.originalTitle,
      overview: item.overview,
      primaryTrailerKey,
      poster: ImageMapper.toPoster(item.posterPath),
      backdrop: ImageMapper.toBackdrop(item.backdropPath),
      releaseDate: item.releaseDate,
      isNew: releaseDate ? releaseDate >= ninetyDaysAgo : false,
      isClassic: releaseDate ? releaseDate <= fiveYearsAgo : false,
      stats: {
        ratingoScore: item.ratingoScore,
        qualityScore: item.qualityScore,
        popularityScore: item.popularityScore,
        liveWatchers: item.watchersCount,
        totalWatchers: item.totalWatchers,
      },
      externalRatings: {
        tmdb: { rating: item.rating, voteCount: item.voteCount },
        imdb: item.ratingImdb ? { rating: item.ratingImdb, voteCount: item.voteCountImdb } : null,
        trakt: item.ratingTrakt
          ? { rating: item.ratingTrakt, voteCount: item.voteCountTrakt }
          : null,
        metacritic: item.ratingMetacritic ? { rating: item.ratingMetacritic } : null,
        rottenTomatoes: item.ratingRottenTomatoes ? { rating: item.ratingRottenTomatoes } : null,
        rottenTomatoesAudience: item.ratingRottenTomatoesAudience
          ? { rating: item.ratingRottenTomatoesAudience }
          : null,
      },
    };

    if (item.type === MediaType.SHOW) {
      const progress = showProgressMap.get(item.id);
      if (progress) {
        return { ...baseItem, showProgress: progress };
      }
    }

    return baseItem;
  });
}

/**
 * Fetches show progress (season/episode) for TV shows.
 * Shared between HeroMediaQuery and WatchingNowMediaQuery.
 */
export async function fetchShowProgress(
  db: PostgresJsDatabase<typeof schema>,
  results: Array<{ id: string; type: MediaType }>,
  now: Date,
): Promise<Map<string, HeroShowProgress>> {
  const showIds = results.filter((r) => r.type === MediaType.SHOW).map((r) => r.id);
  const progressMap = new Map<string, HeroShowProgress>();

  if (showIds.length === 0) {
    return progressMap;
  }

  const showsData = await db
    .select({
      mediaItemId: schema.shows.mediaItemId,
      showId: schema.shows.id,
      lastAirDate: schema.shows.lastAirDate,
      nextAirDate: schema.shows.nextAirDate,
    })
    .from(schema.shows)
    .where(inArray(schema.shows.mediaItemId, showIds));

  const internalShowIds = showsData.map((s) => s.showId);

  if (internalShowIds.length === 0) {
    return progressMap;
  }

  const episodes = await db
    .select({
      showId: schema.episodes.showId,
      seasonNum: schema.seasons.number,
      episodeNumber: schema.episodes.number,
      airDate: schema.episodes.airDate,
    })
    .from(schema.episodes)
    .innerJoin(schema.seasons, eq(schema.episodes.seasonId, schema.seasons.id))
    .where(and(inArray(schema.episodes.showId, internalShowIds), lte(schema.episodes.airDate, now)))
    .orderBy(desc(schema.episodes.airDate));

  // Group by showId and pick first (latest)
  type EpisodeRow = (typeof episodes)[number];
  const latestEpisodeMap = new Map<string, EpisodeRow>();
  for (const ep of episodes) {
    if (!latestEpisodeMap.has(ep.showId)) {
      latestEpisodeMap.set(ep.showId, ep);
    }
  }

  // Build the result map
  for (const show of showsData) {
    const ep = latestEpisodeMap.get(show.showId);
    if (ep) {
      progressMap.set(show.mediaItemId, {
        season: ep.seasonNum,
        episode: ep.episodeNumber,
        label: `S${ep.seasonNum}E${ep.episodeNumber}`,
        lastAirDate: show.lastAirDate,
        nextAirDate: show.nextAirDate,
      });
    } else if (show.lastAirDate) {
      progressMap.set(show.mediaItemId, {
        season: null,
        episode: null,
        label: null,
        lastAirDate: show.lastAirDate,
        nextAirDate: show.nextAirDate,
      });
    }
  }

  return progressMap;
}
