import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { generateSlug, type IMediaRepository, MEDIA_REPOSITORY } from '../../../catalog/public';
import {
  type ICatalogPolicyEvaluator,
  CATALOG_POLICY_EVALUATOR,
  classifyContent,
  EvaluationContext,
} from '../../../catalog-policy/public';
import { NormalizationService } from '../../../provider/public';
import { CLOCK_PORT, type IClockPort } from '../../../shared/clock';
import { ScoreCalculatorService, type ScoreInput } from '../../../shared/score-calculator';
import { TmdbAdapter } from '../../../tmdb/public';
import { type TraktRatingsPort, TRAKT_RATINGS_PORT } from '../../../trakt/public';
import { MediaSyncedEvent } from '../../domain/events/media-synced.event';
import { type NormalizedMedia } from '../../domain/models/normalized-media.model';
import { OmdbAdapter } from '../../infrastructure/adapters/omdb/omdb.adapter';

import { TvMazeEnrichmentService } from './tvmaze-enrichment.service';

// Score display multiplier (0-1 to 0-100)
const SCORE_PERCENT_MULTIPLIER = 100;

/**
 * Result of checking if media exists.
 */
export interface ExistingMediaResult {
  id: string;
  type: MediaType;
  slug: string;
  ingestionStatus: IngestionStatus;
}

/**
 * Result of creating a media stub for ingestion.
 */
export interface MediaStubResult {
  id: string;
  slug: string;
  title: string;
}

/**
 * Orchestrates media sync from multiple external sources.
 *
 * Fetches data from TMDB, Trakt, OMDb, TVMaze, merges metadata,
 * calculates Ratingo scores, and persists to database.
 *
 * Pipeline: fetchBaseMedia → enrichWithTvMaze → enrichWithTmdbEpisodes (fallback) →
 * attachExternalRatings → applyTrending → calculateScores → classifyMedia → persist → evaluateCatalog
 */
@Injectable()
export class SyncMediaService {
  private readonly logger = new Logger(SyncMediaService.name);

  constructor(
    private readonly tmdbAdapter: TmdbAdapter,
    @Inject(TRAKT_RATINGS_PORT)
    private readonly traktRatingsAdapter: TraktRatingsPort,
    private readonly omdbAdapter: OmdbAdapter,
    private readonly tvMazeEnrichment: TvMazeEnrichmentService,
    private readonly scoreCalculator: ScoreCalculatorService,
    private readonly normalizationService: NormalizationService,
    private readonly eventEmitter: EventEmitter2,

    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,

    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,

    @Optional()
    @Inject(CATALOG_POLICY_EVALUATOR)
    private readonly catalogEvaluator?: ICatalogPolicyEvaluator,
  ) {}

  /**
   * Syncs a movie by TMDB ID.
   *
   * @param tmdbId - TMDB movie ID
   * @param trending - Optional trending score and rank
   * @param jobId - Optional job ID for log correlation
   */
  public async syncMovie(
    tmdbId: number,
    trending?: { score: number; rank: number },
    jobId?: string,
  ): Promise<void> {
    await this.processMedia(tmdbId, MediaType.MOVIE, trending, jobId);
  }

  /**
   * Syncs a show by TMDB ID.
   *
   * @param tmdbId - TMDB show ID
   * @param trending - Optional trending score and rank
   * @param jobId - Optional job ID for log correlation
   */
  public async syncShow(
    tmdbId: number,
    trending?: { score: number; rank: number },
    jobId?: string,
  ): Promise<void> {
    await this.processMedia(tmdbId, MediaType.SHOW, trending, jobId);
  }

  /**
   * Fetches trending media from TMDB.
   *
   * @param page - Page number (1-based)
   * @param type - Optional media type filter
   * @returns Trending items with TMDB IDs
   */
  public async getTrending(page = 1, type?: MediaType) {
    return this.tmdbAdapter.getTrending(page, type);
  }

  // ============================================================
  // PIPELINE ORCHESTRATOR
  // ============================================================

