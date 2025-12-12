import {
  Controller,
  Get,
  Query,
  Inject,
  DefaultValuePipe,
  ParseIntPipe,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
  ApiResponse,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  IMovieRepository,
  MOVIE_REPOSITORY,
} from '../../domain/repositories/movie.repository.interface';
import {
  IShowRepository,
  SHOW_REPOSITORY,
  CalendarEpisode,
} from '../../domain/repositories/show.repository.interface';
import { MovieResponseDto } from '../dtos/movie-response.dto';
import { ShowResponseDto } from '../dtos/show-response.dto';
import { PaginatedMovieResponseDto } from '../dtos/paginated-movie-response.dto';
import { CalendarResponseDto } from '../dtos/calendar-response.dto';
import {
  TrendingShowsQueryDto,
  TrendingShowsResponseDto,
  TrendingMoviesResponseDto,
} from '../dtos/trending.dto';
import { CatalogSearchService } from '../../application/services/catalog-search.service';
import { SearchResponseDto } from '../dtos/search.dto';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { CatalogUserStateEnricher } from '../../application/services/catalog-userstate-enricher.service';
import {
  LISTING_SORT,
  LISTING_SORT_VALUES,
  ListingSort,
  OffsetPaginationQueryDto,
} from '../dtos/pagination.dto';

class MoviesNowPlayingQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({
    required: false,
    enum: LISTING_SORT_VALUES,
    default: LISTING_SORT.POPULARITY,
    description: 'Sort order',
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
    description: 'Sort order',
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
    description: 'Sort order',
  })
  @IsOptional()
  sort?: ListingSort;
}

/**
 * REST controller for catalog endpoints.
 * Provides endpoints for browsing movies and shows.
 */
@ApiTags('Public: Catalog')
@UseGuards(OptionalJwtAuthGuard)
@Controller('catalog')
export class CatalogController {
  constructor(
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
    private readonly catalogSearchService: CatalogSearchService,
    private readonly userStateEnricher: CatalogUserStateEnricher,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Search movies and shows' })
  @ApiResponse({ status: 200, type: SearchResponseDto })
  async search(@Query('query') query: string): Promise<SearchResponseDto> {
    return this.catalogSearchService.search(query);
  }

  @Get('shows/trending')
  @ApiOperation({
    summary: 'Trending TV shows',
    description: 'Returns trending shows sorted by popularity and rating.',
  })
  @ApiOkResponse({ type: TrendingShowsResponseDto })
  async getTrendingShows(
    @Query() query: TrendingShowsQueryDto,
    @CurrentUser() user: { id: string } | null,
  ): Promise<TrendingShowsResponseDto> {
    const shows = await this.showRepository.findTrending(query);
    const data = await this.catalogUserListEnrich(user, shows, 'show');
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    return {
      data,
      meta: {
        count: shows.length,
        limit,
        offset,
      },
    };
  }

  @Get('movies/trending')
  @ApiOperation({
    summary: 'Trending movies',
    description: 'Returns trending movies sorted by popularity and rating.',
  })
  @ApiOkResponse({ type: TrendingMoviesResponseDto })
  async getTrendingMovies(
    @Query() query: TrendingShowsQueryDto,
    @CurrentUser() user: { id: string } | null,
  ): Promise<TrendingMoviesResponseDto> {
    const movies = await this.movieRepository.findTrending(query);
    const data = await this.catalogUserListEnrich(user, movies, 'movie');
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;

    return {
      data,
      meta: {
        count: movies.length,
        limit,
        offset,
      },
    };
  }

  @Get('shows/calendar')
  @ApiOperation({
    summary: 'Global release calendar for TV shows',
    description: 'Returns episodes airing within the specified date range. Groups episodes by day.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    type: String,
    description: 'Start date (ISO string). Default: today.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to include (default: 7).',
  })
  @ApiOkResponse({ type: CalendarResponseDto })
  async getCalendar(
    @Query('startDate') startDateString?: string,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days?: number,
  ): Promise<CalendarResponseDto> {
    const start = startDateString ? new Date(startDateString) : new Date();

    const end = new Date(start);
    end.setDate(end.getDate() + (days || 7));

    const episodes = await this.showRepository.findEpisodesByDateRange(start, end);

    const grouped = this.groupEpisodesByDate(episodes);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      days: grouped,
    };
  }

  private groupEpisodesByDate(episodes: CalendarEpisode[]) {
    // ... same implementation ...
    const map = new Map<string, any[]>(); // using any[] to avoid strict type check here for brevity

    for (const ep of episodes) {
      const dateKey = ep.airDate.toISOString().split('T')[0];
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(ep);
    }

    const result = [];
    const sortedKeys = Array.from(map.keys()).sort();

    for (const date of sortedKeys) {
      result.push({
        date,
        episodes: map.get(date),
      });
    }

    return result;
  }

  @Get('movies/now-playing')
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
    const movies = await this.movieRepository.findNowPlaying({
      limit,
      offset,
      sort,
    });
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

  @Get('movies/new-releases')
  @ApiOperation({
    summary: 'Movies recently released in theaters',
    description:
      'Returns movies with theatrical release in the specified period, sorted by popularity.',
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
  @ApiQuery({
    name: 'daysBack',
    required: false,
    type: Number,
    description: 'Days to look back (default: 30)',
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
    const movies = await this.movieRepository.findNewReleases({
      limit,
      offset,
      daysBack,
      sort,
    });
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

  @Get('movies/new-on-digital')
  @ApiOperation({
    summary: 'Movies recently released on digital platforms',
    description: 'Returns movies with digital release in the last 14 days, sorted by popularity.',
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
  @ApiQuery({
    name: 'daysBack',
    required: false,
    type: Number,
    description: 'Days to look back (default: 14)',
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
    const movies = await this.movieRepository.findNewOnDigital({
      limit,
      offset,
      daysBack,
      sort,
    });
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

  @Get('movies/:slug')
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
    if (!movie) {
      throw new NotFoundException(`Movie with slug "${slug}" not found`);
    }
    const enriched = await this.catalogUserOneEnrich(user, movie);
    return enriched as any;
  }

  @Get('shows/:slug')
  @ApiOperation({
    summary: 'Get show details by slug',
    description: 'Returns full show details including seasons list.',
  })
  @ApiOkResponse({ type: ShowResponseDto })
  async getShowBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<ShowResponseDto> {
    const show = await this.showRepository.findBySlug(slug);
    if (!show) {
      throw new NotFoundException(`Show with slug "${slug}" not found`);
    }
    const enriched = await this.catalogUserOneEnrich(user, show);
    return enriched as any;
  }

  private async catalogUserListEnrich<T extends { id: string }>(
    user: { id: string } | null | undefined,
    items: T[],
    type: 'movie' | 'show',
  ): Promise<Array<T & { type: 'movie' | 'show'; userState: any | null }>> {
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
