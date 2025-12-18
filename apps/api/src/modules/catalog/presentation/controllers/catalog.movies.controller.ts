import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IMovieRepository,
  MovieDetails,
  MOVIE_REPOSITORY,
} from '../../domain/repositories/movie.repository.interface';
import { MovieResponseDto } from '../dtos/movie-response.dto';
import { PaginatedMovieResponseDto } from '../dtos/paginated-movie-response.dto';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { TrendingMoviesResponseDto } from '../dtos/trending.dto';
import { CatalogListQueryDto } from '../dtos/catalog-list-query.dto';
import { CatalogListQueryWithDaysDto } from '../dtos/catalog-list-query-with-days.dto';
import { CardEnrichmentService } from '../../../shared/cards/application/card-enrichment.service';
import { CARD_LIST_CONTEXT } from '../../../shared/cards/domain/card.constants';
import type { UserMediaState } from '../../../user-media/domain/entities/user-media-state.entity';
import { normalizeListQuery } from '../utils/query-normalizer';
import { buildCardMeta, extractContinuePoint } from '../../../shared/cards/domain/selectors';
import { isHitQuality } from '../../../shared/cards/domain/quality.utils';
import { computeReleaseStatus } from '../../domain/utils/release-status.utils';
import { ReleaseStatus } from '../../../../common/enums/release-status.enum';
import { computeMovieVerdict, MovieVerdict, RATING_SOURCE } from '../../../shared/verdict';

/**
 * Public movie catalog endpoints (trending, listings, details).
 */
@ApiTags('Public: Catalog')
@UseGuards(OptionalJwtAuthGuard)
@Controller('catalog/movies')
export class CatalogMoviesController {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly DEFAULT_OFFSET = 0;
  private static readonly DEFAULT_NEW_RELEASE_DAYS = 30;
  private static readonly DEFAULT_DIGITAL_DAYS = 14;

  /**
   * Public movie catalog endpoints (trending, listings, details).
   */
  constructor(
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    private readonly userStateEnricher: CatalogUserStateEnricher,
    private readonly cards: CardEnrichmentService,
  ) {}

