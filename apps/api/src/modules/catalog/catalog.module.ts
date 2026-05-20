import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { HERO_REPOSITORY } from '../home/public';
import { INGESTION_QUEUE } from '../ingestion/public';
import { CardsModule } from '../shared/cards/cards.module';
import { VerdictModule } from '../shared/verdict';
import { TmdbModule } from '../tmdb/public';
import { UserMediaModule } from '../user-media/user-media.module';

import { CatalogImportService } from './application/services/catalog-import.service';
import { CatalogSearchService } from './application/services/catalog-search.service';
import { CatalogSitemapService } from './application/services/catalog-sitemap.service';
import { CatalogUserStateEnricher } from './application/services/catalog-userstate-enricher.service';
import { MovieDetailsService } from './application/services/movie-details.service';
import { ShowDetailsService } from './application/services/show-details.service';
import { ShowsCalendarService } from './application/services/shows-calendar.service';
import { IMPORT_JOB_PORT } from './domain/ports/import-job.port';
import { MEDIA_METADATA_PORT } from './domain/ports/media-metadata.port';
import { USER_STATE_PROVIDER } from './domain/ports/user-state-provider.port';
import { GENRE_REPOSITORY } from './domain/repositories/genre.repository.interface';
import { MEDIA_REPOSITORY } from './domain/repositories/media.repository.interface';
import { MOVIE_REPOSITORY } from './domain/repositories/movie.repository.interface';
import { PROVIDERS_REPOSITORY } from './domain/repositories/providers.repository.interface';
import { SHOW_REPOSITORY } from './domain/repositories/show.repository.interface';
import { BullMQImportJobAdapter } from './infrastructure/adapters/bullmq-import-job.adapter';
import { HeroRepositoryAdapter } from './infrastructure/adapters/hero.repository.adapter';
import { TmdbMetadataAdapter } from './infrastructure/adapters/tmdb-metadata.adapter';
import { UserStateAdapter } from './infrastructure/adapters/user-state.adapter';
import { CalendarEpisodesQuery } from './infrastructure/queries/calendar-episodes.query';
import { HeroMediaQuery } from './infrastructure/queries/hero-media.query';
import { MovieDetailsQuery } from './infrastructure/queries/movie-details.query';
import { MovieListingsQuery } from './infrastructure/queries/movie-listings.query';
import { NewEpisodesQuery } from './infrastructure/queries/new-episodes.query';
import { PopularMoviesQuery } from './infrastructure/queries/popular-movies.query';
import { PopularShowsQuery } from './infrastructure/queries/popular-shows.query';
import { ProvidersQuery } from './infrastructure/queries/providers.query';
import { GenreQuery } from './infrastructure/queries/shared/genre.query';
import { RecentRatersQuery } from './infrastructure/queries/shared/recent-raters.query';
import { WatchOffersQuery } from './infrastructure/queries/shared/watch-offers.query';
import { ShowDetailsQuery } from './infrastructure/queries/show-details.query';
import { TrendingMoviesQuery } from './infrastructure/queries/trending-movies.query';
import { TrendingShowsQuery } from './infrastructure/queries/trending-shows.query';
import { WatchingNowMediaQuery } from './infrastructure/queries/watching-now-media.query';
import { WatchingShowsCountQuery } from './infrastructure/queries/watching-shows-count.query';
import { DrizzleGenreRepository } from './infrastructure/repositories/drizzle-genre.repository';
import { DrizzleMediaRepository } from './infrastructure/repositories/drizzle-media.repository';
import { DrizzleMovieRepository } from './infrastructure/repositories/drizzle-movie.repository';
import { DrizzleShowRepository } from './infrastructure/repositories/drizzle-show.repository';
import { DrizzleProvidersRepository } from './infrastructure/repositories/providers.repository';
import { CatalogMoviesController } from './presentation/controllers/catalog.movies.controller';
import { CatalogProvidersController } from './presentation/controllers/catalog.providers.controller';
import { CatalogSearchController } from './presentation/controllers/catalog.search.controller';
import { CatalogShowsController } from './presentation/controllers/catalog.shows.controller';
import { CatalogSitemapController } from './presentation/controllers/catalog.sitemap.controller';

/**
 * Catalog module.
 */
@Module({
  imports: [
    TmdbModule,
    UserMediaModule,
    CardsModule,
    VerdictModule,
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
  ],
  controllers: [
    CatalogMoviesController,
    CatalogShowsController,
    CatalogSearchController,
    CatalogProvidersController,
    CatalogSitemapController,
  ],
  providers: [
    CatalogSearchService,
    CatalogImportService,
    CatalogSitemapService,
    CatalogUserStateEnricher,
    MovieDetailsService,
    ShowDetailsService,
    ShowsCalendarService,
    // Query Objects - Shows
    TrendingShowsQuery,
    PopularShowsQuery,
    ShowDetailsQuery,
    CalendarEpisodesQuery,
    NewEpisodesQuery,
    WatchingShowsCountQuery,

    // Query Objects - Movies
    MovieDetailsQuery,
    TrendingMoviesQuery,
    PopularMoviesQuery,
    MovieListingsQuery,

    // Query Objects - Mixed Media
    HeroMediaQuery,
    WatchingNowMediaQuery,

    // Query Objects - Shared
    GenreQuery,
    WatchOffersQuery,
    RecentRatersQuery,
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
    // Adapters
    {
      provide: IMPORT_JOB_PORT,
      useClass: BullMQImportJobAdapter,
    },
    {
      provide: MEDIA_METADATA_PORT,
      useClass: TmdbMetadataAdapter,
    },
    {
      provide: USER_STATE_PROVIDER,
      useClass: UserStateAdapter,
    },
    {
      provide: HERO_REPOSITORY,
      useClass: HeroRepositoryAdapter,
    },
  ],
  exports: [MEDIA_REPOSITORY, SHOW_REPOSITORY, GENRE_REPOSITORY, MOVIE_REPOSITORY, HERO_REPOSITORY],
})
export class CatalogModule {}
