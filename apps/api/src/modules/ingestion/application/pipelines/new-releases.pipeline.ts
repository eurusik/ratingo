import { Injectable, Logger, Inject } from '@nestjs/common';

import { DEFAULT_REGION, CATALOG_DEFAULT_NEW_RELEASE_DAYS } from '../../../../common/constants';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { type IMediaRepository, MEDIA_REPOSITORY } from '../../../catalog/public';
import { TmdbAdapter } from '../../../tmdb/public';
import { buildNewReleaseJobId } from '../../domain/job-ids';
import { IngestionJob } from '../../ingestion.constants';
import { BulkJobService } from '../services/bulk-job.service';

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
   * @param daysBack - Number of days to look back (default: CATALOG_DEFAULT_NEW_RELEASE_DAYS)
   */
  async sync(region = DEFAULT_REGION, daysBack = CATALOG_DEFAULT_NEW_RELEASE_DAYS): Promise<void> {
    this.logger.log(`Starting new releases sync (region: ${region}, daysBack: ${daysBack})...`);

    const tmdbIds = await this.tmdbAdapter.getNewReleaseIds(daysBack, region);
    this.logger.log(`Found ${tmdbIds.length} new releases from TMDB`);

    if (tmdbIds.length === 0) return;

    const missingTmdbIds = await this.filterMissing(tmdbIds);

    if (missingTmdbIds.length === 0) {
      this.logger.log('All new releases already exist in database');
      return;
    }

    const jobs = missingTmdbIds.map((tmdbId) => ({
      name: IngestionJob.SYNC_MOVIE,
      data: { tmdbId },
      opts: { jobId: buildNewReleaseJobId(tmdbId) },
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
    // TMDB movie/TV id spaces overlap — a show with the same id must not mask a missing movie
    const existingMedia = await this.mediaRepository.findManyByTmdbIds(tmdbIds, MediaType.MOVIE);
    const existingTmdbIds = new Set(existingMedia.map((m) => m.tmdbId));
    return tmdbIds.filter((id) => !existingTmdbIds.has(id));
  }
}
