import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { type Queue } from 'bullmq';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { INGESTION_QUEUE, IngestionJob } from '../../../ingestion/ingestion.constants';
import { TmdbAdapter } from '../../../tmdb/public';
import {
  type IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../domain/repositories/media.repository.interface';
import { ImportStatus, type ImportResult } from '../../domain/types/import.types';
import { generateSlug } from '../../domain/utils/slug.utils';

/**
 * Maps MediaType to corresponding IngestionJob.
 */
const MEDIA_TYPE_TO_JOB: Record<MediaType, IngestionJob> = {
  [MediaType.MOVIE]: IngestionJob.SYNC_MOVIE,
  [MediaType.SHOW]: IngestionJob.SYNC_SHOW,
};

/**
 * Service for on-demand import of media from TMDB.
 * Used when user clicks on a search result that's not yet in our database.
 */
@Injectable()
export class CatalogImportService {
  private readonly logger = new Logger(CatalogImportService.name);

  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
    private readonly tmdbAdapter: TmdbAdapter,
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
  ) {}

  /**
   * Triggers import of a media item from TMDB.
   * If already exists, returns existing data.
   * If not, creates a stub and queues for full sync.
   */
  async importMedia(tmdbId: number, type: MediaType): Promise<ImportResult> {
    // Check if already in DB
    const existing = await this.mediaRepository.findByTmdbId(tmdbId);

    if (existing) {
      return {
        status:
          existing.ingestionStatus === IngestionStatus.READY
            ? ImportStatus.READY
            : ImportStatus.IMPORTING,
        id: existing.id,
        slug: existing.slug,
        type: existing.type,
        tmdbId,
        ingestionStatus: existing.ingestionStatus,
      };
    }

    // Fetch basic info from TMDB to get title for slug
    const media =
      type === MediaType.MOVIE
        ? await this.tmdbAdapter.getMovie(tmdbId)
        : await this.tmdbAdapter.getShow(tmdbId);

    if (!media) {
      this.logger.warn(`TMDB returned null for ${type} ${tmdbId}`);
      return {
        status: ImportStatus.NOT_FOUND,
        type,
        tmdbId,
      };
    }

    const slug = generateSlug(media.title, tmdbId);

    // Create stub
    const stub = await this.mediaRepository.upsertStub({
      tmdbId,
      type,
      title: media.title || `TMDB #${tmdbId}`,
      slug,
      ingestionStatus: IngestionStatus.IMPORTING,
    });

    // Queue for full sync
    const jobName = MEDIA_TYPE_TO_JOB[type];
    const job = await this.ingestionQueue.add(jobName, { tmdbId });

    this.logger.log(`Queued import for ${type} ${tmdbId}: ${media.title} (job: ${job.id})`);

    return {
      status: ImportStatus.IMPORTING,
      id: stub.id,
      slug: stub.slug,
      type,
      tmdbId,
      ingestionStatus: IngestionStatus.IMPORTING,
      jobId: job.id,
    };
  }
}
