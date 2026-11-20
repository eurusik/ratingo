import { Inject, Injectable, Logger } from '@nestjs/common';

import { ANTICIPATED_SHOWS_MIN_LIST_COUNT, MS_PER_HOUR } from '@/common/constants';
import {
  buildAnticipatedRefreshJobId,
  buildAnticipatedShowJobId,
} from '@/modules/ingestion/domain/job-ids';
import {
  ANTICIPATED_SHOWS_REPOSITORY,
  type IAnticipatedShowsRepository,
} from '@/modules/ingestion/domain/repositories/anticipated-shows.repository.interface';
import {
  ANTICIPATED_REFRESH_RUN_CAP,
  ANTICIPATED_SHOWS_FETCH_LIMIT,
  IngestionJob,
  UPCOMING_REFRESH_MIN_SYNC_AGE_HOURS,
} from '@/modules/ingestion/ingestion.constants';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';
import { TRAKT_LISTS_PORT, type TraktListsPort } from '@/modules/trakt/public';

import { BulkJobService } from '../services/bulk-job.service';

@Injectable()
export class AnticipatedShowsPipeline {
  private readonly logger = new Logger(AnticipatedShowsPipeline.name);

  constructor(
    @Inject(TRAKT_LISTS_PORT)
    private readonly traktLists: TraktListsPort,
    private readonly bulkJobService: BulkJobService,
    @Inject(ANTICIPATED_SHOWS_REPOSITORY)
    private readonly anticipatedShowsRepository: IAnticipatedShowsRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  async sync(): Promise<void> {
    await this.updateSnapshot();
    await this.importMissingShows();
    await this.refreshShows();
  }

  private async updateSnapshot(): Promise<void> {
    const shows = await this.traktLists.getAnticipatedShows(ANTICIPATED_SHOWS_FETCH_LIMIT);

    if (!shows || shows.length === 0) {
      this.logger.warn(
        `Trakt returned no anticipated shows (${shows === null ? 'request failed' : 'empty list'}); keeping the previous snapshot`,
      );
      return;
    }

    await this.anticipatedShowsRepository.replaceSnapshot(shows, this.clock.now());
    this.logger.log(`Stored anticipated shows snapshot: ${shows.length} shows`);
  }

  private async importMissingShows(): Promise<void> {
    const tmdbIds = await this.anticipatedShowsRepository.findMissingTmdbIds(
      ANTICIPATED_SHOWS_MIN_LIST_COUNT,
    );

    if (tmdbIds.length === 0) {
      this.logger.log('All anticipated shows already exist in database');
      return;
    }

    const result = await this.bulkJobService.enqueueBulk(
      tmdbIds.map((tmdbId) => ({
        name: IngestionJob.SYNC_SHOW,
        data: { tmdbId },
        opts: { jobId: buildAnticipatedShowJobId(tmdbId) },
      })),
      this.logger,
      'Anticipated shows import',
    );

    this.logger.log(
      `Anticipated shows import: missing=${tmdbIds.length}, enqueued=${result.enqueued}, deduped=${result.deduped}`,
    );
  }

  private async refreshShows(): Promise<void> {
    const now = this.clock.now().getTime();
    const tmdbIds = await this.anticipatedShowsRepository.findTmdbIdsToRefresh({
      minListCount: ANTICIPATED_SHOWS_MIN_LIST_COUNT,
      syncedBefore: new Date(now - UPCOMING_REFRESH_MIN_SYNC_AGE_HOURS * MS_PER_HOUR),
      limit: ANTICIPATED_REFRESH_RUN_CAP,
    });

    if (tmdbIds.length === 0) {
      this.logger.log('No anticipated shows to refresh');
      return;
    }

    const result = await this.bulkJobService.enqueueBulk(
      tmdbIds.map((tmdbId) => ({
        name: IngestionJob.SYNC_SHOW,
        data: { tmdbId },
        opts: { jobId: buildAnticipatedRefreshJobId(tmdbId) },
      })),
      this.logger,
      'Anticipated shows refresh',
    );

    if (tmdbIds.length >= ANTICIPATED_REFRESH_RUN_CAP) {
      this.logger.warn(
        `Anticipated shows refresh hit run cap (${ANTICIPATED_REFRESH_RUN_CAP}); the rest waits for the next run`,
      );
    }

    this.logger.log(
      `Anticipated shows refresh: found=${tmdbIds.length}, enqueued=${result.enqueued}, deduped=${result.deduped}`,
    );
  }
}
