import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, desc, isNotNull, lte } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type ShowSyncDiff,
  createEmptyDiff,
  formatEpisodeKey,
  formatSeasonKey,
  formatDateToIso,
} from '../../domain/interfaces/show-sync-diff.interface';

import { SyncMediaService } from './sync-media.service';

interface ShowSnapshot {
  mediaItemId: string;
  status: string | null;
  totalSeasons: number | null;
  nextAirDate: Date | null;
  lastEpisodeKey: string | null; // 'S2E5' format — last AIRED episode
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
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
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

  private async getShowStatus(
    tmdbId: number,
  ): Promise<{ mediaItemId: string; status: string | null } | null> {
    try {
      const result = await this.db
        .select({
          mediaItemId: schema.mediaItems.id,
          status: schema.shows.status,
        })
        .from(schema.mediaItems)
        .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
        .where(
          and(eq(schema.mediaItems.tmdbId, tmdbId), eq(schema.mediaItems.type, MediaType.SHOW)),
        )
        .limit(1);

      return result.length > 0 ? result[0] : null;
    } catch {
      return null;
    }
  }

  private async getShowSnapshot(tmdbId: number): Promise<ShowSnapshot | null> {
    try {
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

      const lastEpisodeResult = await this.db
        .select({
          seasonNumber: schema.seasons.number,
          episodeNumber: schema.episodes.number,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
        .innerJoin(schema.shows, eq(schema.shows.id, schema.seasons.showId))
        .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.shows.mediaItemId))
        .where(
          and(
            eq(schema.mediaItems.tmdbId, tmdbId),
            isNotNull(schema.episodes.airDate),
            lte(schema.episodes.airDate, new Date()),
          ),
        )
        .orderBy(desc(schema.seasons.number), desc(schema.episodes.number))
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
      const match = snapshot.lastEpisodeKey.match(/S(\d+)E(\d+)/);
      if (match) {
        const seasonNumber = parseInt(match[1], 10);
        const episodeNumber = parseInt(match[2], 10);

        diff.hasChanges = true;
        diff.changes.newEpisode = {
          season: seasonNumber,
          episode: episodeNumber,
          airDate: formatDateToIso(snapshot.nextAirDate) ?? new Date().toISOString().split('T')[0],
          key: snapshot.lastEpisodeKey,
        };

        diff.changes.newSeason = {
          seasonNumber,
          airDate: formatDateToIso(snapshot.nextAirDate) ?? new Date().toISOString().split('T')[0],
          key: formatSeasonKey(seasonNumber),
        };
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

  private parseSeasonFromEpisodeKey(key: string | null): number | null {
    if (!key) return null;
    const match = key.match(/^S(\d+)E\d+$/i);
    return match ? parseInt(match[1], 10) : null;
  }
}