  /** Orchestrates all sync pipeline steps. */
  private async processMedia(
    tmdbId: number,
    type: MediaType,
    trending?: { score: number; rank: number },
    jobId?: string,
  ): Promise<void> {
    const logPrefix = `[${type}:${tmdbId}${jobId ? ` job:${jobId}` : ''}]`;
    this.logger.debug(`${logPrefix} Syncing...`);

    try {
      await this.mediaRepository.updateIngestionStatus(tmdbId, IngestionStatus.IMPORTING);

      // Step 1: Fetch base metadata
      const baseMedia = await this.fetchBaseMedia(tmdbId, type, logPrefix);
      if (!baseMedia) return;

      // Step 2: Enrich with TVMaze (shows only)
      let enrichedMedia = await this.enrichWithTvMaze(baseMedia, type, logPrefix);

      // Step 2b: TMDB episode fallback (when TVMaze has no data)
      enrichedMedia = await this.enrichWithTmdbEpisodes(enrichedMedia, type, logPrefix);

      // Step 3: Attach external ratings
      const withRatings = await this.attachExternalRatings(enrichedMedia, tmdbId, type);

      // Step 4: Apply trending data
      const withTrending = this.applyTrending(withRatings, trending);

      // Step 5: Calculate scores
      const scored = this.calculateScores(withTrending);

      // Step 6: Classify content
      const classified = this.classifyMedia(scored);

      // Step 7: Persist
      await this.persist(classified, tmdbId);

      // Fetch the persisted media item once — shared across steps 8–11 to avoid redundant DB calls
      const mediaItem = await this.mediaRepository.findByTmdbId(tmdbId);

      // Step 8: Record sync completion timestamp (before best-effort steps so partial failures
      // don't block the user-visible cooldown from reflecting actual sync work done)
      if (mediaItem) {
        await this.mediaRepository.updateLastSyncedAt(mediaItem.id, this.clock.now());
      } else {
        this.logger.warn(
          `${logPrefix} lastSyncedAt not recorded — findByTmdbId returned null after persist`,
        );
      }

      // Step 9: Normalize watch providers
      await this.normalizeWatchProviders(classified, mediaItem, logPrefix);

      // Step 10: Evaluate catalog eligibility (both catalog and trending contexts if applicable)
      const isTrending = trending !== undefined && trending.score > 0;
      await this.evaluateCatalog(mediaItem, logPrefix, isTrending);

      // Step 11: Emit domain event for cross-module consumers (e.g. link pending import items)
      await this.emitMediaSynced(tmdbId, type, mediaItem, logPrefix);

      this.logger.log(
        `${logPrefix} Synced: ${classified.title} (Ratingo: ${((classified.ratingoScore ?? 0) * SCORE_PERCENT_MULTIPLIER).toFixed(1)})`,
      );
    } catch (error) {
      this.logger.error(`${logPrefix} Failed: ${error.message}`, error.stack);
      await this.markAsFailed(tmdbId, logPrefix);
      throw error;
    }
  }

  // ============================================================
  // PIPELINE STEPS
  // ============================================================

  /** Fetches base metadata from TMDB. Returns null if not found. */
  private async fetchBaseMedia(
    tmdbId: number,
    type: MediaType,
    logPrefix: string,
  ): Promise<NormalizedMedia | null> {
    const media =
      type === MediaType.MOVIE
        ? await this.tmdbAdapter.getMovie(tmdbId)
        : await this.tmdbAdapter.getShow(tmdbId);

    if (!media) {
      this.logger.warn(`${logPrefix} Not found in TMDB`);
      await this.mediaRepository.updateIngestionStatus(tmdbId, IngestionStatus.FAILED);
      return null;
    }

    return media;
  }

  /** Enriches show with TVMaze episode data. No-op for movies. */
  private async enrichWithTvMaze(
    media: NormalizedMedia,
    type: MediaType,
    logPrefix: string,
  ): Promise<NormalizedMedia> {
    if (type !== MediaType.SHOW) return media;

    try {
      return await this.tvMazeEnrichment.enrich(media);
    } catch (err) {
      this.logger.warn(`${logPrefix} TVMaze enrichment failed: ${err.message}`);
      return media;
    }
  }

