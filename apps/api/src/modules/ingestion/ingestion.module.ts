import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { TmdbAdapter } from './infrastructure/adapters/tmdb/tmdb.adapter';
import { SyncMediaService } from './application/services/sync-media.service';
import { ConfigModule } from '@nestjs/config';
import tmdbConfig from '@/config/tmdb.config';
import { BullModule } from '@nestjs/bullmq';
import { SyncWorker } from './application/workers/sync.worker';
import { IngestionController } from './presentation/controllers/ingestion.controller';

import { INGESTION_QUEUE } from './ingestion.constants';

@Module({
  imports: [
    CatalogModule, 
    ConfigModule.forFeature(tmdbConfig),
    BullModule.registerQueue({
      name: INGESTION_QUEUE,
    }),
  ],
  controllers: [IngestionController],
  providers: [TmdbAdapter, SyncMediaService, SyncWorker],
  exports: [SyncMediaService],
})
export class IngestionModule {}
