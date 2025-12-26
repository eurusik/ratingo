import { Module } from '@nestjs/common';
import { DrizzleMediaRepository } from './infrastructure/repositories/drizzle-media.repository';
import { DrizzleGenreRepository } from './infrastructure/repositories/drizzle-genre.repository';
import { DrizzleShowRepository } from './infrastructure/repositories/drizzle-show.repository';
import { DrizzleMovieRepository } from './infrastructure/repositories/drizzle-movie.repository';
import { CatalogMoviesController } from './presentation/controllers/catalog.movies.controller';
import { CatalogShowsController } from './presentation/controllers/catalog.shows.controller';
import { CatalogSearchController } from './presentation/controllers/catalog.search.controller';
import { CatalogProvidersController } from './presentation/controllers/catalog.providers.controller';
import { MEDIA_REPOSITORY } from './domain/repositories/media.repository.interface';
import { SHOW_REPOSITORY } from './domain/repositories/show.repository.interface';
import { GENRE_REPOSITORY } from './domain/repositories/genre.repository.interface';
import { MOVIE_REPOSITORY } from './domain/repositories/movie.repository.interface';
import {
  ProvidersRepository,
  PROVIDERS_REPOSITORY,
} from './infrastructure/repositories/providers.repository';

// Query Objects - Shows
import { TrendingShowsQuery } from './infrastructure/queries/trending-shows.query';
import { ShowDetailsQuery } from './infrastructure/queries/show-details.query';
import { CalendarEpisodesQuery } from './infrastructure/queries/calendar-episodes.query';
import { NewEpisodesQuery } from './infrastructure/queries/new-episodes.query';

// Query Objects - Movies
import { MovieDetailsQuery } from './infrastructure/queries/movie-details.query';
import { TrendingMoviesQuery } from './infrastructure/queries/trending-movies.query';
import { MovieListingsQuery } from './infrastructure/queries/movie-listings.query';

// Query Objects - Mixed Media
import { HeroMediaQuery } from './infrastructure/queries/hero-media.query';
import { CatalogSearchService } from './application/services/catalog-search.service';
import { CatalogImportService } from './application/services/catalog-import.service';
import { TmdbModule } from '../tmdb/tmdb.module';
import { BullModule } from '@nestjs/bullmq';
import { INGESTION_QUEUE } from '../ingestion/ingestion.constants';
import { UserMediaModule } from '../user-media/user-media.module';
import { CatalogUserStateEnricher } from './application/services/catalog-userstate-enricher.service';
import { CardsModule } from '../shared/cards/cards.module';

/**
 * Catalog module.
 */
@Module({
  imports: [
    TmdbModule,
    UserMediaModule,
    CardsModule,
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
  ],
  controllers: [
    CatalogMoviesController,
    CatalogShowsController,
    CatalogSearchController,
    CatalogProvidersController,
  ],
  providers: [
    CatalogSearchService,
    CatalogImportService,
    CatalogUserStateEnricher,
    // Query Objects - Shows
    TrendingShowsQuery,
    ShowDetailsQuery,
    CalendarEpisodesQuery,
    NewEpisodesQuery,

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
    {
      provide: PROVIDERS_REPOSITORY,
      useClass: ProvidersRepository,
    },
  ],
  exports: [MEDIA_REPOSITORY, SHOW_REPOSITORY, GENRE_REPOSITORY, MOVIE_REPOSITORY],
})
export class CatalogModule {}
