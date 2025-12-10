import { Module } from '@nestjs/common';
import { DrizzleMediaRepository } from './infrastructure/repositories/drizzle-media.repository';
import { DrizzleGenreRepository } from './infrastructure/repositories/drizzle-genre.repository';
import { DrizzleShowRepository } from './infrastructure/repositories/drizzle-show.repository';
import { DrizzleMovieRepository } from './infrastructure/repositories/drizzle-movie.repository';
import { CatalogController } from './presentation/controllers/catalog.controller';
import { MEDIA_REPOSITORY } from './domain/repositories/media.repository.interface';
import { SHOW_REPOSITORY } from './domain/repositories/show.repository.interface';
import { GENRE_REPOSITORY } from './domain/repositories/genre.repository.interface';
import { MOVIE_REPOSITORY } from './domain/repositories/movie.repository.interface';

// Query Objects - Shows
import { TrendingShowsQuery } from './infrastructure/queries/trending-shows.query';
import { ShowDetailsQuery } from './infrastructure/queries/show-details.query';
import { CalendarEpisodesQuery } from './infrastructure/queries/calendar-episodes.query';

// Query Objects - Movies
import { MovieDetailsQuery } from './infrastructure/queries/movie-details.query';
import { TrendingMoviesQuery } from './infrastructure/queries/trending-movies.query';
import { MovieListingsQuery } from './infrastructure/queries/movie-listings.query';

// Query Objects - Mixed Media
import { HeroMediaQuery } from './infrastructure/queries/hero-media.query';

@Module({
  controllers: [CatalogController],
  providers: [
    // Query Objects - Shows
    TrendingShowsQuery,
    ShowDetailsQuery,
    CalendarEpisodesQuery,
    
    // Query Objects - Movies
    MovieDetailsQuery,
    TrendingMoviesQuery,
    MovieListingsQuery,
    
    // Query Objects - Mixed Media
    HeroMediaQuery,
    
    // Repositories
    {
      provide: GENRE_REPOSITORY,
      useClass: DrizzleGenreRepository,
    },
    {
      provide: MEDIA_REPOSITORY,
      useClass: DrizzleMediaRepository,
    },
    {
      provide: SHOW_REPOSITORY,
      useClass: DrizzleShowRepository,
    },
    {
      provide: MOVIE_REPOSITORY,
      useClass: DrizzleMovieRepository,
    },
  ],
  exports: [MEDIA_REPOSITORY, SHOW_REPOSITORY, GENRE_REPOSITORY, MOVIE_REPOSITORY],
})
export class CatalogModule {}
