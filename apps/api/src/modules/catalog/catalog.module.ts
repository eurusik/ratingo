import { Module } from '@nestjs/common';
import { DrizzleMediaRepository } from './infrastructure/repositories/drizzle-media.repository';
import { DrizzleGenreRepository } from './infrastructure/repositories/drizzle-genre.repository';
import { DrizzleProviderRepository } from './infrastructure/repositories/drizzle-provider.repository';
import { MEDIA_REPOSITORY } from './domain/repositories/media.repository.interface';

@Module({
  providers: [
    DrizzleGenreRepository,
    DrizzleProviderRepository,
    {
      provide: MEDIA_REPOSITORY,
      useClass: DrizzleMediaRepository,
    },
  ],
  exports: [MEDIA_REPOSITORY],
})
export class CatalogModule {}
