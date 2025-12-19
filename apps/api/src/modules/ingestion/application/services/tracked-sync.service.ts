import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { SyncMediaService } from './sync-media.service';
import {
  ShowSyncDiff,
  createEmptyDiff,
  formatEpisodeKey,
  formatSeasonKey,
  formatDateToIso,
} from '../../domain/interfaces/show-sync-diff.interface';
import { MediaType } from '../../../../common/enums/media-type.enum';

/**
 * Snapshot of show state before/after sync for diff calculation.
 */
interface ShowSnapshot {
  mediaItemId: string;
  status: string | null;
  totalSeasons: number | null;
  nextAirDate: Date | null;
  lastEpisodeKey: string | null; // 'S2E5' format
}

/**
 * Service for syncing tracked shows with diff detection.
 * Used by the tracked sync job to detect changes and trigger notifications.
 */
@Injectable()
export class TrackedSyncService {
  private readonly logger = new Logger(TrackedSyncService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly syncMediaService: SyncMediaService,
  ) {}

  /**
   * Syncs a show and returns what changed.
   *
   * @param tmdbId - TMDB ID of the show
   * @returns ShowSyncDiff with detected changes
   */
  async syncShowWithDiff(tmdbId: number): Promise<ShowSyncDiff> {
    // 1. Get current state before sync
    const beforeSnapshot = await this.getShowSnapshot(tmdbId);

    if (!beforeSnapshot) {
      // Show doesn't exist yet, sync it and return empty diff
      await this.syncMediaService.syncShow(tmdbId);
      const afterSnapshot = await this.getShowSnapshot(tmdbId);

      if (!afterSnapshot) {
        this.logger.warn(`Show ${tmdbId} not found after sync`);
        return createEmptyDiff(tmdbId, '');
      }

      // New show - no diff to report
      return createEmptyDiff(tmdbId, afterSnapshot.mediaItemId);
    }

    // 2. Sync the show
    await this.syncMediaService.syncShow(tmdbId);

    // 3. Get new state after sync
    const afterSnapshot = await this.getShowSnapshot(tmdbId);

    if (!afterSnapshot) {
      this.logger.warn(`Show ${tmdbId} disappeared after sync`);
      return createEmptyDiff(tmdbId, beforeSnapshot.mediaItemId);
    }

    // 4. Calculate diff
    return this.calculateDiff(tmdbId, beforeSnapshot, afterSnapshot);
  }

  /**
   * Gets current show state snapshot for diff calculation.
   */
  private async getShowSnapshot(tmdbId: number): Promise<ShowSnapshot | null> {
    try {
      // Get show basic info
      const showResult = await this.db
        .select({
          mediaItemId: schema.mediaItems.id,
          status: schema.shows.status,
          totalSeasons: schema.shows.totalSeasons,
          nextAirDate: schema.shows.nextAirDate,
        })
        .from(schema.mediaItems)
        .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
        .where(
          and(eq(schema.mediaItems.tmdbId, tmdbId), eq(schema.mediaItems.type, MediaType.SHOW)),
        )
        .limit(1);

      if (showResult.length === 0) {
        return null;
      }

      const show = showResult[0];

      // Get last episode (highest season + episode number)
      const lastEpisodeResult = await this.db
        .select({
          seasonNumber: schema.seasons.number,
          episodeNumber: schema.episodes.number,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
        .innerJoin(schema.shows, eq(schema.shows.id, schema.seasons.showId))
        .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.shows.mediaItemId))
        .where(eq(schema.mediaItems.tmdbId, tmdbId))
        .orderBy(schema.seasons.number, schema.episodes.number)
        .limit(1);

      let lastEpisodeKey: string | null = null;
      if (lastEpisodeResult.length > 0) {
        const ep = lastEpisodeResult[0];
        lastEpisodeKey = formatEpisodeKey(ep.seasonNumber, ep.episodeNumber);
      }

      return {
        mediaItemId: show.mediaItemId,
        status: show.status,
        totalSeasons: show.totalSeasons,
        nextAirDate: show.nextAirDate,
        lastEpisodeKey,
      };
    } catch (error) {
      this.logger.error(`Failed to get show snapshot for ${tmdbId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculates diff between before and after snapshots.
   */
  private calculateDiff(tmdbId: number, before: ShowSnapshot, after: ShowSnapshot): ShowSyncDiff {
    const diff: ShowSyncDiff = {
      tmdbId,
      mediaItemId: after.mediaItemId,
      hasChanges: false,
      changes: {},
    };

    // Check for new season
    if (
      after.totalSeasons !== null &&
      before.totalSeasons !== null &&
      after.totalSeasons > before.totalSeasons
    ) {
      diff.hasChanges = true;
      diff.changes.newSeason = {
        seasonNumber: after.totalSeasons,
        airDate: formatDateToIso(after.nextAirDate) ?? new Date().toISOString().split('T')[0],
        key: formatSeasonKey(after.totalSeasons),
      };
      this.logger.log(`Detected new season ${after.totalSeasons} for show ${tmdbId}`);
    }

    // Check for new episode
    if (
      after.lastEpisodeKey !== null &&
      before.lastEpisodeKey !== null &&
      after.lastEpisodeKey !== before.lastEpisodeKey
    ) {
      // Parse episode key to get season/episode numbers
      const match = after.lastEpisodeKey.match(/S(\d+)E(\d+)/);
      if (match) {
        diff.hasChanges = true;
        diff.changes.newEpisode = {
          season: parseInt(match[1], 10),
          episode: parseInt(match[2], 10),
          airDate: formatDateToIso(after.nextAirDate) ?? new Date().toISOString().split('T')[0],
          key: after.lastEpisodeKey,
        };
        this.logger.log(`Detected new episode ${after.lastEpisodeKey} for show ${tmdbId}`);
      }
    }

    // Check for status change
    if (before.status !== after.status && after.status !== null) {
      diff.hasChanges = true;
      diff.changes.statusChanged = {
        from: before.status,
        to: after.status,
      };
      this.logger.log(
        `Detected status change for show ${tmdbId}: ${before.status} -> ${after.status}`,
      );
    }

    // Check for next air date change (informational only)
    const beforeDate = formatDateToIso(before.nextAirDate);
    const afterDate = formatDateToIso(after.nextAirDate);
    if (beforeDate !== afterDate) {
      diff.changes.nextAirDateChanged = {
        from: beforeDate,
        to: afterDate,
      };
      // Note: This doesn't set hasChanges as it's informational only
    }

    return diff;
  }
}
