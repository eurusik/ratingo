import { Inject, Injectable, Logger } from '@nestjs/common';

import { MS_PER_DAY, MS_PER_HOUR, UPCOMING_MOVIES_SOON_DAYS } from '@/common/constants';
import { type IMediaRepository, MEDIA_REPOSITORY } from '@/modules/catalog/public';
import {
  buildUpcomingMovieJobId,
  buildUpcomingRefreshJobId,
} from '@/modules/ingestion/domain/job-ids';
import {
  type IUpcomingMoviesRepository,
  UPCOMING_MOVIES_REPOSITORY,
  type UpcomingMoviesRefreshQuery,
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

import { findMissingMovieTmdbIds } from '../helpers/missing-movies.helper';
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

    const missingTmdbIds = await findMissingMovieTmdbIds(this.mediaRepository, tmdbIds);
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
    const tmdbIds = await this.upcomingMoviesRepository.findTmdbIdsToRefresh(
      this.buildRefreshQuery(scope),
    );

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

  private buildRefreshQuery(scope: UpcomingMoviesRefreshScopeType): UpcomingMoviesRefreshQuery {
    const now = this.clock.now().getTime();
    const soonWindowMs = UPCOMING_MOVIES_SOON_DAYS * MS_PER_DAY;

    return {
      releasedAfter: new Date(now - soonWindowMs),
      releasedBefore:
        scope === UpcomingMoviesRefreshScope.ALL ? null : new Date(now + soonWindowMs),
      syncedBefore: new Date(now - UPCOMING_REFRESH_MIN_SYNC_AGE_HOURS * MS_PER_HOUR),
      limit: UPCOMING_REFRESH_RUN_CAP,
    };
  }
}
