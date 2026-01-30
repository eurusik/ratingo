import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { HERO_REPOSITORY } from '../home/public';
import { INGESTION_QUEUE } from '../ingestion/public';
import { CardsModule } from '../shared/cards/cards.module';
import { TmdbModule } from '../tmdb/public';
import { UserMediaModule } from '../user-media/user-media.module';

import { CatalogImportService } from './application/services/catalog-import.service';
import { CatalogSearchService } from './application/services/catalog-search.service';
import { CatalogUserStateEnricher } from './application/services/catalog-userstate-enricher.service';
import { MovieDetailsService } from './application/services/movie-details.service';
import { GENRE_REPOSITORY } from './domain/repositories/genre.repository.interface';
import { MEDIA_REPOSITORY } from './domain/repositories/media.repository.interface';
import { MOVIE_REPOSITORY } from './domain/repositories/movie.repository.interface';
import { PROVIDERS_REPOSITORY } from './domain/repositories/providers.repository.interface';
import { SHOW_REPOSITORY } from './domain/repositories/show.repository.interface';
import { HeroRepositoryAdapter } from './infrastructure/adapters/hero.repository.adapter';
import { CalendarEpisodesQuery } from './infrastructure/queries/calendar-episodes.query';
import { HeroMediaQuery } from './infrastructure/queries/hero-media.query';
import { MovieDetailsQuery } from './infrastructure/queries/movie-details.query';
import { MovieListingsQuery } from './infrastructure/queries/movie-listings.query';
import { NewEpisodesQuery } from './infrastructure/queries/new-episodes.query';
import { PopularMoviesQuery } from './infrastructure/queries/popular-movies.query';
import { PopularShowsQuery } from './infrastructure/queries/popular-shows.query';
import { ProvidersQuery } from './infrastructure/queries/providers.query';
import { GenreQuery } from './infrastructure/queries/shared/genre.query';
import { WatchOffersQuery } from './infrastructure/queries/shared/watch-offers.query';
import { ShowDetailsQuery } from './infrastructure/queries/show-details.query';
import { TrendingMoviesQuery } from './infrastructure/queries/trending-movies.query';
import { TrendingShowsQuery } from './infrastructure/queries/trending-shows.query';
import { DrizzleGenreRepository } from './infrastructure/repositories/drizzle-genre.repository';
import { DrizzleMediaRepository } from './infrastructure/repositories/drizzle-media.repository';
import { DrizzleMovieRepository } from './infrastructure/repositories/drizzle-movie.repository';
import { DrizzleShowRepository } from './infrastructure/repositories/drizzle-show.repository';
import { DrizzleProvidersRepository } from './infrastructure/repositories/providers.repository';
import { CatalogMoviesController } from './presentation/controllers/catalog.movies.controller';
import { CatalogProvidersController } from './presentation/controllers/catalog.providers.controller';
import { CatalogSearchController } from './presentation/controllers/catalog.search.controller';
import { CatalogShowsController } from './presentation/controllers/catalog.shows.controller';

// Query Objects - Shows

// Query Objects - Movies

// Query Objects - Mixed Media

// Query Objects - Shared

// Adapters

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
    MovieDetailsService,
    // Query Objects - Shows
    TrendingShowsQuery,
    PopularShowsQuery,
    ShowDetailsQuery,
    CalendarEpisodesQuery,
    NewEpisodesQuery,

    // Query Objects - Movies
    MovieDetailsQuery,
    TrendingMoviesQuery,
    PopularMoviesQuery,
    MovieListingsQuery,

    // Query Objects - Mixed Media
    HeroMediaQuery,

    // Query Objects - Shared
    GenreQuery,
    WatchOffersQuery,
    ProvidersQuery,

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
      useClass: DrizzleProvidersRepository,
    },
    // Adapters for other modules
    {
      provide: HERO_REPOSITORY,
      useClass: HeroRepositoryAdapter,
    },
  ],
  exports: [MEDIA_REPOSITORY, SHOW_REPOSITORY, GENRE_REPOSITORY, MOVIE_REPOSITORY, HERO_REPOSITORY],
})
export class CatalogModule {}
