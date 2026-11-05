/**
 * Journal Module
 *
 * NestJS module for the Product Journal feature.
 * Provides public and admin endpoints for journal posts and image management.
 */

import { Module } from '@nestjs/common';

import { JournalImageService } from './application/journal-image.service';
import { JournalService } from './application/services/journal.service';
import { JOURNAL_REPOSITORY } from './domain/repositories/journal.repository.interface';
import { JournalRepository } from './infrastructure/journal.repository';
import { AdminJournalController, JournalPostsController } from './presentation/controllers';
import { JournalImagesController } from './presentation/controllers/journal-images.controller';

@Module({
  imports: [],
  controllers: [JournalPostsController, AdminJournalController, JournalImagesController],
  providers: [
    { provide: JOURNAL_REPOSITORY, useClass: JournalRepository },
    JournalImageService,
    JournalService,
  ],
  exports: [JournalImageService, JournalService],
})
export class JournalModule {}
