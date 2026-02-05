import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { JOB_STATUS, type JobStatus } from '@/common/enums/job-status.enum';
import { MediaType } from '@/common/enums/media-type.enum';

import { IMPORT_JOB_PORT, IImportJobPort } from '../../domain/ports/import-job.port';
import {
  type IMediaMetadataPort,
  MEDIA_METADATA_PORT,
} from '../../domain/ports/media-metadata.port';
import {
  type IMediaRepository,
  MEDIA_REPOSITORY,
} from '../../domain/repositories/media.repository.interface';
import { IMPORT_STATUS, type ImportResult } from '../../domain/types/import.types';
import { generateSlug } from '../../domain/utils/slug.utils';

/**
 * Service for on-demand import of media from TMDB.
 * Used when user clicks on a search result that's not yet in our database.
 */
@Injectable()
export class CatalogImportService {
  private readonly logger = new Logger(CatalogImportService.name);

  /**
   * In-memory lock to deduplicate concurrent import requests for the same media.
   * Key: `${type}:${tmdbId}`, Value: pending import promise
   */
  private readonly pendingImports = new Map<string, Promise<ImportResult>>();

  constructor(
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
    @Inject(MEDIA_METADATA_PORT)
    private readonly metadataPort: IMediaMetadataPort,
    @Inject(IMPORT_JOB_PORT)
    private readonly importJobPort: IImportJobPort,
  ) {}

  /**
   * Triggers import of a media item from TMDB.
   * If already exists, returns existing data.
   * If not, creates a stub and queues for full sync.
   *
   * Uses in-memory lock to deduplicate concurrent requests for the same media.
   */
  async importMedia(tmdbId: number, type: MediaType): Promise<ImportResult> {
    const lockKey = `${type}:${tmdbId}`;

    // If import is already in progress, wait for it
    const pending = this.pendingImports.get(lockKey);
    if (pending) {
      this.logger.debug(`Import already in progress for ${lockKey}, waiting...`);
      return pending;
    }

    // Start import and store promise
    const importPromise = this.doImport(tmdbId, type);
    this.pendingImports.set(lockKey, importPromise);

    try {
      return await importPromise;
    } finally {
      this.pendingImports.delete(lockKey);
    }
  }

  /**
   * Performs the actual import logic.
   */
  private async doImport(tmdbId: number, type: MediaType): Promise<ImportResult> {
    // Check if already in DB
    const existing = await this.mediaRepository.findByTmdbId(tmdbId, type);

    if (existing) {
      // If already ready, just return
      if (existing.ingestionStatus === IngestionStatus.READY) {
        return {
          status: IMPORT_STATUS.READY,
          id: existing.id,
          slug: existing.slug,
          type: existing.type,
          tmdbId,
          ingestionStatus: existing.ingestionStatus,
        };
      }

      // Media is in IMPORTING state - check if job exists
      const existingJobId = await this.importJobPort.hasActiveJob(tmdbId, type);

      if (existingJobId) {
        // Job exists, return for polling
        return {
          status: IMPORT_STATUS.IMPORTING,
          id: existing.id,
          slug: existing.slug,
          type: existing.type,
          tmdbId,
          ingestionStatus: existing.ingestionStatus,
          jobId: existingJobId,
        };
      }

      // Job doesn't exist but media is stuck in IMPORTING - re-queue
      this.logger.warn(`Media ${tmdbId} stuck in IMPORTING state, re-queuing job`);
      const { jobId } = await this.importJobPort.queueImport(tmdbId, type);

      return {
        status: IMPORT_STATUS.IMPORTING,
        id: existing.id,
        slug: existing.slug,
        type: existing.type,
        tmdbId,
        ingestionStatus: existing.ingestionStatus,
        jobId,
      };
    }

    // Fetch basic info from metadata provider to get title for slug
    const media =
      type === MediaType.MOVIE
        ? await this.metadataPort.getMovie(tmdbId)
        : await this.metadataPort.getShow(tmdbId);

    if (!media) {
      this.logger.warn(`TMDB returned null for ${type} ${tmdbId}`);
      return {
        status: IMPORT_STATUS.NOT_FOUND,
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

    // Queue for full sync with deduplication by jobId
    const { jobId } = await this.importJobPort.queueImport(tmdbId, type);

    this.logger.log(`Queued import for ${type} ${tmdbId}: ${media.title} (job: ${jobId})`);

    return {
      status: IMPORT_STATUS.IMPORTING,
      id: stub.id,
      slug: stub.slug,
      type,
      tmdbId,
      ingestionStatus: IngestionStatus.IMPORTING,
      jobId,
    };
  }

  /**
   * Gets the status of an import job.
   * Only works for import jobs (SYNC_MOVIE, SYNC_SHOW).
   *
   * @throws {BadRequestException} If jobId is not a valid import job
   * @throws {NotFoundException} If job does not exist
   */
  async getImportJobStatus(jobId: string): Promise<{
    status: JobStatus;
    slug: string | null;
    errorMessage: string | null;
  }> {
    if (!this.importJobPort.isValidImportJobId(jobId)) {
      throw new BadRequestException('Invalid import job ID');
    }

    const jobStatus = await this.importJobPort.getJobStatus(jobId);
    if (!jobStatus) {
      throw new NotFoundException('Job not found');
    }

    // Get slug from DB if job is completed
    let slug: string | null = null;
    if (jobStatus.status === JOB_STATUS.READY && jobStatus.tmdbId) {
      const media = await this.mediaRepository.findByTmdbId(jobStatus.tmdbId);
      slug = media?.slug ?? null;
    }

    return {
      status: jobStatus.status,
      slug,
      errorMessage: jobStatus.errorMessage,
    };
  }
}
