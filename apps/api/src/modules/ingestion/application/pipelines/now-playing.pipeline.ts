import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../../catalog/domain/repositories/media.repository.interface';
import {
  IMovieRepository,
  MOVIE_REPOSITORY,
} from '../../../catalog/domain/repositories/movie.repository.interface';
import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { preDedupeBulk, formatSample } from '../helpers/queue.helpers';

/**
 * Now Playing pipeline: syncs movies currently in theaters.
 * Fetches TMDB IDs, enqueues sync jobs, and updates now_playing flags.
 */
@Injectable()
export class NowPlayingPipeline {
  private readonly logger = new Logger(NowPlayingPipeline.name);
  private readonly CHECK_CONCURRENCY = 50;

  constructor(
    private readonly tmdbAdapter: TmdbAdapter,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
  ) {}

  /**
   * Syncs now playing movies: fetches TMDB IDs and enqueues sync jobs.
   */
  async sync(region = 'UA'): Promise<void> {
    this.logger.log(`Starting now playing sync (region: ${region})...`);

    const tmdbIds = await this.tmdbAdapter.getNowPlayingIds(region);
    this.logger.log(`Found ${tmdbIds.length} now playing movies from TMDB`);

    if (tmdbIds.length === 0) return;

    const existingMedia = await this.mediaRepository.findManyByTmdbIds(tmdbIds);
    const existingTmdbIds = new Set(existingMedia.map((m) => m.tmdbId));

    const missingTmdbIds = tmdbIds.filter((id) => !existingTmdbIds.has(id));

    if (missingTmdbIds.length > 0) {
      const jobs = missingTmdbIds.map((tmdbId) => ({
        name: IngestionJob.SYNC_MOVIE,
        data: { tmdbId },
        opts: { jobId: `movie_${tmdbId}_nowplaying_${region}` },
      }));

      const { jobsToAdd, deduped, sample } = await preDedupeBulk(
        jobs,
        this.ingestionQueue,
        this.CHECK_CONCURRENCY,
      );

      if (jobsToAdd.length > 0) {
        await this.ingestionQueue.addBulk(jobsToAdd);
      }

      this.logger.log(
        `Now playing sync jobs: found=${missingTmdbIds.length}, enqueued=${jobsToAdd.length}, deduped=${deduped}${formatSample(sample)}`,
      );
    }

    this.logger.log(`Now playing sync complete: ${tmdbIds.length} movies`);
  }

  /**
   * Updates now_playing flags in the database based on TMDB data.
   */
  async updateFlags(region = 'UA'): Promise<void> {
    this.logger.log(`Updating now playing flags (region: ${region})...`);

    const tmdbIds = await this.tmdbAdapter.getNowPlayingIds(region);
    await this.movieRepository.setNowPlaying(tmdbIds);

    this.logger.log(`Now playing flags updated: ${tmdbIds.length} movies marked`);
  }
}
