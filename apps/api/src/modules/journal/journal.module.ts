/**
 * Journal Module
 *
 * NestJS module for the Product Journal feature.
 * Provides public and admin endpoints for journal posts and image management.
 */

import { Module } from '@nestjs/common';

import { JournalImageService } from './application/journal-image.service';
import { JournalRepository } from './infrastructure/journal.repository';
import { AdminJournalController, JournalPostsController } from './presentation/controllers';
import { JournalImagesController } from './presentation/controllers/journal-images.controller';

@Module({
  imports: [],
  controllers: [JournalPostsController, AdminJournalController, JournalImagesController],
  providers: [JournalRepository, JournalImageService],
  exports: [JournalRepository, JournalImageService],
})
export class JournalModule {}
