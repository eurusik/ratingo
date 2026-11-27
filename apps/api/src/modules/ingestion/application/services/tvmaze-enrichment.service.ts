import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  type NormalizedMedia,
  type NormalizedSeason,
  type NormalizedEpisode,
} from '@/modules/ingestion/domain/models/normalized-media.model';
import { isAnnouncedNextSeason } from '@/modules/ingestion/domain/next-season-announcement';
import {
  EPISODE_SCHEDULE_PORT,
  type EpisodeSchedulePort,
  type ScheduledEpisode,
} from '@/modules/ingestion/domain/ports/episode-schedule.port';
import { seasonEpisodeCount } from '@/modules/ingestion/domain/season-episode-count';
import { uniqueScheduledEpisodes } from '@/modules/ingestion/domain/unique-scheduled-episodes';

/** Maximum year difference allowed when matching shows by name search. */
const MAX_YEAR_TOLERANCE = 1;

const SEASON_SKIP_REASON = {
  NOT_IN_TMDB: 'not_in_tmdb',
  YEAR_MISMATCH: 'year_mismatch',
} as const;

type SeasonSkipReason = (typeof SEASON_SKIP_REASON)[keyof typeof SEASON_SKIP_REASON];

type SkippedSeasons = Record<SeasonSkipReason, number[]>;

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

  constructor(
    @Inject(EPISODE_SCHEDULE_PORT)
    private readonly episodeSchedule: EpisodeSchedulePort,
  ) {}

  /**
   * Enriches show with TVMaze episode data.
   * Tries IMDb ID lookup first, then falls back to name search.
   *
   * @param media - Show to enrich
   * @returns Enriched media with merged seasons and nextAirDate
   */
  async enrich(media: NormalizedMedia): Promise<NormalizedMedia> {
    const { episodes, duplicates } = uniqueScheduledEpisodes(await this.fetchEpisodes(media));
    if (episodes.length === 0) return media;
    if (duplicates.length > 0) {
      this.logger.warn({
        message: 'TVMaze returned duplicate episodes',
        tmdbId: media.externalIds.tmdbId,
        duplicates,
      });
    }

    const {
      seasons: mergedSeasons,
      acceptedEpisodes,
      skipped,
    } = this.mergeSeasons(
      episodes,
      media.details?.seasons,
      media.details?.status ?? media.status ?? null,
    );
    this.logSkippedSeasons(media, skipped);
    if (acceptedEpisodes.length === 0) return media;

    const nextAirDate = this.findNextAirDate(acceptedEpisodes);
    const lastAirDate = this.findLastAirDate(acceptedEpisodes);

    const tvmazeTotalEpisodes = mergedSeasons
      .filter((s) => s.number > 0)
      .reduce((sum, s) => sum + (s.episodeCount ?? 0), 0);

    return {
      ...media,
      details: {
        ...media.details,
        seasons: mergedSeasons,
        totalEpisodes: tvmazeTotalEpisodes > 0 ? tvmazeTotalEpisodes : media.details?.totalEpisodes,
        // Episodes were fetched successfully, so a missing future episode means "no next
        // episode": write explicit null (pickDefined keeps null, drops undefined) so a stale
        // past nextAirDate gets cleared. A TMDB value is kept only while still in the future.
        nextAirDate: nextAirDate ?? this.futureOrNull(media.details?.nextAirDate),
        // TVMaze overrides TMDB's lastAirDate as TVMaze is "time authority"
        lastAirDate: lastAirDate ?? media.details?.lastAirDate,
      },
    };
  }

  /**
   * Fetches episodes from TVMaze: first by IMDb ID, then by show name.
   */
  private async fetchEpisodes(media: NormalizedMedia): Promise<ScheduledEpisode[]> {
    const { imdbId } = media.externalIds;

    if (imdbId) {
      const episodes = await this.episodeSchedule.getEpisodesByImdbId(imdbId);
      if (episodes.length > 0) return episodes;
    }

    // Fallback: search by original title, then localized title (deduplicated)
    const namesToTry = [...new Set([media.originalTitle, media.title].filter(Boolean))] as string[];

    for (const name of namesToTry) {
      const episodes = await this.episodeSchedule.getEpisodesByShowName(name);
      if (episodes.length === 0) continue;
      if (!this.isNameMatchVerified(name, media, episodes)) continue;

      // Accepted — log for monitoring
      this.logger.log(
        `TVMaze name search fallback matched "${name}" (year=${this.earliestAirDate(episodes)?.getFullYear()}, imdbId=${imdbId ?? 'none'})`,
      );
      return episodes;
    }

    return [];
  }

  private isNameMatchVerified(
    name: string,
    media: NormalizedMedia,
    episodes: ScheduledEpisode[],
  ): boolean {
    const tmdbYear = media.releaseDate?.getFullYear();
    const tvmazeYear = this.earliestAirDate(episodes)?.getFullYear();

    const rejectionReason = this.nameMatchRejectionReason(tmdbYear, tvmazeYear);
    if (!rejectionReason) return true;

    this.logger.log(
      `TVMaze name match rejected: ${rejectionReason} tmdb=${tmdbYear ?? 'none'} tvmaze=${tvmazeYear ?? 'none'} for "${name}" (imdbId=${media.externalIds.imdbId ?? 'none'})`,
    );
    return false;
  }

  private nameMatchRejectionReason(tmdbYear?: number, tvmazeYear?: number): string | null {
    if (!tmdbYear || !tvmazeYear) return 'cannot verify year';
    if (this.isYearMismatch(tmdbYear, tvmazeYear)) return 'year mismatch';
    return null;
  }

  /** Merges TVMaze episodes with TMDB season metadata. */
  private mergeSeasons(
    scheduledEpisodes: ScheduledEpisode[],
    tmdbSeasons: NormalizedSeason[] | undefined,
    showStatus: string | null,
  ): {
    seasons: NormalizedSeason[];
    acceptedEpisodes: NormalizedEpisode[];
    skipped: SkippedSeasons;
  } {
    // Group episodes by season
    const seasonMap = new Map<number, ScheduledEpisode[]>();
    for (const ep of scheduledEpisodes) {
      if (!seasonMap.has(ep.seasonNumber)) {
        seasonMap.set(ep.seasonNumber, []);
      }
      seasonMap.get(ep.seasonNumber)!.push(ep);
    }

    // Build TMDB lookup
    const tmdbSeasonMap = new Map<number, NormalizedSeason>();
    for (const s of tmdbSeasons ?? []) {
      tmdbSeasonMap.set(s.number, s);
    }

    const merged: NormalizedSeason[] = [];
    const usedSeasonNumbers = new Set<number>();
    const acceptedEpisodes: NormalizedEpisode[] = [];
    const skipped: SkippedSeasons = {
      [SEASON_SKIP_REASON.NOT_IN_TMDB]: [],
      [SEASON_SKIP_REASON.YEAR_MISMATCH]: [],
    };

    const latestSeasonNumber = Math.max(...seasonMap.keys());

    // Merge TVMaze with TMDB metadata
    for (const [seasonNum, episodes] of seasonMap.entries()) {
      const skipReason = this.seasonSkipReason(seasonNum, episodes, tmdbSeasonMap, showStatus);
      if (skipReason) {
        skipped[skipReason].push(seasonNum);
        continue;
      }
      const tmdbSeason = tmdbSeasonMap.get(seasonNum);

      const cleanEpisodes: NormalizedEpisode[] = episodes.map((e) => {
        const { seasonNumber: _seasonNumber, ...rest } = e;
        return rest;
      });

      usedSeasonNumbers.add(seasonNum);
      acceptedEpisodes.push(...cleanEpisodes);
      merged.push({
        number: seasonNum,
        tmdbId: tmdbSeason?.tmdbId,
        name: tmdbSeason?.name,
        overview: tmdbSeason?.overview,
        posterPath: tmdbSeason?.posterPath,
        airDate: tmdbSeason?.airDate,
        episodeCount: seasonEpisodeCount({
          listedEpisodes: cleanEpisodes.length,
          announcedEpisodes: tmdbSeason?.episodeCount,
          showStatus,
          isLatestSeason: seasonNum === latestSeasonNumber,
        }),
        episodes: cleanEpisodes,
      });
    }

    // Add TMDB-only seasons (e.g. Specials)
    for (const s of tmdbSeasons ?? []) {
      if (!usedSeasonNumbers.has(s.number)) {
        merged.push(s);
      }
    }

    return { seasons: merged.sort((a, b) => a.number - b.number), acceptedEpisodes, skipped };
  }

  private seasonSkipReason(
    seasonNum: number,
    episodes: ScheduledEpisode[],
    tmdbSeasonMap: Map<number, NormalizedSeason>,
    showStatus: string | null,
  ): SeasonSkipReason | null {
    if (tmdbSeasonMap.size === 0) return null;

    const tmdbSeason = tmdbSeasonMap.get(seasonNum);
    if (!tmdbSeason) {
      const announced = isAnnouncedNextSeason({
        seasonNumber: seasonNum,
        lastKnownSeasonNumber: Math.max(...tmdbSeasonMap.keys()),
        showStatus,
        hasDatedEpisode: episodes.some((e) => e.airDate),
      });
      return announced ? null : SEASON_SKIP_REASON.NOT_IN_TMDB;
    }

    const tmdbYear = tmdbSeason.airDate?.getFullYear();
    const tvmazeYear = this.earliestAirDate(episodes)?.getFullYear();
    if (tmdbYear && tvmazeYear && this.isYearMismatch(tmdbYear, tvmazeYear)) {
      return SEASON_SKIP_REASON.YEAR_MISMATCH;
    }

    return null;
  }

  private logSkippedSeasons(media: NormalizedMedia, skipped: SkippedSeasons): void {
    const notInTmdb = skipped[SEASON_SKIP_REASON.NOT_IN_TMDB];
    const yearMismatch = skipped[SEASON_SKIP_REASON.YEAR_MISMATCH];
    const skippedCount = notInTmdb.length + yearMismatch.length;
    if (skippedCount === 0) return;

    this.logger.log({
      message: `TVMaze seasons skipped for ${media.externalIds.imdbId ?? media.title}`,
      skippedSeasons: skippedCount,
      notInTmdb: notInTmdb.length,
      yearMismatch: yearMismatch.length,
      skippedSeasonNumbers: [...notInTmdb, ...yearMismatch].join(','),
    });
  }

  private isYearMismatch(tmdbYear: number, tvmazeYear: number): boolean {
    return Math.abs(tmdbYear - tvmazeYear) > MAX_YEAR_TOLERANCE;
  }

  private earliestAirDate(episodes: NormalizedEpisode[]): Date | null {
    return episodes.reduce<Date | null>(
      (earliest, e) => (e.airDate && (!earliest || e.airDate < earliest) ? e.airDate : earliest),
      null,
    );
  }

  /** Returns the date only if it is still in the future, otherwise null. */
  private futureOrNull(date?: Date | null): Date | null {
    return date && date > new Date() ? date : null;
  }

  /** Finds next air date from future episodes. */
  private findNextAirDate(episodes: NormalizedEpisode[]): Date | null {
    const now = new Date();
    const future = episodes.filter((e) => e.airDate && e.airDate > now);

    return future.length > 0
      ? future.reduce((earliest, e) =>
          e.airDate!.getTime() < earliest.airDate!.getTime() ? e : earliest,
        ).airDate!
      : null;
  }

  /** Finds last air date from already-aired episodes. */
  private findLastAirDate(episodes: NormalizedEpisode[]): Date | null {
    const now = new Date();
    const aired = episodes.filter((e) => e.airDate && e.airDate <= now);

    return aired.length > 0
      ? aired.reduce((latest, e) => (e.airDate!.getTime() > latest.airDate!.getTime() ? e : latest))
          .airDate!
      : null;
  }
}
