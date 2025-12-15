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
    const normalizedQuery = this.normalizeListQuery(query);
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
    const normalizedQuery = this.normalizeListQuery(query);
    const {
      limit = CatalogMoviesController.DEFAULT_LIMIT,
      offset = CatalogMoviesController.DEFAULT_OFFSET,
    } = normalizedQuery;
    const movies = await this.movieRepository.findNowPlaying({ ...normalizedQuery, limit, offset });
    const data = await this.catalogUserListEnrich(user, movies);
    const total = movies.total ?? movies.length;
    return {
      data,
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
    const normalizedQuery = this.normalizeListQuery(query);
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
    const normalizedQuery = this.normalizeListQuery(query);
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
  ): Promise<MovieDetails & { userState: UserMediaState | null }> {
    const movie = await this.movieRepository.findBySlug(slug);
    if (!movie) throw new NotFoundException(`Movie with slug "${slug}" not found`);
    return this.catalogUserOneEnrich(user, movie);
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

  /**
   * Normalizes list query by parsing comma-separated genres into an array.
   *
   * @param {T} query - Incoming query DTO
   * @returns {T & { genres?: string[] }} Normalized query
   */
  private normalizeListQuery<T extends CatalogListQueryDto>(query: T): T & { genres?: string[] } {
    const genres =
      query.genres
        ?.split(',')
        .map((g) => g.trim())
        .filter((g) => g.length > 0) || undefined;
    return { ...query, genres } as T & { genres?: string[] };
  }
}
