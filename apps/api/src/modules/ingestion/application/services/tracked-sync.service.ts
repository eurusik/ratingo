import { Inject, Injectable, Logger } from '@nestjs/common';

import { errorMessage } from '@/common/utils/error.utils';
import {
  type ShowSyncDiff,
  createEmptyDiff,
  formatEpisodeKey,
  formatSeasonKey,
  formatDateToIso,
} from '@/modules/ingestion/domain/interfaces/show-sync-diff.interface';
import {
  TRACKED_SHOW_REPOSITORY,
  type ITrackedShowRepository,
  type TrackedShow,
} from '@/modules/ingestion/domain/repositories/tracked-show.repository.interface';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';

import { SyncMediaService } from './sync-media.service';

interface ShowSnapshot {
  mediaItemId: string;
  status: string | null;
  totalSeasons: number | null;
  nextAirDate: Date | null;
  lastEpisodeKey: string | null; // 'S2E5' format — last AIRED episode
  lastEpisodeAirDate: Date | null;
}

/**
 * Service for syncing tracked shows with change detection.
 *
 * Reports the current aired state as the diff. The downstream
 * SubscriptionTriggerService handles dedup via atomic UPDATE conditions
 * (lastNotifiedEpisodeKey, lastNotifiedSeasonNumber).
 */
@Injectable()
export class TrackedSyncService {
  private readonly logger = new Logger(TrackedSyncService.name);

  constructor(
    @Inject(TRACKED_SHOW_REPOSITORY)
    private readonly trackedShowRepository: ITrackedShowRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
    private readonly syncMediaService: SyncMediaService,
  ) {}

  /**
   * Reports the current aired state as a diff instead of comparing
   * before/after snapshots (which always returns 0 when trending sync
   * already updated the DB). Dedup markers handle the rest.
   */
  async syncShowWithDiff(tmdbId: number): Promise<ShowSyncDiff> {
    const beforeStatus = await this.getShowStatus(tmdbId);
    await this.syncMediaService.syncShow(tmdbId);
    const snapshot = await this.getShowSnapshot(tmdbId);

    if (!snapshot) {
      if (!beforeStatus) {
        this.logger.warn(`Show ${tmdbId} not found after sync`);
      }
      return createEmptyDiff(tmdbId, beforeStatus?.mediaItemId ?? '');
    }

    return this.buildCurrentStateDiff(tmdbId, snapshot, beforeStatus?.status ?? null);
  }

  private async getShowStatus(tmdbId: number): Promise<TrackedShow | null> {
    try {
      return await this.trackedShowRepository.findByTmdbId(tmdbId);
    } catch (error) {
      this.logger.warn(`Failed to get show status for tmdbId=${tmdbId}: ${errorMessage(error)}`);
      return null;
    }
  }

  private async getShowSnapshot(tmdbId: number): Promise<ShowSnapshot | null> {
    try {
      const show = await this.trackedShowRepository.findByTmdbId(tmdbId);

      if (!show) {
        return null;
      }

      const lastEpisode = await this.trackedShowRepository.findLatestEpisodeAiredBy(
        tmdbId,
        this.clock.now(),
      );

      const lastEpisodeKey = lastEpisode
        ? formatEpisodeKey(lastEpisode.seasonNumber, lastEpisode.episodeNumber)
        : null;
      const lastEpisodeAirDate = lastEpisode?.airDate ?? null;

      return {
        mediaItemId: show.mediaItemId,
        status: show.status,
        totalSeasons: show.totalSeasons,
        nextAirDate: show.nextAirDate,
        lastEpisodeKey,
        lastEpisodeAirDate,
      };
    } catch (error) {
      this.logger.error(`Failed to get show snapshot for ${tmdbId}: ${errorMessage(error)}`);
      return null;
    }
  }

  private buildCurrentStateDiff(
    tmdbId: number,
    snapshot: ShowSnapshot,
    previousStatus: string | null,
  ): ShowSyncDiff {
    const diff: ShowSyncDiff = {
      tmdbId,
      mediaItemId: snapshot.mediaItemId,
      hasChanges: false,
      changes: {},
    };

    if (snapshot.lastEpisodeKey) {
      const match = snapshot.lastEpisodeKey.match(/^S(\d+)E(\d+)$/i);
      if (match) {
        const seasonNumber = parseInt(match[1], 10);
        const episodeNumber = parseInt(match[2], 10);

        const airDate =
          formatDateToIso(snapshot.lastEpisodeAirDate) ?? formatDateToIso(snapshot.nextAirDate);

        if (airDate) {
          diff.hasChanges = true;
          diff.changes.newEpisode = {
            season: seasonNumber,
            episode: episodeNumber,
            airDate,
            key: snapshot.lastEpisodeKey,
          };

          diff.changes.newSeason = {
            seasonNumber,
            airDate,
            key: formatSeasonKey(seasonNumber),
          };
        }
      }
    }

    // Status change: still use before/after comparison (sync may update status from TMDB)
    if (previousStatus !== snapshot.status && snapshot.status !== null) {
      diff.hasChanges = true;
      diff.changes.statusChanged = {
        from: previousStatus,
        to: snapshot.status,
      };
      this.logger.log(
        `Detected status change for show ${tmdbId}: ${previousStatus} -> ${snapshot.status}`,
      );
    }

    return diff;
  }
}