  /** Fetches episodes from TMDB for seasons left empty after TVMaze enrichment. */
  private async enrichWithTmdbEpisodes(
    media: NormalizedMedia,
    type: MediaType,
    logPrefix: string,
  ): Promise<NormalizedMedia> {
    if (type !== MediaType.SHOW) return media;

    const seasons = media.details?.seasons;
    if (!seasons?.length) return media;

    const emptySeasons = seasons.filter((s) => s.episodes.length === 0 && s.number > 0);
    if (emptySeasons.length === 0) return media;

    const { tmdbId } = media.externalIds;

    try {
      const updatedSeasons = await Promise.all(
        seasons.map(async (season) => {
          if (season.episodes.length > 0 || season.number === 0) return season;

          const episodes = await this.tmdbAdapter.getSeasonEpisodes(tmdbId, season.number);
          if (episodes.length === 0) return season;

          return { ...season, episodes, episodeCount: episodes.length };
        }),
      );

      const allEpisodes = updatedSeasons.flatMap((s) => s.episodes);
      const now = new Date();
      const aired = allEpisodes.filter((e) => e.airDate && e.airDate <= now);
      const future = allEpisodes.filter((e) => e.airDate && e.airDate > now);

      const lastAirDate = aired.length
        ? aired.reduce((latest, e) =>
            e.airDate!.getTime() > latest.airDate!.getTime() ? e : latest,
          ).airDate!
        : null;
      const nextAirDate = future.length
        ? future.reduce((earliest, e) =>
            e.airDate!.getTime() < earliest.airDate!.getTime() ? e : earliest,
          ).airDate!
        : null;

      this.logger.debug(
        `${logPrefix} TMDB episode fallback: filled ${emptySeasons.length} season(s)`,
      );

      const totalEpisodesFromSeasons = updatedSeasons
        .filter((s) => s.number > 0)
        .reduce((sum, s) => sum + (s.episodeCount ?? 0), 0);

      return {
        ...media,
        details: {
          ...media.details,
          seasons: updatedSeasons,
          totalEpisodes:
            totalEpisodesFromSeasons > (media.details?.totalEpisodes ?? 0)
              ? totalEpisodesFromSeasons
              : media.details?.totalEpisodes,
          // TMDB is lower priority than TVMaze for air dates.
          // Existing value (set by TVMaze) takes precedence — only use TMDB if nothing else available.
          lastAirDate: media.details?.lastAirDate ?? lastAirDate,
          nextAirDate: media.details?.nextAirDate ?? nextAirDate,
        },
      };
    } catch (err) {
      this.logger.warn(`${logPrefix} TMDB episode fallback failed: ${(err as Error).message}`);
      return media;
    }
  }

  /** Fetches and attaches Trakt + OMDb ratings in parallel. */
  private async attachExternalRatings(
    media: NormalizedMedia,
    tmdbId: number,
    type: MediaType,
  ): Promise<NormalizedMedia> {
    const imdbId = media.externalIds?.imdbId;

    const [traktRating, omdbRatings] = await Promise.all([
      type === MediaType.MOVIE
        ? this.traktRatingsAdapter.getMovieRatingsByTmdbId(tmdbId)
        : this.traktRatingsAdapter.getShowRatingsByTmdbId(tmdbId),
      imdbId ? this.omdbAdapter.getAggregatedRatings(imdbId, type) : Promise.resolve(null),
    ]);

    // NOTE: per-field null-guard is critical. OMDb often returns `null` for RT/Metacritic
    // even on successful calls. Spreading those nulls would clobber values filled by
    // other sources (e.g. MDBList backfill) on subsequent re-syncs.
    return {
      ...media,
      ...(traktRating && {
        ratingTrakt: traktRating.rating,
        voteCountTrakt: traktRating.votes,
        watchersCount: traktRating.watchers,
        totalWatchers: traktRating.totalWatchers,
      }),
      ...(omdbRatings?.imdbRating != null && { ratingImdb: omdbRatings.imdbRating }),
      ...(omdbRatings?.imdbVotes != null && { voteCountImdb: omdbRatings.imdbVotes }),
      ...(omdbRatings?.metacritic != null && { ratingMetacritic: omdbRatings.metacritic }),
      ...(omdbRatings?.rottenTomatoes != null && {
        ratingRottenTomatoes: omdbRatings.rottenTomatoes,
      }),
    };
  }