  /**
   * Returns trending movies list with pagination.
   *
   * @param {CatalogListQueryDto} query - Pagination params
   * @param {{ id: string } | null} user - Optional authenticated user
   * @returns {Promise<PaginatedMovieResponseDto>} Paginated trending movies enriched with user state
   */
  @Get('trending')
  @ApiOperation({
    summary: 'Trending movies',
    description: 'Returns trending movies sorted by popularity and rating.',
  })
  @ApiOkResponse({ type: PaginatedMovieResponseDto })
  async getTrendingMovies(
    @Query() query: CatalogListQueryDto,
    @CurrentUser() user: { id: string } | null,
  ): Promise<PaginatedMovieResponseDto> {
    const normalizedQuery = normalizeListQuery(query);
    const movies = await this.movieRepository.findTrending(normalizedQuery);
    const limit = normalizedQuery.limit ?? CatalogMoviesController.DEFAULT_LIMIT;
    const offset = normalizedQuery.offset ?? CatalogMoviesController.DEFAULT_OFFSET;
    const total = movies.total ?? movies.length;
    const data = await this.catalogUserListEnrich(user, movies);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.TRENDING_LIST,
    });

    return {
      data: withCards,
      meta: {
        count: movies.length,
        total,
        limit,
        offset,
        hasMore: offset + movies.length < total,
      },
    };
  }

  /**
   * Lists movies currently in theaters with optional sort.
   *
   * @param {CatalogListQueryDto} query - Pagination and sort params
   * @param {{ id: string } | null} user - Optional authenticated user
   * @returns {Promise<PaginatedMovieResponseDto>} Paginated now-playing movies enriched with user state
   */
  @Get('now-playing')
  @ApiOperation({
    summary: 'Movies currently in theaters',
    description:
      'Returns movies currently playing in theaters. Data is synced from TMDB now_playing endpoint.',
  })
  @ApiOkResponse({ type: PaginatedMovieResponseDto })
  async getNowPlaying(
    @Query() query: CatalogListQueryDto,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<PaginatedMovieResponseDto> {
    const normalizedQuery = normalizeListQuery(query);
    const {
      limit = CatalogMoviesController.DEFAULT_LIMIT,
      offset = CatalogMoviesController.DEFAULT_OFFSET,
    } = normalizedQuery;
    const movies = await this.movieRepository.findNowPlaying({ ...normalizedQuery, limit, offset });
    const data = await this.catalogUserListEnrich(user, movies);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.IN_THEATERS_LIST,
    });
    const total = movies.total ?? movies.length;
    return {
      data: withCards,
      meta: {
        count: movies.length,
        total,
        limit,
        offset,
        hasMore: offset + movies.length < total,
      },
    };
  }

  /**
   * Lists recent theatrical releases within a window.
   *
   * @param {CatalogListQueryWithDaysDto} query - Pagination, daysBack, sort params
   * @param {{ id: string } | null} user - Optional authenticated user
   * @returns {Promise<PaginatedMovieResponseDto>} Paginated new releases enriched with user state
   */
  @Get('new-releases')
  @ApiOperation({
    summary: 'Movies recently released in theaters',
    description:
      'Returns movies with theatrical release in the specified period, sorted by popularity.',
  })
  @ApiOkResponse({ type: PaginatedMovieResponseDto })
  async getNewReleases(
    @Query() query: CatalogListQueryWithDaysDto,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<PaginatedMovieResponseDto> {
    const normalizedQuery = normalizeListQuery(query);
    const {
      limit = CatalogMoviesController.DEFAULT_LIMIT,
      offset = CatalogMoviesController.DEFAULT_OFFSET,
    } = normalizedQuery;
    const daysBack =
      normalizedQuery.daysBack !== undefined && normalizedQuery.daysBack > 0
        ? normalizedQuery.daysBack
        : CatalogMoviesController.DEFAULT_NEW_RELEASE_DAYS;
    const movies = await this.movieRepository.findNewReleases({
      ...normalizedQuery,
      limit,
      offset,
      daysBack,
    });
    const data = await this.catalogUserListEnrich(user, movies);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.NEW_RELEASES_LIST,
    });
    const total = movies.total ?? movies.length;
    return {
      data: withCards,
      meta: {
        count: movies.length,
        total,
        limit,
        offset,
        hasMore: offset + movies.length < total,
      },
    };
  }

  /**
   * Lists movies recently released on digital platforms.
   *
   * @param {CatalogListQueryWithDaysDto} query - Pagination, daysBack, sort params
   * @param {{ id: string } | null} user - Optional authenticated user
   * @returns {Promise<PaginatedMovieResponseDto>} Paginated digital releases enriched with user state
   */
  @Get('new-on-digital')
  @ApiOperation({
    summary: 'Movies recently released on digital platforms',
    description: 'Returns movies with digital release in the last 14 days, sorted by popularity.',
  })
  @ApiOkResponse({ type: PaginatedMovieResponseDto })
  async getNewOnDigital(
    @Query() query: CatalogListQueryWithDaysDto,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<PaginatedMovieResponseDto> {
    const normalizedQuery = normalizeListQuery(query);
    const {
      limit = CatalogMoviesController.DEFAULT_LIMIT,
      offset = CatalogMoviesController.DEFAULT_OFFSET,
    } = normalizedQuery;
    const daysBack =
      normalizedQuery.daysBack !== undefined && normalizedQuery.daysBack > 0
        ? normalizedQuery.daysBack
        : CatalogMoviesController.DEFAULT_DIGITAL_DAYS;
    const movies = await this.movieRepository.findNewOnDigital({
      ...normalizedQuery,
      limit,
      offset,
      daysBack,
    });
    const data = await this.catalogUserListEnrich(user, movies);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.NEW_ON_STREAMING_LIST,
    });
    const total = movies.total ?? movies.length;
    return {
      data: withCards,
      meta: {
        count: movies.length,
        total,
        limit,
        offset,
        hasMore: offset + movies.length < total,
      },
    };
  }

  /**
   * Returns movie details by slug.
   *
   * @param {string} slug - Movie slug
   * @param {{ id: string } | null} user - Optional authenticated user
   * @returns {Promise<MovieResponseDto>} Movie details enriched with user state
   */
  @Get(':slug')
  @ApiOperation({
    summary: 'Get movie details by slug',
    description: 'Returns full movie details including genres and stats.',
  })
  @ApiOkResponse({ type: MovieResponseDto })
  async getMovieBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<
    MovieDetails & {
      userState: UserMediaState | null;
      releaseStatus: ReleaseStatus;
      verdict: MovieVerdict;
    }
  > {
    const movie = await this.movieRepository.findBySlug(slug);
    if (!movie) throw new NotFoundException(`Movie with slug "${slug}" not found`);
    const enriched = await this.catalogUserOneEnrich(user, movie);

    // Build card metadata for details page
    const card = buildCardMeta(
      {
        hasUserEntry: Boolean(enriched.userState),
        userState: enriched.userState?.state ?? null,
        continuePoint: extractContinuePoint(enriched.userState?.progress ?? null),
        hasNewEpisode: false, // Movies don't have episodes
        isNewRelease: this.isNewRelease(movie.releaseDate),
        isHit: isHitQuality(movie.externalRatings),
        trendDelta: null,
        isTrending: false,
      },
      CARD_LIST_CONTEXT.DEFAULT,
    );

    // Compute release status on the backend
    const releaseStatus = computeReleaseStatus(
      movie.releaseDate,
      movie.theatricalReleaseDate,
      movie.digitalReleaseDate,
    );

    // Compute verdict for details page
    const ratings = movie.externalRatings;
    const { rating: bestRating, source: bestRatingSource } = this.getBestRating(ratings);

    const verdict = computeMovieVerdict({
      releaseStatus,
      ratingoScore: movie.stats?.ratingoScore ?? null,
      avgRating: bestRating?.rating ?? null,
      voteCount: bestRating?.voteCount ?? null,
      ratingSource: bestRatingSource,
      badgeKey: card?.badgeKey ?? null,
      popularity: movie.stats?.popularityScore ?? null,
      releaseDate: movie.releaseDate ?? null,
    });

    return { ...enriched, card, releaseStatus, verdict };
  }

  /**
   * Gets the best available rating source (IMDb > Trakt > TMDB).
   */
  private getBestRating(
    ratings: {
      imdb?: { rating: number; voteCount?: number } | null;
      trakt?: { rating: number; voteCount?: number } | null;
      tmdb?: { rating: number; voteCount?: number } | null;
    } | null,
  ): {
    rating: { rating: number; voteCount?: number } | null;
    source: (typeof RATING_SOURCE)[keyof typeof RATING_SOURCE] | null;
  } {
    if (ratings?.imdb) return { rating: ratings.imdb, source: RATING_SOURCE.IMDB };
    if (ratings?.trakt) return { rating: ratings.trakt, source: RATING_SOURCE.TRAKT };
    if (ratings?.tmdb) return { rating: ratings.tmdb, source: RATING_SOURCE.TMDB };
    return { rating: null, source: null };
  }

  /**
   * Checks if movie is a new release (within 14 days).
   */
  private isNewRelease(releaseDate: Date | null): boolean {
    if (!releaseDate) return false;
    const now = new Date();
    const diffMs = now.getTime() - new Date(releaseDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 14;
  }

  /**
   * Enriches a list of catalog items with user state.
   *
   * @param {{ id: string } | null | undefined} user - Optional authenticated user
   * @param {T[]} items - Catalog items to enrich
   * @returns {Promise<Array<T & { userState: UserMediaState | null }>>} Enriched list
   */
  private async catalogUserListEnrich<T extends { id: string }>(
    user: { id: string } | null | undefined,
    items: T[],
  ): Promise<Array<T & { userState: UserMediaState | null }>> {
    const typed = items.map((i) => ({ ...i, userState: null }));
    return this.userStateEnricher.enrichList(user?.id, typed);
  }

  /**
   * Enriches a single catalog item with user state.
   *
   * @param {{ id: string } | null | undefined} user - Optional authenticated user
   * @param {T} item - Catalog item to enrich
   * @returns {Promise<T & { userState: any | null }>} Enriched item
   */
  private async catalogUserOneEnrich<T extends { id: string }>(
    user: { id: string } | null | undefined,
    item: T,
  ): Promise<T & { userState: UserMediaState | null }> {
    return this.userStateEnricher.enrichOne(user?.id, { ...item, userState: null });
  }
}
