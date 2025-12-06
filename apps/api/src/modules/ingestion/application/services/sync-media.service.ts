import { Inject, Injectable, Logger } from '@nestjs/common';
import { IMetadataProvider } from '../../domain/interfaces/metadata-provider.interface';
import { TmdbAdapter } from '../../infrastructure/adapters/tmdb/tmdb.adapter';
import { IMediaRepository, MEDIA_REPOSITORY } from '@/modules/catalog/domain/repositories/media.repository.interface';

/**
 * Application Service responsible for orchestrating the sync process.
 * It coordinates fetching data from adapters and persisting it to the repository.
 */
@Injectable()
export class SyncMediaService {
  private readonly logger = new Logger(SyncMediaService.name);

  constructor(
    // In the future, we might inject an array of providers here (Strategy Pattern)
    private readonly tmdbAdapter: TmdbAdapter,
    
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Synchronizes a movie by TMDB ID.
   * Fetches data from TMDB, normalizes it, and upserts into the catalog.
   */
  public async syncMovie(tmdbId: number, trendingScore?: number): Promise<void> {
    this.logger.log(`Starting sync for Movie ID: ${tmdbId}`);

    const normalizedMedia = await this.tmdbAdapter.getMovie(tmdbId);

    if (!normalizedMedia) {
      this.logger.warn(`Movie ${tmdbId} not found in provider`);
      return;
    }

    if (trendingScore !== undefined) {
      normalizedMedia.trendingScore = trendingScore;
    }

    await this.mediaRepository.upsert(normalizedMedia);
    this.logger.log(`Successfully synced Movie: ${normalizedMedia.title}`);
  }

  /**
   * Synchronizes a show by TMDB ID.
   */
  public async syncShow(tmdbId: number, trendingScore?: number): Promise<void> {
    this.logger.log(`Starting sync for Show ID: ${tmdbId}`);

    const normalizedMedia = await this.tmdbAdapter.getShow(tmdbId);

    if (!normalizedMedia) {
      this.logger.warn(`Show ${tmdbId} not found in provider`);
      return;
    }

    // Inject trending score if provided
    if (trendingScore !== undefined) {
      normalizedMedia.trendingScore = trendingScore;
    }

    await this.mediaRepository.upsert(normalizedMedia);
    this.logger.log(`Successfully synced Show: ${normalizedMedia.title}`);
  }

  /**
   * Fetches trending media IDs from the provider.
   */
  public async getTrending(page = 1) {
    return this.tmdbAdapter.getTrending(page);
  }
}
