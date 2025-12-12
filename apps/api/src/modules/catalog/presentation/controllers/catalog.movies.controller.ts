import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiPropertyOptional,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  IMovieRepository,
  MOVIE_REPOSITORY,
} from '../../domain/repositories/movie.repository.interface';
import { MovieResponseDto } from '../dtos/movie-response.dto';
import { PaginatedMovieResponseDto } from '../dtos/paginated-movie-response.dto';
import {
  LISTING_SORT,
  LISTING_SORT_VALUES,
  ListingSort,
  OffsetPaginationQueryDto,
} from '../dtos/pagination.dto';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import { TrendingMoviesResponseDto } from '../dtos/trending.dto';

class MoviesNowPlayingQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({
    required: false,
    enum: LISTING_SORT_VALUES,
    default: LISTING_SORT.POPULARITY,
    description: "Sort order. For sort='popularity' this uses raw media_items.popularity.",
  })
  @IsOptional()
  sort?: ListingSort;
}

class MoviesNewReleasesQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ default: 30, description: 'Days to look back' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  daysBack?: number = 30;

  @ApiPropertyOptional({
    required: false,
    enum: LISTING_SORT_VALUES,
    default: LISTING_SORT.POPULARITY,
    description:
      "Sort order. For sort='popularity' this uses aggregated media_stats.popularity_score.",
  })
  @IsOptional()
  sort?: ListingSort;
}

class MoviesNewOnDigitalQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ default: 14, description: 'Days to look back for digital releases' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  daysBack?: number = 14;

  @ApiPropertyOptional({
    required: false,
    enum: LISTING_SORT_VALUES,
    default: LISTING_SORT.POPULARITY,
    description:
      "Sort order. For sort='popularity' this uses aggregated media_stats.popularity_score.",
  })
  @IsOptional()
  sort?: ListingSort;
}

@ApiTags('Public: Catalog')
@UseGuards(OptionalJwtAuthGuard)
@Controller('catalog/movies')
export class CatalogMoviesController {
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
    @Query() query: OffsetPaginationQueryDto,
    @CurrentUser() user: { id: string } | null,
  ): Promise<PaginatedMovieResponseDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const movies = await this.movieRepository.findTrending({ limit, offset });
    const data = await this.catalogUserListEnrich(user, movies, 'movie');

    return {
      data,
      meta: {
        count: movies.length,
        limit,
        offset,
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
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items (default: 20)',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Offset for pagination (default: 0)',
  })
  @ApiOkResponse({ type: PaginatedMovieResponseDto })
  async getNowPlaying(
    @Query() query: MoviesNowPlayingQueryDto,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<PaginatedMovieResponseDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const sort = query.sort ?? LISTING_SORT.POPULARITY;
    const movies = await this.movieRepository.findNowPlaying({ limit, offset, sort });
    const data = await this.catalogUserListEnrich(user, movies, 'movie');

    return {
      data,
      meta: { count: movies.length, limit, offset },
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
    @Query() query: MoviesNewReleasesQueryDto,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<PaginatedMovieResponseDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const daysBack = query.daysBack ?? 30;
    const sort = query.sort ?? LISTING_SORT.POPULARITY;
    const movies = await this.movieRepository.findNewReleases({ limit, offset, daysBack, sort });
    const data = await this.catalogUserListEnrich(user, movies, 'movie');

    return {
      data,
      meta: { count: movies.length, limit, offset },
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
    @Query() query: MoviesNewOnDigitalQueryDto,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<PaginatedMovieResponseDto> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const daysBack = query.daysBack ?? 14;
    const sort = query.sort ?? LISTING_SORT.POPULARITY;
    const movies = await this.movieRepository.findNewOnDigital({ limit, offset, daysBack, sort });
    const data = await this.catalogUserListEnrich(user, movies, 'movie');

    return {
      data,
      meta: { count: movies.length, limit, offset },
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
}
