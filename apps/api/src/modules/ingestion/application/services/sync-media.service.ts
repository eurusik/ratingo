import { Inject, Injectable, Logger } from '@nestjs/common';
import { TmdbAdapter } from '../../infrastructure/adapters/tmdb/tmdb.adapter';
import { TraktAdapter } from '../../infrastructure/adapters/trakt/trakt.adapter';
import { OmdbAdapter } from '../../infrastructure/adapters/omdb/omdb.adapter';
import { IMediaRepository, MEDIA_REPOSITORY } from '@/modules/catalog/domain/repositories/media.repository.interface';
import { MediaType } from '@/common/enums/media-type.enum';
import { ScoreCalculatorService, ScoreInput } from '@/modules/shared/score-calculator';

/**
 * Application Service responsible for orchestrating the sync process.
 * It coordinates fetching data from adapters and persisting it to the repository.
 */
@Injectable()
export class SyncMediaService {
  private readonly logger = new Logger(SyncMediaService.name);

  constructor(
    private readonly tmdbAdapter: TmdbAdapter,
    private readonly traktAdapter: TraktAdapter,
    private readonly omdbAdapter: OmdbAdapter,
    private readonly scoreCalculator: ScoreCalculatorService,
    
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Synchronizes a movie by TMDB ID.
   */
  public async syncMovie(tmdbId: number, trendingScore?: number): Promise<void> {
    await this.processMedia(tmdbId, MediaType.MOVIE, trendingScore);
  }

  /**
   * Synchronizes a show by TMDB ID.
   */
  public async syncShow(tmdbId: number, trendingScore?: number): Promise<void> {
    await this.processMedia(tmdbId, MediaType.SHOW, trendingScore);
  }

  /**
   * Core processing logic: fetches data from all sources concurrently and upserts.
   */
  private async processMedia(tmdbId: number, type: MediaType, trendingScore?: number): Promise<void> {
    this.logger.debug(`Syncing ${type} ${tmdbId}...`);

    try {
      // 1. Fetch Base Metadata from TMDB (Primary Source)
      const media = type === MediaType.MOVIE 
        ? await this.tmdbAdapter.getMovie(tmdbId)
        : await this.tmdbAdapter.getShow(tmdbId);

      if (!media) {
        this.logger.warn(`${type} ${tmdbId} not found in TMDB`);
        return;
      }

      // 2. Enhance with external ratings (Parallel)
      const imdbId = media.externalIds?.imdbId;
      
      const [traktRating, omdbRatings] = await Promise.all([
        // Trakt (lookup by TMDB ID, then fetch ratings)
        type === MediaType.MOVIE
          ? this.traktAdapter.getMovieRatingsByTmdbId(tmdbId)
          : this.traktAdapter.getShowRatingsByTmdbId(tmdbId),
        // OMDb (requires IMDb ID)
        imdbId ? this.omdbAdapter.getAggregatedRatings(imdbId, type) : Promise.resolve(null),
      ]);

      // 3. Merge Data
      if (trendingScore !== undefined) {
        media.trendingScore = trendingScore;
      }

      if (traktRating) {
        media.ratingTrakt = traktRating.rating;
        media.voteCountTrakt = traktRating.votes;
      }

      if (omdbRatings) {
        media.ratingImdb = omdbRatings.imdbRating;
        media.voteCountImdb = omdbRatings.imdbVotes;
        media.ratingMetacritic = omdbRatings.metacritic;
        media.ratingRottenTomatoes = omdbRatings.rottenTomatoes;
      }

      // 4. Calculate Ratingo Score
      const scoreInput: ScoreInput = {
        tmdbPopularity: media.popularity,
        traktWatchers: 0, // Will be updated by Stats module
        imdbRating: media.ratingImdb,
        traktRating: media.ratingTrakt,
        metacriticRating: media.ratingMetacritic,
        rottenTomatoesRating: media.ratingRottenTomatoes,
        imdbVotes: media.voteCountImdb,
        traktVotes: media.voteCountTrakt,
        releaseDate: media.releaseDate,
      };

      const scores = this.scoreCalculator.calculate(scoreInput);
      media.ratingoScore = scores.ratingoScore;
      media.qualityScore = scores.qualityScore;
      media.popularityScore = scores.popularityScore;
      media.freshnessScore = scores.freshnessScore;

      // 5. Persist
      await this.mediaRepository.upsert(media);
      this.logger.log(`Synced ${type}: ${media.title} (Ratingo: ${(scores.ratingoScore * 100).toFixed(1)})`);

    } catch (error) {
      this.logger.error(`Failed to sync ${type} ${tmdbId}: ${error.message}`, error.stack);
      throw error; // Let BullMQ retry
    }
  }

  /**
   * Fetches trending media IDs from the provider.
   */
  public async getTrending(page = 1) {
    return this.tmdbAdapter.getTrending(page);
  }
}
