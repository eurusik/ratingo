import { Injectable, Logger, Inject } from '@nestjs/common';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { BulkJobService } from '../services/bulk-job.service';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../../catalog/domain/repositories/media.repository.interface';
import { IngestionJob } from '../../ingestion.constants';
import { formatUtcDayId } from '@/common/utils/date.util';
import { DEFAULT_REGION } from '../../../../common/constants';

/**
 * New Releases pipeline: syncs recently released movies.
 *
 * Fetches TMDB IDs for movies released in the last N days.
 */
@Injectable()
export class NewReleasesPipeline {
  private readonly logger = new Logger(NewReleasesPipeline.name);

  constructor(
    private readonly tmdbAdapter: TmdbAdapter,
    private readonly bulkJobService: BulkJobService,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Syncs new releases: fetches TMDB IDs and enqueues sync jobs.
   *
   * @param region - Region code for release dates (default: DEFAULT_REGION)
   * @param daysBack - Number of days to look back (default: 30)
   */
  async sync(region = DEFAULT_REGION, daysBack = 30): Promise<void> {
    this.logger.log(`Starting new releases sync (region: ${region}, daysBack: ${daysBack})...`);

    const tmdbIds = await this.tmdbAdapter.getNewReleaseIds(daysBack, region);
    this.logger.log(`Found ${tmdbIds.length} new releases from TMDB`);

    if (tmdbIds.length === 0) return;

    const missingTmdbIds = await this.filterMissing(tmdbIds);

    if (missingTmdbIds.length === 0) {
      this.logger.log('All new releases already exist in database');
      return;
    }

    const today = formatUtcDayId();
    const jobs = missingTmdbIds.map((tmdbId) => ({
      name: IngestionJob.SYNC_MOVIE,
      data: { tmdbId },
      opts: { jobId: `movie_${tmdbId}_${today}` },
    }));

    const result = await this.bulkJobService.enqueueBulk(
      jobs,
      this.logger,
      `New releases (region=${region}, daysBack=${daysBack})`,
    );

    this.logger.log(
      `New releases sync complete: total=${tmdbIds.length}, enqueued=${result.enqueued}, deduped=${result.deduped}`,
    );
  }

  private async filterMissing(tmdbIds: number[]): Promise<number[]> {
    const existingMedia = await this.mediaRepository.findManyByTmdbIds(tmdbIds);
    const existingTmdbIds = new Set(existingMedia.map((m) => m.tmdbId));
    return tmdbIds.filter((id) => !existingTmdbIds.has(id));
  }
}
