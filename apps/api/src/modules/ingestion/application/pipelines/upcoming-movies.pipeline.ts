import { Inject, Injectable, Logger } from '@nestjs/common';

import { MS_PER_DAY, MS_PER_HOUR, UPCOMING_MOVIES_SOON_DAYS } from '@/common/constants';
import { MediaType } from '@/common/enums/media-type.enum';
import { type IMediaRepository, MEDIA_REPOSITORY } from '@/modules/catalog/public';
import {
  buildUpcomingMovieJobId,
  buildUpcomingRefreshJobId,
} from '@/modules/ingestion/domain/job-ids';
import {
  type IUpcomingMoviesRepository,
  UPCOMING_MOVIES_REPOSITORY,
} from '@/modules/ingestion/domain/repositories/upcoming-movies.repository.interface';
import {
  IngestionJob,
  UPCOMING_REFRESH_MIN_SYNC_AGE_HOURS,
  UPCOMING_REFRESH_RUN_CAP,
  UpcomingMoviesRefreshScope,
  type UpcomingMoviesRefreshScopeType,
} from '@/modules/ingestion/ingestion.constants';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';
import { TmdbAdapter } from '@/modules/tmdb/public';

import { BulkJobService } from '../services/bulk-job.service';

@Injectable()
export class UpcomingMoviesPipeline {
  private readonly logger = new Logger(UpcomingMoviesPipeline.name);

  constructor(
    private readonly tmdbAdapter: TmdbAdapter,
    private readonly bulkJobService: BulkJobService,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
    @Inject(UPCOMING_MOVIES_REPOSITORY)
    private readonly upcomingMoviesRepository: IUpcomingMoviesRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  async sync(): Promise<void> {
    const tmdbIds = await this.tmdbAdapter.getUpcomingMovieIds();
    this.logger.log(`Found ${tmdbIds.length} upcoming movies from TMDB`);

    if (tmdbIds.length === 0) return;

    const missingTmdbIds = await this.filterMissing(tmdbIds);
    if (missingTmdbIds.length === 0) {
      this.logger.log('All upcoming movies already exist in database');
      return;
    }

    const jobs = missingTmdbIds.map((tmdbId) => ({
      name: IngestionJob.SYNC_MOVIE,
      data: { tmdbId },
      opts: { jobId: buildUpcomingMovieJobId(tmdbId) },
    }));

    const result = await this.bulkJobService.enqueueBulk(jobs, this.logger, 'Upcoming movies');

    this.logger.log(
      `Upcoming movies sync complete: total=${tmdbIds.length}, enqueued=${result.enqueued}, deduped=${result.deduped}`,
    );
  }

  async refresh(
    scope: UpcomingMoviesRefreshScopeType = UpcomingMoviesRefreshScope.SOON,
  ): Promise<void> {
    const now = this.clock.now().getTime();
    const soonWindowMs = UPCOMING_MOVIES_SOON_DAYS * MS_PER_DAY;

    const tmdbIds = await this.upcomingMoviesRepository.findTmdbIdsToRefresh({
      releasedAfter: new Date(now - soonWindowMs),
      releasedBefore:
        scope === UpcomingMoviesRefreshScope.SOON ? new Date(now + soonWindowMs) : null,
      syncedBefore: new Date(now - UPCOMING_REFRESH_MIN_SYNC_AGE_HOURS * MS_PER_HOUR),
      limit: UPCOMING_REFRESH_RUN_CAP,
    });

    if (tmdbIds.length === 0) {
      this.logger.log(`No upcoming movies to refresh (scope=${scope})`);
      return;
    }

    const jobs = tmdbIds.map((tmdbId) => ({
      name: IngestionJob.SYNC_MOVIE,
      data: { tmdbId },
      opts: { jobId: buildUpcomingRefreshJobId(tmdbId) },
    }));

    const result = await this.bulkJobService.enqueueBulk(
      jobs,
      this.logger,
      `Upcoming movies refresh (scope=${scope})`,
    );

    if (tmdbIds.length >= UPCOMING_REFRESH_RUN_CAP) {
      this.logger.warn(
        `Upcoming movies refresh hit run cap (${UPCOMING_REFRESH_RUN_CAP}, scope=${scope}); the rest waits for the next run`,
      );
    }

    this.logger.log(
      `Upcoming movies refresh complete: scope=${scope}, found=${tmdbIds.length}, enqueued=${result.enqueued}, deduped=${result.deduped}`,
    );
  }

  private async filterMissing(tmdbIds: number[]): Promise<number[]> {
    const existingMedia = await this.mediaRepository.findManyByTmdbIds(tmdbIds, MediaType.MOVIE);
    const existingTmdbIds = new Set(existingMedia.map((m) => m.tmdbId));
    return tmdbIds.filter((id) => !existingTmdbIds.has(id));
  }
}
