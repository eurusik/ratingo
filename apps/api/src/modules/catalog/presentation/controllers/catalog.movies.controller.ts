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
  ) {}

  @Get('trending')
  /**
   * Returns trending movies list with pagination.
   *
   * @param query - Pagination params
   * @param user - Optional authenticated user
   * @returns Paginated trending movies enriched with user state
   */
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
    const total = (movies as any).total ?? movies.length;
    const data = await this.catalogUserListEnrich(user, movies, 'movie');

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

  @Get('now-playing')
  /**
   * Lists movies currently in theaters with optional sort.
   *
   * @param query - Pagination and sort params
   * @param user - Optional authenticated user
   * @returns Paginated now-playing movies enriched with user state
   */
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
    const data = await this.catalogUserListEnrich(user, movies, 'movie');
    const total = (movies as any).total ?? movies.length;
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

  @Get('new-releases')
  /**
   * Lists recent theatrical releases within a window.
   *
   * @param query - Pagination, daysBack, sort params
   * @param user - Optional authenticated user
   * @returns Paginated new releases enriched with user state
   */
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
      daysBack = CatalogMoviesController.DEFAULT_NEW_RELEASE_DAYS,
    } = normalizedQuery;
    const movies = await this.movieRepository.findNewReleases({
      ...normalizedQuery,
      limit,
      offset,
      daysBack,
    });
    const data = await this.catalogUserListEnrich(user, movies, 'movie');
    const total = (movies as any).total ?? movies.length;
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

  @Get('new-on-digital')
  /**
   * Lists movies recently released on digital platforms.
   *
   * @param query - Pagination, daysBack, sort params
   * @param user - Optional authenticated user
   * @returns Paginated digital releases enriched with user state
   */
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
      daysBack = CatalogMoviesController.DEFAULT_DIGITAL_DAYS,
    } = normalizedQuery;
    const movies = await this.movieRepository.findNewOnDigital({
      ...normalizedQuery,
      limit,
      offset,
      daysBack,
    });
    const data = await this.catalogUserListEnrich(user, movies, 'movie');
    const total = (movies as any).total ?? movies.length;
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

  @Get(':slug')
  /**
   * Returns movie details by slug.
   *
   * @param slug - Movie slug
   * @param user - Optional authenticated user
   * @returns Movie details enriched with user state
   */
  @ApiOperation({
    summary: 'Get movie details by slug',
    description: 'Returns full movie details including genres and stats.',
  })
  @ApiOkResponse({ type: MovieResponseDto })
  async getMovieBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<MovieResponseDto> {
    const movie = await this.movieRepository.findBySlug(slug);
    if (!movie) throw new NotFoundException(`Movie with slug "${slug}" not found`);
    return (await this.catalogUserOneEnrich(user, movie)) as any;
  }

  private async catalogUserListEnrich<T extends { id: string }>(
    user: { id: string } | null | undefined,
    items: T[],
    type: 'movie',
  ): Promise<Array<T & { type: 'movie'; userState: any | null }>> {
    const typed = items.map((i) => ({ ...i, type, userState: null as any }));
    return this.userStateEnricher.enrichList(user?.id, typed);
  }

  private async catalogUserOneEnrich<T extends { id: string }>(
    user: { id: string } | null | undefined,
    item: T,
  ): Promise<T & { userState: any | null }> {
    return this.userStateEnricher.enrichOne(user?.id, { ...item, userState: null });
  }

  private normalizeListQuery<T extends CatalogListQueryDto>(query: T): T & { genres?: string[] } {
    const genres =
      query.genres
        ?.split(',')
        .map((g) => g.trim())
        .filter((g) => g.length > 0) || undefined;
    return { ...query, genres } as T & { genres?: string[] };
  }
}
