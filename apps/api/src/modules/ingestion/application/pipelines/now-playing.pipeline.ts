import { Injectable, Logger, Inject } from '@nestjs/common';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { BulkJobService } from '../services/bulk-job.service';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../../catalog/domain/repositories/media.repository.interface';
import {
  IMovieRepository,
  MOVIE_REPOSITORY,
} from '../../../catalog/domain/repositories/movie.repository.interface';
import { IngestionJob } from '../../ingestion.constants';

/**
 * Now Playing pipeline: syncs movies currently in theaters.
 *
 * Fetches TMDB IDs, enqueues sync jobs, and updates now_playing flags.
 */
@Injectable()
export class NowPlayingPipeline {
  private readonly logger = new Logger(NowPlayingPipeline.name);

  constructor(
    private readonly tmdbAdapter: TmdbAdapter,
    private readonly bulkJobService: BulkJobService,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
  ) {}

  /**
   * Syncs now playing movies.
   *
   * @param region - Region code (default: 'UA')
   */
  async sync(region = 'UA'): Promise<void> {
    this.logger.log(`Starting now playing sync (region: ${region})...`);

    const tmdbIds = await this.tmdbAdapter.getNowPlayingIds(region);
    this.logger.log(`Found ${tmdbIds.length} now playing movies from TMDB`);

    if (tmdbIds.length === 0) return;

    const missingTmdbIds = await this.filterMissing(tmdbIds);

    if (missingTmdbIds.length > 0) {
      const jobs = missingTmdbIds.map((tmdbId) => ({
        name: IngestionJob.SYNC_MOVIE,
        data: { tmdbId },
        opts: { jobId: `movie_${tmdbId}_nowplaying_${region}` },
      }));

      await this.bulkJobService.enqueueBulk(jobs, this.logger, 'Now playing sync');
    }

    this.logger.log(`Now playing sync complete: ${tmdbIds.length} movies`);
  }

  /**
   * Updates now_playing flags based on TMDB data.
   *
   * @param region - Region code (default: 'UA')
   */
  async updateFlags(region = 'UA'): Promise<void> {
    this.logger.log(`Updating now playing flags (region: ${region})...`);

    const tmdbIds = await this.tmdbAdapter.getNowPlayingIds(region);
    await this.movieRepository.setNowPlaying(tmdbIds);

    this.logger.log(`Now playing flags updated: ${tmdbIds.length} movies marked`);
  }

  private async filterMissing(tmdbIds: number[]): Promise<number[]> {
    const existingMedia = await this.mediaRepository.findManyByTmdbIds(tmdbIds);
    const existingTmdbIds = new Set(existingMedia.map((m) => m.tmdbId));
    return tmdbIds.filter((id) => !existingTmdbIds.has(id));
  }
}
