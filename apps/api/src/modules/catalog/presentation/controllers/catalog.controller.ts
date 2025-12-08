import { Controller, Get, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IMovieRepository, MOVIE_REPOSITORY } from '../../domain/repositories/movie.repository.interface';

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
  ) {}

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
