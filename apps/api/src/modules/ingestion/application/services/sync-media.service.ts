import { Inject, Injectable, Logger } from '@nestjs/common';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { TraktAdapter } from '../../infrastructure/adapters/trakt/trakt.adapter';
import { OmdbAdapter } from '../../infrastructure/adapters/omdb/omdb.adapter';
import { TvMazeAdapter, TvMazeEpisode } from '../../infrastructure/adapters/tvmaze/tvmaze.adapter';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../../catalog/domain/repositories/media.repository.interface';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ScoreCalculatorService, ScoreInput } from '../../../shared/score-calculator';
import { NormalizedSeason, NormalizedEpisode } from '../../domain/models/normalized-media.model';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

/**
 * Application Service responsible for orchestrating the sync process.
 *
 * Coordinates fetching data from multiple sources (TMDB, Trakt, OMDb, TVMaze),
 * merging metadata, calculating Ratingo scores, and persisting the unified
 * NormalizedMedia entity to the repository.
 */
@Injectable()
export class SyncMediaService {
  private readonly logger = new Logger(SyncMediaService.name);

  constructor(
    private readonly tmdbAdapter: TmdbAdapter,
    private readonly traktAdapter: TraktAdapter,
    private readonly omdbAdapter: OmdbAdapter,
    private readonly tvMazeAdapter: TvMazeAdapter,
    private readonly scoreCalculator: ScoreCalculatorService,

    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Synchronizes a movie by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID of the movie
   * @param {number} [trendingScore] - Optional trending rank for sorting
   */
  public async syncMovie(tmdbId: number, trendingScore?: number): Promise<void> {
    await this.processMedia(tmdbId, MediaType.MOVIE, trendingScore);
  }

  /**
   * Synchronizes a show by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID of the show
   * @param {number} [trendingScore] - Optional trending rank for sorting
   */
  public async syncShow(tmdbId: number, trendingScore?: number): Promise<void> {
    await this.processMedia(tmdbId, MediaType.SHOW, trendingScore);
  }

  /**
   * Core processing logic: fetches data from all sources concurrently and upserts.
   *
   * 1. Fetches base metadata from TMDB
   * 2. Enriches with TVMaze episode data (for shows)
   * 3. Fetches external ratings from Trakt and OMDb (IMDb/Rotten Tomatoes)
   * 4. Calculates Ratingo score
   * 5. Upserts NormalizedMedia to database
   *
   * @throws Will throw error if TMDB fetch fails or critical data is missing
   */
  private async processMedia(
    tmdbId: number,
    type: MediaType,
    trendingScore?: number,
  ): Promise<void> {
    this.logger.debug(`Syncing ${type} ${tmdbId}...`);

    try {
      // Mark as importing
      await this.mediaRepository.updateIngestionStatus(tmdbId, IngestionStatus.IMPORTING);

      // Fetch Base Metadata from TMDB (Primary Source)
      const media =
        type === MediaType.MOVIE
          ? await this.tmdbAdapter.getMovie(tmdbId)
          : await this.tmdbAdapter.getShow(tmdbId);

      if (!media) {
        this.logger.warn(`${type} ${tmdbId} not found in TMDB`);
        await this.mediaRepository.updateIngestionStatus(tmdbId, IngestionStatus.FAILED);
        return;
      }

      const imdbId = media.externalIds?.imdbId;

      // === TVMAZE ENRICHMENT (Shows only) ===
      if (type === MediaType.SHOW && imdbId) {
        try {
          const tvMazeEpisodes = await this.tvMazeAdapter.getEpisodesByImdbId(imdbId);

          if (tvMazeEpisodes.length > 0) {
            // Group TVMaze episodes by season
            const seasonMap = new Map<number, TvMazeEpisode[]>();

            for (const ep of tvMazeEpisodes) {
              if (!seasonMap.has(ep.seasonNumber)) seasonMap.set(ep.seasonNumber, []);
              seasonMap.get(ep.seasonNumber).push(ep);
            }

            const mergedSeasons: NormalizedSeason[] = [];
            const tmdbSeasonMap = new Map<number, NormalizedSeason>();

            if (media.details?.seasons) {
              for (const s of media.details.seasons) {
                tmdbSeasonMap.set(s.number, s);
              }
            }

            // Iterate over TVMaze seasons (Time Authority)
            for (const [sNum, eps] of seasonMap.entries()) {
              const tmdbSeason = tmdbSeasonMap.get(sNum);

              // Map TvMazeEpisode back to NormalizedEpisode (remove seasonNumber)
              const cleanEpisodes: NormalizedEpisode[] = eps.map((e) => {
                const { seasonNumber, ...rest } = e;
                return rest;
              });

              mergedSeasons.push({
                number: sNum,
                // Inherit metadata from TMDB if available
                tmdbId: tmdbSeason?.tmdbId,
                name: tmdbSeason?.name,
                overview: tmdbSeason?.overview,
                posterPath: tmdbSeason?.posterPath,
                airDate: tmdbSeason?.airDate,
                episodeCount: cleanEpisodes.length,
                episodes: cleanEpisodes,
              });
            }

            // Add leftover TMDB seasons (e.g. Specials)
            if (media.details?.seasons) {
              for (const s of media.details.seasons) {
                if (!seasonMap.has(s.number)) {
                  mergedSeasons.push(s);
                }
              }
            }

            mergedSeasons.sort((a, b) => a.number - b.number);

            if (!media.details) media.details = {};
            media.details.seasons = mergedSeasons;

            // Calculate Next Air Date
            const now = new Date();
            const futureEpisodes = tvMazeEpisodes
              .filter((e) => e.airDate && e.airDate > now)
              .sort((a, b) => a.airDate!.getTime() - b.airDate!.getTime());

            if (futureEpisodes.length > 0) {
              media.details.nextAirDate = futureEpisodes[0].airDate;
            }
          }
        } catch (err) {
          this.logger.warn(`TVMaze sync failed for ${media.title}: ${err.message}`);
        }
      }

      // Enhance with external ratings (Parallel)

      const [traktRating, omdbRatings] = await Promise.all([
        // Trakt (lookup by TMDB ID, then fetch ratings)
        type === MediaType.MOVIE
          ? this.traktAdapter.getMovieRatingsByTmdbId(tmdbId)
          : this.traktAdapter.getShowRatingsByTmdbId(tmdbId),
        // OMDb (requires IMDb ID)
        imdbId ? this.omdbAdapter.getAggregatedRatings(imdbId, type) : Promise.resolve(null),
      ]);

      // Merge Data
      if (trendingScore !== undefined) {
        media.trendingScore = trendingScore;
      }

      if (traktRating) {
        media.ratingTrakt = traktRating.rating;
        media.voteCountTrakt = traktRating.votes;
        media.watchersCount = traktRating.watchers;
        media.totalWatchers = traktRating.totalWatchers;
      }

      if (omdbRatings) {
        media.ratingImdb = omdbRatings.imdbRating;
        media.voteCountImdb = omdbRatings.imdbVotes;
        media.ratingMetacritic = omdbRatings.metacritic;
        media.ratingRottenTomatoes = omdbRatings.rottenTomatoes;
      }

      // Calculate Ratingo Score
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
      media.ingestionStatus = IngestionStatus.READY;

      // Persist
      await this.mediaRepository.upsert(media);
      await this.mediaRepository.updateIngestionStatus(tmdbId, IngestionStatus.READY);
      this.logger.log(
        `Synced ${type}: ${media.title} (Ratingo: ${(scores.ratingoScore * 100).toFixed(1)})`,
      );
    } catch (error) {
      this.logger.error(`Failed to sync ${type} ${tmdbId}: ${error.message}`, error.stack);
      try {
        await this.mediaRepository.updateIngestionStatus(tmdbId, IngestionStatus.FAILED);
      } catch (statusError) {
        this.logger.warn(
          `Failed to mark ${type} ${tmdbId} as failed: ${(statusError as Error).message}`,
        );
      }
      throw error; // Let BullMQ retry
    }
  }

  /**
   * Fetches trending media IDs from the provider.
   *
   * @param {number} page - Page number to fetch (1-based)
   * @param {MediaType} [type] - Optional type filter (movie/show)
   * @returns {Promise<any[]>} List of trending items with TMDB IDs
   */
  public async getTrending(page = 1, type?: MediaType) {
    return this.tmdbAdapter.getTrending(page, type);
  }
}
