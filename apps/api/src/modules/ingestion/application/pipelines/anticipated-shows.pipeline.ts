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
  ANTICIPATED_IMPORT_RUN_CAP,
  ANTICIPATED_REFRESH_MIN_SYNC_AGE_HOURS,
  ANTICIPATED_REFRESH_RUN_CAP,
  ANTICIPATED_SHOWS_FETCH_LIMIT,
  IngestionJob,
} from '@/modules/ingestion/ingestion.constants';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';
import { TRAKT_LISTS_PORT, type TraktListsPort } from '@/modules/trakt/public';

import { BulkJobService } from '../services/bulk-job.service';

interface ShowSyncBatch {
  label: string;
  tmdbIds: number[];
  runCap: number;
  buildJobId: (tmdbId: number) => string;
}

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
    const tmdbIds = await this.anticipatedShowsRepository.findMissingTmdbIds({
      minListCount: ANTICIPATED_SHOWS_MIN_LIST_COUNT,
      limit: ANTICIPATED_IMPORT_RUN_CAP,
    });

    await this.enqueueShowSyncs({
      label: 'Anticipated shows import',
      tmdbIds,
      runCap: ANTICIPATED_IMPORT_RUN_CAP,
      buildJobId: buildAnticipatedShowJobId,
    });
  }

  private async refreshShows(): Promise<void> {
    const now = this.clock.now().getTime();
    const tmdbIds = await this.anticipatedShowsRepository.findTmdbIdsToRefresh({
      minListCount: ANTICIPATED_SHOWS_MIN_LIST_COUNT,
      syncedBefore: new Date(now - ANTICIPATED_REFRESH_MIN_SYNC_AGE_HOURS * MS_PER_HOUR),
      limit: ANTICIPATED_REFRESH_RUN_CAP,
    });

    await this.enqueueShowSyncs({
      label: 'Anticipated shows refresh',
      tmdbIds,
      runCap: ANTICIPATED_REFRESH_RUN_CAP,
      buildJobId: buildAnticipatedRefreshJobId,
    });
  }

  private async enqueueShowSyncs({ label, tmdbIds, runCap, buildJobId }: ShowSyncBatch) {
    if (tmdbIds.length === 0) {
      this.logger.log(`${label}: nothing to sync`);
      return;
    }

    const result = await this.bulkJobService.enqueueBulk(
      tmdbIds.map((tmdbId) => ({
        name: IngestionJob.SYNC_SHOW,
        data: { tmdbId },
        opts: { jobId: buildJobId(tmdbId) },
      })),
      this.logger,
      label,
    );

    if (tmdbIds.length >= runCap) {
      this.logger.warn(`${label} hit run cap (${runCap}); the rest waits for the next run`);
    }

    this.logger.log(
      `${label}: found=${tmdbIds.length}, enqueued=${result.enqueued}, deduped=${result.deduped}`,
    );
  }
}
