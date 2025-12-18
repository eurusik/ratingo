import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import slugify from 'slugify';
import {
  IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../domain/repositories/media.repository.interface';
import { TmdbAdapter } from '../../../tmdb/tmdb.adapter';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { INGESTION_QUEUE, IngestionJob } from '../../../ingestion/ingestion.constants';
import { ImportStatus, ImportResult } from '../../domain/types/import.types';

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
      return {
        status: ImportStatus.NOT_FOUND,
        type,
        tmdbId,
      };
    }

    const slug = slugify(media.title || `tmdb-${tmdbId}`, {
      lower: true,
      strict: true,
      locale: 'uk',
    });

    // Create stub
    const stub = await this.mediaRepository.upsertStub({
      tmdbId,
      type,
      title: media.title || `TMDB #${tmdbId}`,
      slug,
      ingestionStatus: IngestionStatus.IMPORTING,
    });

    // Queue for full sync
    const jobName = type === MediaType.MOVIE ? IngestionJob.SYNC_MOVIE : IngestionJob.SYNC_SHOW;
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