  /** Applies trending score and rank if provided. */
  private applyTrending(
    media: NormalizedMedia,
    trending?: { score: number; rank: number },
  ): NormalizedMedia {
    if (!trending) return media;

    return {
      ...media,
      trendingScore: trending.score,
      trendingRank: trending.rank,
      trendingUpdatedAt: new Date(),
    };
  }

  /** Calculates Ratingo composite scores. */
  private calculateScores(media: NormalizedMedia): NormalizedMedia {
    const scoreInput: ScoreInput = {
      tmdbPopularity: media.popularity,
      traktTotalWatchers: media.totalWatchers ?? 0, // From Trakt /stats endpoint
      traktLiveWatchers: media.watchersCount, // From Trakt /watching endpoint (optional bonus)
      imdbRating: media.ratingImdb,
      traktRating: media.ratingTrakt,
      metacriticRating: media.ratingMetacritic,
      rottenTomatoesRating: media.ratingRottenTomatoes,
      imdbVotes: media.voteCountImdb,
      traktVotes: media.voteCountTrakt,
      releaseDate: media.releaseDate,
      lastAirDate: media.details?.lastAirDate, // For shows: use last episode date for freshness
    };

    const scores = this.scoreCalculator.calculate(scoreInput);

    return {
      ...media,
      ratingoScore: scores.ratingoScore,
      qualityScore: scores.qualityScore,
      popularityScore: scores.popularityScore,
      freshnessScore: scores.freshnessScore,
      ingestionStatus: IngestionStatus.READY,
    };
  }

  /** Classifies content for catalog policy filtering. */
  private classifyMedia(media: NormalizedMedia): NormalizedMedia {
    const genreIds = media.genres?.map((g) => g.tmdbId) ?? [];

    return {
      ...media,
      contentClass: classifyContent({
        originCountries: media.originCountries ?? null,
        originalLanguage: media.originalLanguage ?? null,
        genreIds,
      }),
    };
  }

  /** Persists media to database. */
  private async persist(media: NormalizedMedia, _tmdbId: number): Promise<void> {
    await this.mediaRepository.upsert(media);
  }

  /** Normalizes watch providers and stores in media_watch_offers table. */
  private async normalizeWatchProviders(
    media: NormalizedMedia,
    mediaItem: { id: string } | null,
    logPrefix: string,
  ): Promise<void> {
    if (!media.watchProvidersRaw || Object.keys(media.watchProvidersRaw).length === 0) {
      return;
    }

    if (!mediaItem) {
      this.logger.warn(`${logPrefix} Cannot normalize providers: media item not found`);
      return;
    }

    try {
      const result = await this.normalizationService.normalizeWatchProviders(
        mediaItem.id,
        media.watchProvidersRaw,
      );

      if (result.unmappedCount > 0) {
        this.logger.debug(
          `${logPrefix} Normalized providers: ${result.offersCreated} offers, ${result.unmappedCount} unmapped`,
        );
      }
    } catch (error) {
      // Best-effort: log warning but don't fail the sync
      this.logger.warn(`${logPrefix} Provider normalization failed: ${(error as Error).message}`);
    }
  }

