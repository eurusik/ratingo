import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { type Queue } from 'bullmq';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { BULL_STATE_TO_JOB_STATUS, JobStatus } from '../../../../common/enums/job-status.enum';
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

  /**
   * In-memory lock to deduplicate concurrent import requests for the same media.
   * Key: `${type}:${tmdbId}`, Value: pending import promise
   */
  private readonly pendingImports = new Map<string, Promise<ImportResult>>();

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
          status: ImportStatus.READY,
          id: existing.id,
          slug: existing.slug,
          type: existing.type,
          tmdbId,
          ingestionStatus: existing.ingestionStatus,
        };
      }

      // Media is in IMPORTING state - check if job exists
      const jobName = MEDIA_TYPE_TO_JOB[type];
      const expectedJobId = `${jobName}_${tmdbId}`;
      const existingJob = await this.ingestionQueue.getJob(expectedJobId);

      if (existingJob) {
        // Job exists, return for polling
        return {
          status: ImportStatus.IMPORTING,
          id: existing.id,
          slug: existing.slug,
          type: existing.type,
          tmdbId,
          ingestionStatus: existing.ingestionStatus,
          jobId: expectedJobId,
        };
      }

      // Job doesn't exist but media is stuck in IMPORTING - re-queue
      this.logger.warn(`Media ${tmdbId} stuck in IMPORTING state, re-queuing job ${expectedJobId}`);
      const job = await this.ingestionQueue.add(jobName, { tmdbId }, { jobId: expectedJobId });

      return {
        status: ImportStatus.IMPORTING,
        id: existing.id,
        slug: existing.slug,
        type: existing.type,
        tmdbId,
        ingestionStatus: existing.ingestionStatus,
        jobId: job.id,
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

    // Queue for full sync with deduplication by jobId
    const jobName = MEDIA_TYPE_TO_JOB[type];
    const jobId = `${jobName}_${tmdbId}`;
    const job = await this.ingestionQueue.add(jobName, { tmdbId }, { jobId });

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
    // Validate jobId format - must be sync-movie_* or sync-show_*
    const isValidImportJob =
      jobId.startsWith(`${IngestionJob.SYNC_MOVIE}_`) ||
      jobId.startsWith(`${IngestionJob.SYNC_SHOW}_`);

    if (!isValidImportJob) {
      throw new BadRequestException('Invalid import job ID');
    }

    const job = await this.ingestionQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();
    const status =
      BULL_STATE_TO_JOB_STATUS[state] ??
      BULL_STATE_TO_JOB_STATUS[job.finishedOn ? 'completed' : 'failed'] ??
      JobStatus.FAILED;

    // Get slug from DB if job is completed
    let slug: string | null = null;
    if (status === JobStatus.READY && job.data?.tmdbId) {
      const media = await this.mediaRepository.findByTmdbId(job.data.tmdbId);
      slug = media?.slug ?? null;
    }

    return {
      status,
      slug,
      errorMessage: job.failedReason ?? null,
    };
  }
}
