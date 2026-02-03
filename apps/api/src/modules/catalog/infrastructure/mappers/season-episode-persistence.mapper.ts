import { type InferInsertModel } from 'drizzle-orm';

import type * as schema from '../../../../database/schema';
import type { NormalizedSeason, NormalizedEpisode } from '../../../ingestion/public';
import { pickDefined } from '../utils/persistence.utils';

/**
 * Maps NormalizedSeason and NormalizedEpisode to Drizzle insert/update payloads.
 */
export class SeasonEpisodePersistenceMapper {
  static toSeasonInsert(
    showId: string,
    season: NormalizedSeason,
  ): InferInsertModel<typeof schema.seasons> {
    return {
      showId: showId,
      tmdbId: season.tmdbId,
      number: season.number,
      name: season.name,
      overview: season.overview,
      posterPath: season.posterPath,
      airDate: season.airDate,
      episodeCount: season.episodeCount,
    };
  }

  static toSeasonUpdate(
    season: NormalizedSeason,
  ): Partial<InferInsertModel<typeof schema.seasons>> {
    const update = pickDefined({
      tmdbId: season.tmdbId,
      name: season.name,
      overview: season.overview,
      posterPath: season.posterPath,
      airDate: season.airDate,
      episodeCount: season.episodeCount,
    });
    // Ensure at least one field for upsert
    if (Object.keys(update).length === 0) {
      return { episodeCount: null };
    }
    return update;
  }

  static toEpisodeInsert(
    seasonId: string,
    showId: string,
    episode: NormalizedEpisode,
  ): InferInsertModel<typeof schema.episodes> {
    return {
      seasonId: seasonId,
      showId: showId,
      tmdbId: episode.tmdbId,
      number: episode.number,
      title: episode.title,
      overview: episode.overview,
      airDate: episode.airDate,
      runtime: episode.runtime,
      stillPath: episode.stillPath,
      voteAverage: episode.rating,
    };
  }

  static toEpisodeUpdate(
    episode: NormalizedEpisode,
  ): Partial<InferInsertModel<typeof schema.episodes>> {
    const update = pickDefined({
      tmdbId: episode.tmdbId,
      title: episode.title,
      overview: episode.overview,
      airDate: episode.airDate,
      runtime: episode.runtime,
      stillPath: episode.stillPath,
      voteAverage: episode.rating,
    });
    // Ensure at least one field for upsert
    if (Object.keys(update).length === 0) {
      return { runtime: null };
    }
    return update;
  }
}