  /** Triggers catalog eligibility evaluation if service available. */
  private async evaluateCatalog(
    mediaItem: { id: string } | null,
    logPrefix: string,
    isTrending: boolean = false,
  ): Promise<void> {
    if (!this.catalogEvaluator) return;
    if (!mediaItem) return;

    try {
      // Always evaluate for catalog context
      await this.catalogEvaluator.evaluateOne({
        mediaItemId: mediaItem.id,
        context: EvaluationContext.CATALOG,
      });

      // Additionally evaluate for trending context if item came from trending pipeline
      // This allows relaxed requirements for trending display surface
      if (isTrending) {
        await this.catalogEvaluator.evaluateOne({
          mediaItemId: mediaItem.id,
          context: EvaluationContext.TRENDING,
        });
        this.logger.debug(`${logPrefix} Evaluated catalog + trending eligibility`);
      } else {
        this.logger.debug(`${logPrefix} Evaluated catalog eligibility`);
      }
    } catch (evalError) {
      this.logger.warn(`${logPrefix} Catalog evaluation failed: ${evalError.message}`);
    }
  }

  /** Marks media as failed in database. */
  private async markAsFailed(tmdbId: number, logPrefix: string): Promise<void> {
    try {
      await this.mediaRepository.updateIngestionStatus(tmdbId, IngestionStatus.FAILED);
    } catch (statusError) {
      this.logger.warn(`${logPrefix} Failed to mark as failed: ${(statusError as Error).message}`);
    }
  }

  /**
   * Emits 'media.synced' event for cross-module consumers.
   *
   * Uses the pre-fetched mediaItem from processMedia to avoid a redundant DB query.
   * Best-effort: logs warning on failure, does not rethrow.
   */
  private async emitMediaSynced(
    tmdbId: number,
    type: MediaType,
    mediaItem: { id: string } | null,
    logPrefix: string,
  ): Promise<void> {
    if (!mediaItem) {
      this.logger.warn(`${logPrefix} Cannot emit media.synced: media item not found`);
      return;
    }

    try {
      const eventType = type === MediaType.MOVIE ? 'movie' : 'show';
      this.eventEmitter.emit(
        MediaSyncedEvent.eventName,
        new MediaSyncedEvent(tmdbId, eventType, mediaItem.id),
      );

      this.logger.debug(
        `${logPrefix} Emitted ${MediaSyncedEvent.eventName} mediaItemId=${mediaItem.id}`,
      );
    } catch (error) {
      // Best-effort: log warning but don't fail the sync
      this.logger.warn(`${logPrefix} Failed to emit media.synced: ${(error as Error).message}`);
    }
  }

  // ============================================================
  // PUBLIC QUERY METHODS (for controller)
  // ============================================================

  /**
   * Checks if media already exists in database.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<ExistingMediaResult | null>} Existing media info or null
   */
  public async findExistingMedia(tmdbId: number): Promise<ExistingMediaResult | null> {
    return this.mediaRepository.findByTmdbId(tmdbId);
  }

  /**
   * Gets media slug by TMDB ID.
   *
   * @param {number} tmdbId - TMDB ID
   * @returns {Promise<string | null>} Slug or null if not found
   */
  public async getSlugByTmdbId(tmdbId: number): Promise<string | null> {
    const media = await this.mediaRepository.findByTmdbId(tmdbId);
    return media?.slug ?? null;
  }

  /**
   * Creates a stub media item and returns info for queueing.
   * Fetches title from TMDB and generates slug.
   *
   * @param {number} tmdbId - TMDB ID
   * @param {MediaType} type - Media type
   * @returns {Promise<MediaStubResult>} Stub info with id, slug, title
   */
  public async createStubForIngestion(tmdbId: number, type: MediaType): Promise<MediaStubResult> {
    // Fetch title from TMDB
    const media =
      type === MediaType.MOVIE
        ? await this.tmdbAdapter.getMovie(tmdbId)
        : await this.tmdbAdapter.getShow(tmdbId);

    const title = media?.title || `TMDB #${tmdbId}`;
    const slug = generateSlug(title, tmdbId);

    const stub = await this.mediaRepository.upsertStub({
      tmdbId,
      type,
      title,
      slug,
      ingestionStatus: IngestionStatus.IMPORTING,
    });

    return {
      id: stub.id,
      slug: stub.slug,
      title,
    };
  }
}
