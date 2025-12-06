import { Module } from '@nestjs/common';
import { DrizzleMediaRepository } from './infrastructure/repositories/drizzle-media.repository';
import { MEDIA_REPOSITORY } from './domain/repositories/media.repository.interface';

@Module({
  providers: [
    {
      provide: MEDIA_REPOSITORY,
      useClass: DrizzleMediaRepository,
    },
  ],
  exports: [MEDIA_REPOSITORY],
})
export class CatalogModule {}
