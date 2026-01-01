import { Injectable, Logger } from '@nestjs/common';

import {
  type NormalizedMedia,
  type NormalizedSeason,
  type NormalizedEpisode,
} from '../../domain/models/normalized-media.model';
import {
  TvMazeAdapter,
  type TvMazeEpisode,
} from '../../infrastructure/adapters/tvmaze/tvmaze.adapter';

/**
 * Enriches show metadata with TVMaze episode data.
 *
 * TVMaze provides more accurate air dates and episode info than TMDB.
 * Merges TVMaze episodes with TMDB season metadata, preserving TMDB
 * posters/overviews while using TVMaze as "time authority".
 */
@Injectable()
export class TvMazeEnrichmentService {
  private readonly logger = new Logger(TvMazeEnrichmentService.name);

  constructor(private readonly tvMazeAdapter: TvMazeAdapter) {}

  /**
   * Enriches show with TVMaze episode data.
   *
   * @param media - Show to enrich (must have imdbId in externalIds)
   * @returns Enriched media with merged seasons and nextAirDate
   */
  async enrich(media: NormalizedMedia): Promise<NormalizedMedia> {
    const imdbId = media.externalIds?.imdbId;
    if (!imdbId) return media;

    try {
      const episodes = await this.tvMazeAdapter.getEpisodesByImdbId(imdbId);
      if (episodes.length === 0) return media;

      const mergedSeasons = this.mergeSeasons(episodes, media.details?.seasons);
      const nextAirDate = this.findNextAirDate(episodes);

      return {
        ...media,
        details: {
          ...media.details,
          seasons: mergedSeasons,
          nextAirDate: nextAirDate ?? media.details?.nextAirDate,
        },
      };
    } catch (err) {
      this.logger.warn(`TVMaze enrichment failed for ${imdbId}: ${err.message}`);
      return media;
    }
  }

  /** Merges TVMaze episodes with TMDB season metadata. */
  private mergeSeasons(
    tvMazeEpisodes: TvMazeEpisode[],
    tmdbSeasons?: NormalizedSeason[],
  ): NormalizedSeason[] {
    // Group episodes by season
    const seasonMap = new Map<number, TvMazeEpisode[]>();
    for (const ep of tvMazeEpisodes) {
      if (!seasonMap.has(ep.seasonNumber)) {
        seasonMap.set(ep.seasonNumber, []);
      }
      seasonMap.get(ep.seasonNumber)!.push(ep);
    }

    // Build TMDB lookup
    const tmdbSeasonMap = new Map<number, NormalizedSeason>();
    if (tmdbSeasons) {
      for (const s of tmdbSeasons) {
        tmdbSeasonMap.set(s.number, s);
      }
    }

    const merged: NormalizedSeason[] = [];

    // Merge TVMaze with TMDB metadata
    for (const [seasonNum, episodes] of seasonMap.entries()) {
      const tmdbSeason = tmdbSeasonMap.get(seasonNum);

      const cleanEpisodes: NormalizedEpisode[] = episodes.map((e) => {
        const { seasonNumber: _seasonNumber, ...rest } = e;
        return rest;
      });

      merged.push({
        number: seasonNum,
        tmdbId: tmdbSeason?.tmdbId,
        name: tmdbSeason?.name,
        overview: tmdbSeason?.overview,
        posterPath: tmdbSeason?.posterPath,
        airDate: tmdbSeason?.airDate,
        episodeCount: cleanEpisodes.length,
        episodes: cleanEpisodes,
      });
    }

    // Add TMDB-only seasons (e.g. Specials)
    if (tmdbSeasons) {
      for (const s of tmdbSeasons) {
        if (!seasonMap.has(s.number)) {
          merged.push(s);
        }
      }
    }

    return merged.sort((a, b) => a.number - b.number);
  }

  /** Finds next air date from future episodes. */
  private findNextAirDate(episodes: TvMazeEpisode[]): Date | null {
    const now = new Date();
    const future = episodes
      .filter((e) => e.airDate && e.airDate > now)
      .sort((a, b) => a.airDate!.getTime() - b.airDate!.getTime());

    return future.length > 0 ? future[0].airDate! : null;
  }
}
