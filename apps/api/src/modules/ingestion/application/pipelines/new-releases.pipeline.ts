import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../../catalog/domain/repositories/media.repository.interface';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { formatUtcDayId } from '@/common/utils/date.util';
import { preDedupeBulk, formatSample } from '../helpers/queue.helpers';

/**
 * New Releases pipeline: syncs recently released movies.
 * Fetches TMDB IDs for movies released in the last N days and enqueues sync jobs.
 */
@Injectable()
export class NewReleasesPipeline {
  private readonly logger = new Logger(NewReleasesPipeline.name);
  private readonly CHECK_CONCURRENCY = 50;

  constructor(
    private readonly tmdbAdapter: TmdbAdapter,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
  ) {}

  /**
   * Syncs new releases: fetches TMDB IDs and enqueues sync jobs with deduplication.
   */
  async sync(region = 'UA', daysBack = 30): Promise<void> {
    this.logger.log(`Starting new releases sync (region: ${region}, daysBack: ${daysBack})...`);

    const tmdbIds = await this.tmdbAdapter.getNewReleaseIds(daysBack, region);
    this.logger.log(`Found ${tmdbIds.length} new releases from TMDB`);

    if (tmdbIds.length === 0) return;

    const existingMedia = await this.mediaRepository.findManyByTmdbIds(tmdbIds);
    const existingTmdbIds = new Set(existingMedia.map((m) => m.tmdbId));

    const missingTmdbIds = tmdbIds.filter((id) => !existingTmdbIds.has(id));

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

    const { jobsToAdd, deduped, sample } = await preDedupeBulk(
      jobs,
      this.ingestionQueue,
      this.CHECK_CONCURRENCY,
    );

    if (jobsToAdd.length > 0) {
      await this.ingestionQueue.addBulk(jobsToAdd);
    }

    const enqueuedIds = jobsToAdd.map((j) => j.data.tmdbId);
    const sampleIds =
      enqueuedIds.slice(0, 5).length > 0 ? `, sample=[${enqueuedIds.slice(0, 5).join(',')}]` : '';

    this.logger.log(
      `New releases region=${region} daysBack=${daysBack}: found=${tmdbIds.length}, enqueued=${jobsToAdd.length}, deduped=${deduped}${sampleIds}`,
    );
  }
}
