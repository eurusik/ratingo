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

/** Maximum year difference allowed when matching shows by name search. */
const MAX_YEAR_TOLERANCE = 1;

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
   * Tries IMDb ID lookup first, then falls back to name search.
   *
   * @param media - Show to enrich
   * @returns Enriched media with merged seasons and nextAirDate
   */
  async enrich(media: NormalizedMedia): Promise<NormalizedMedia> {
    try {
      const episodes = await this.fetchEpisodes(media);
      if (episodes.length === 0) return media;

      const mergedSeasons = this.mergeSeasons(episodes, media.details?.seasons);
      const nextAirDate = this.findNextAirDate(episodes);
      const lastAirDate = this.findLastAirDate(episodes);

      const tvmazeTotalEpisodes = mergedSeasons
        .filter((s) => s.number > 0)
        .reduce((sum, s) => sum + (s.episodeCount ?? 0), 0);

      return {
        ...media,
        details: {
          ...media.details,
          seasons: mergedSeasons,
          totalEpisodes:
            tvmazeTotalEpisodes > (media.details?.totalEpisodes ?? 0)
              ? tvmazeTotalEpisodes
              : media.details?.totalEpisodes,
          nextAirDate: nextAirDate ?? media.details?.nextAirDate,
          // TVMaze overrides TMDB's lastAirDate as TVMaze is "time authority"
          lastAirDate: lastAirDate ?? media.details?.lastAirDate,
        },
      };
    } catch (err) {
      this.logger.warn(
        `TVMaze enrichment failed for ${media.externalIds?.imdbId ?? media.title}: ${(err as Error).message}`,
      );
      return media;
    }
  }

  /**
   * Fetches episodes from TVMaze: first by IMDb ID, then by show name.
   */
  private async fetchEpisodes(media: NormalizedMedia): Promise<TvMazeEpisode[]> {
    const imdbId = media.externalIds?.imdbId;

    if (imdbId) {
      const episodes = await this.tvMazeAdapter.getEpisodesByImdbId(imdbId);
      if (episodes.length > 0) return episodes;
    }

    // Fallback: search by original title, then localized title (deduplicated)
    const namesToTry = [...new Set([media.originalTitle, media.title].filter(Boolean))] as string[];

    for (const name of namesToTry) {
      const episodes = await this.tvMazeAdapter.getEpisodesByShowName(name);
      if (episodes.length > 0) {
        // Validate year match to prevent wrong show association
        const tmdbYear = media.releaseDate?.getFullYear();
        const firstEpisodeYear = episodes[0]?.airDate?.getFullYear();

        if (tmdbYear && firstEpisodeYear) {
          const yearDiff = Math.abs(tmdbYear - firstEpisodeYear);
          if (yearDiff > MAX_YEAR_TOLERANCE) {
            this.logger.warn(
              `TVMaze name match rejected: year mismatch tmdb=${tmdbYear} tvmaze=${firstEpisodeYear} for "${name}" (imdbId=${imdbId ?? 'none'})`,
            );
            continue; // Try next name
          }
        }

        // Accepted — log for monitoring
        this.logger.log(
          `TVMaze name search fallback matched "${name}" (year=${firstEpisodeYear}, imdbId=${imdbId ?? 'none'})`,
        );
        return episodes;
      }
    }

    return [];
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
    const future = episodes.filter((e) => e.airDate && e.airDate > now);

    return future.length > 0
      ? future.reduce((earliest, e) =>
          e.airDate!.getTime() < earliest.airDate!.getTime() ? e : earliest,
        ).airDate!
      : null;
  }

  /** Finds last air date from already-aired episodes. */
  private findLastAirDate(episodes: TvMazeEpisode[]): Date | null {
    const now = new Date();
    const aired = episodes.filter((e) => e.airDate && e.airDate <= now);

    return aired.length > 0
      ? aired.reduce((latest, e) => (e.airDate!.getTime() > latest.airDate!.getTime() ? e : latest))
          .airDate!
      : null;
  }
}
