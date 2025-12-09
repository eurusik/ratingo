import { Controller, Get, Query, Inject, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IMovieRepository, MOVIE_REPOSITORY } from '../../domain/repositories/movie.repository.interface';
import { IShowRepository, SHOW_REPOSITORY, CalendarEpisode } from '../../domain/repositories/show.repository.interface';

/**
 * REST controller for catalog endpoints.
 * Provides endpoints for browsing movies and shows.
 */
@ApiTags('Public: Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
  ) {}

  @Get('shows/calendar')
  @ApiOperation({
    summary: 'Global release calendar for TV shows',
    description: 'Returns episodes airing within the specified date range. Groups episodes by day.',
  })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Start date (ISO string). Default: today.' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to include (default: 7).' })
  async getCalendar(
    @Query('startDate') startDateString?: string,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days?: number,
  ) {
    const start = startDateString ? new Date(startDateString) : new Date();
    // Normalize to start of the day UTC?? Or keep as provided.
    // Let's assume input is correct point in time.
    
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
    const map = new Map<string, CalendarEpisode[]>();
    
    for (const ep of episodes) {
      const dateKey = ep.airDate.toISOString().split('T')[0]; // YYYY-MM-DD
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
    description: 'Returns movies currently playing in theaters. Data is synced from TMDB now_playing endpoint.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination (default: 0)' })
  async getNowPlaying(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const movies = await this.movieRepository.findNowPlaying({
      limit: limit || 20,
      offset: offset || 0,
    });

    return {
      data: movies,
      meta: {
        count: movies.length,
        limit: limit || 20,
        offset: offset || 0,
      },
    };
  }

  @Get('movies/new-releases')
  @ApiOperation({
    summary: 'Movies recently released in theaters',
    description: 'Returns movies with theatrical release in the specified period, sorted by popularity.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination (default: 0)' })
  @ApiQuery({ name: 'daysBack', required: false, type: Number, description: 'Days to look back (default: 30)' })
  async getNewReleases(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('daysBack') daysBack?: number,
  ) {
    const movies = await this.movieRepository.findNewReleases({
      limit: limit || 20,
      offset: offset || 0,
      daysBack: daysBack || 30,
    });

    return {
      data: movies,
      meta: {
        count: movies.length,
        limit: limit || 20,
        offset: offset || 0,
      },
    };
  }

  @Get('movies/new-on-digital')
  @ApiOperation({
    summary: 'Movies recently released on digital platforms',
    description: 'Returns movies with digital release in the last 14 days, sorted by popularity.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of items (default: 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset for pagination (default: 0)' })
  @ApiQuery({ name: 'daysBack', required: false, type: Number, description: 'Days to look back (default: 14)' })
  async getNewOnDigital(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('daysBack') daysBack?: number,
  ) {
    const movies = await this.movieRepository.findNewOnDigital({
      limit: limit || 20,
      offset: offset || 0,
      daysBack: daysBack || 14,
    });

    return {
      data: movies,
      meta: {
        count: movies.length,
        limit: limit || 20,
        offset: offset || 0,
      },
    };
  }
}
