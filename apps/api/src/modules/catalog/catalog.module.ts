import { Module } from '@nestjs/common';
import { DrizzleMediaRepository } from './infrastructure/repositories/drizzle-media.repository';
import { DrizzleGenreRepository } from './infrastructure/repositories/drizzle-genre.repository';
import { DrizzleProviderRepository } from './infrastructure/repositories/drizzle-provider.repository';
import { DrizzleShowRepository } from './infrastructure/repositories/drizzle-show.repository';
import { MEDIA_REPOSITORY } from './domain/repositories/media.repository.interface';
import { SHOW_REPOSITORY } from './domain/repositories/show.repository.interface';
import { GENRE_REPOSITORY } from './domain/repositories/genre.repository.interface';
import { PROVIDER_REPOSITORY } from './domain/repositories/provider.repository.interface';

@Module({
  providers: [
    {
      provide: GENRE_REPOSITORY,
      useClass: DrizzleGenreRepository,
    },
    {
      provide: PROVIDER_REPOSITORY,
      useClass: DrizzleProviderRepository,
    },
    {
      provide: MEDIA_REPOSITORY,
      useClass: DrizzleMediaRepository,
    },
    {
      provide: SHOW_REPOSITORY,
      useClass: DrizzleShowRepository,
    },
  ],
  exports: [MEDIA_REPOSITORY, SHOW_REPOSITORY, GENRE_REPOSITORY, PROVIDER_REPOSITORY],
})
export class CatalogModule {}
