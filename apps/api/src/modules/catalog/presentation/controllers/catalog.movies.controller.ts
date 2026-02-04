import { Controller, Get, Inject, Param, Query, UseFilters, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CATALOG_DEFAULT_NEW_RELEASE_DAYS,
  CATALOG_DEFAULT_DIGITAL_DAYS,
} from '../../../../common/constants';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { CardEnrichmentService } from '../../../shared/cards/application/card-enrichment.service';
import { CARD_LIST_CONTEXT } from '../../../shared/cards/domain/card.constants';
import type { UserMediaState } from '../../../user-media/domain/entities/user-media-state.entity';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { MovieDetailsService } from '../../application/services/movie-details.service';
import {
  type IMovieRepository,
  MOVIE_REPOSITORY,
} from '../../domain/repositories/movie.repository.interface';
import type { EnrichedMovieDetails } from '../../domain/types';
import { CatalogListQueryWithDaysDto } from '../dtos/catalog-list-query-with-days.dto';
import { CatalogListQueryDto } from '../dtos/catalog-list-query.dto';
import { MovieResponseDto } from '../dtos/movie-response.dto';
import { PaginatedMovieResponseDto } from '../dtos/paginated-movie-response.dto';
import { CatalogDomainExceptionFilter } from '../filters';
import { buildPaginationMeta } from '../utils/pagination.utils';
import {
  applyPaginationDefaults,
  normalizeListQuery,
  resolveDaysBack,
} from '../utils/query-normalizer';

/**
 * Public movie catalog endpoints (trending, listings, details).
 */
@ApiTags('Public: Catalog')
@UseGuards(OptionalJwtAuthGuard)
@UseFilters(CatalogDomainExceptionFilter)
@Controller('catalog/movies')
export class CatalogMoviesController {
  /**
   * Public movie catalog endpoints (trending, listings, details).
   */
  constructor(
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    private readonly userStateEnricher: CatalogUserStateEnricher,
    private readonly cards: CardEnrichmentService,
    private readonly movieDetailsService: MovieDetailsService,
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
    const normalizedQuery = applyPaginationDefaults(normalizeListQuery(query));
    const movies = await this.movieRepository.findTrending(normalizedQuery);
    const data = await this.catalogUserListEnrich(user, movies);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.TRENDING_LIST,
    });

    return { data: withCards, meta: buildPaginationMeta(normalizedQuery, movies) };
  }

  /**
   * Returns popular movies list with pagination.
   * Shows historically popular movies without freshness gate.
   *
   * @param {CatalogListQueryDto} query - Pagination params
   * @param {{ id: string } | null} user - Optional authenticated user
   * @returns {Promise<PaginatedMovieResponseDto>} Paginated popular movies enriched with user state
   */
  @Get('popular')
  @ApiOperation({
    summary: 'Popular movies (Hits)',
    description: 'Returns historically popular movies. Includes classics.',
  })
  @ApiOkResponse({ type: PaginatedMovieResponseDto })
  async getPopularMovies(
    @Query() query: CatalogListQueryDto,
    @CurrentUser() user: { id: string } | null,
  ): Promise<PaginatedMovieResponseDto> {
    const normalizedQuery = applyPaginationDefaults(normalizeListQuery(query));
    const movies = await this.movieRepository.findPopular(normalizedQuery);
    const data = await this.catalogUserListEnrich(user, movies);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.POPULAR_LIST,
    });

    return { data: withCards, meta: buildPaginationMeta(normalizedQuery, movies) };
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
    const normalizedQuery = applyPaginationDefaults(normalizeListQuery(query));
    const movies = await this.movieRepository.findNowPlaying(normalizedQuery);
    const data = await this.catalogUserListEnrich(user, movies);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.IN_THEATERS_LIST,
    });

    return { data: withCards, meta: buildPaginationMeta(normalizedQuery, movies) };
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
    const normalizedQuery = applyPaginationDefaults(normalizeListQuery(query));
    const daysBack = resolveDaysBack(normalizedQuery.daysBack, CATALOG_DEFAULT_NEW_RELEASE_DAYS);
    const movies = await this.movieRepository.findNewReleases({ ...normalizedQuery, daysBack });
    const data = await this.catalogUserListEnrich(user, movies);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.NEW_RELEASES_LIST,
    });

    return { data: withCards, meta: buildPaginationMeta(normalizedQuery, movies) };
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
    const normalizedQuery = applyPaginationDefaults(normalizeListQuery(query));
    const daysBack = resolveDaysBack(normalizedQuery.daysBack, CATALOG_DEFAULT_DIGITAL_DAYS);
    const movies = await this.movieRepository.findNewOnDigital({ ...normalizedQuery, daysBack });
    const data = await this.catalogUserListEnrich(user, movies);
    const withCards = this.cards.enrichCatalogItems(data, {
      context: CARD_LIST_CONTEXT.NEW_ON_STREAMING_LIST,
    });

    return { data: withCards, meta: buildPaginationMeta(normalizedQuery, movies) };
  }

  /**
   * Returns movie details by slug.
   *
   * @param {string} slug - Movie slug
   * @param {{ id: string } | null} user - Optional authenticated user
   * @returns {Promise<EnrichedMovieDetails>} Movie details enriched with user state
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
  ): Promise<EnrichedMovieDetails> {
    return this.movieDetailsService.getBySlug(slug, user?.id);
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
}
