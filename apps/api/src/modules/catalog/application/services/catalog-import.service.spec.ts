import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { JOB_STATUS } from '@/common/enums/job-status.enum';
import { MediaType } from '@/common/enums/media-type.enum';

import { IMPORT_JOB_PORT, IImportJobPort } from '../../domain/ports/import-job.port';
import {
  type IMediaMetadataPort,
  type MediaMetadata,
  MEDIA_METADATA_PORT,
} from '../../domain/ports/media-metadata.port';
import { MEDIA_REPOSITORY } from '../../domain/repositories/media.repository.interface';
import { IMPORT_STATUS } from '../../domain/types/import.types';

import { CatalogImportService } from './catalog-import.service';

describe('CatalogImportService', () => {
  let service: CatalogImportService;
  let mediaRepository: any;
  let metadataPort: jest.Mocked<IMediaMetadataPort>;
  let importJobPort: jest.Mocked<IImportJobPort>;

  beforeEach(async () => {
    const mockMediaRepository = {
      findByTmdbId: jest.fn(),
      upsertStub: jest.fn(),
    };

    const mockMetadataPort: jest.Mocked<IMediaMetadataPort> = {
      getMovie: jest.fn(),
      getShow: jest.fn(),
      searchMulti: jest.fn(),
    };

    const mockImportJobPort: jest.Mocked<IImportJobPort> = {
      queueImport: jest.fn(),
      hasActiveJob: jest.fn(),
      getJobStatus: jest.fn(),
      isValidImportJobId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogImportService,
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepository },
        { provide: MEDIA_METADATA_PORT, useValue: mockMetadataPort },
        { provide: IMPORT_JOB_PORT, useValue: mockImportJobPort },
      ],
    }).compile();

    service = module.get<CatalogImportService>(CatalogImportService);
    mediaRepository = module.get(MEDIA_REPOSITORY);
    metadataPort = module.get(MEDIA_METADATA_PORT);
    importJobPort = module.get(IMPORT_JOB_PORT);
  });

  describe('importMedia', () => {
    describe('when media already exists', () => {
      it('should return READY status for existing ready media', async () => {
        mediaRepository.findByTmdbId.mockResolvedValue({
          id: 'existing-id',
          slug: 'existing-movie',
          type: MediaType.MOVIE,
          ingestionStatus: IngestionStatus.READY,
        });

        const result = await service.importMedia(123, MediaType.MOVIE);

        expect(result.status).toBe(IMPORT_STATUS.READY);
        expect(result.id).toBe('existing-id');
        expect(result.slug).toBe('existing-movie');
        expect(result.ingestionStatus).toBe(IngestionStatus.READY);
        expect(metadataPort.getMovie).not.toHaveBeenCalled();
        expect(importJobPort.queueImport).not.toHaveBeenCalled();
      });

      it('should return IMPORTING status when job exists', async () => {
        mediaRepository.findByTmdbId.mockResolvedValue({
          id: 'existing-id',
          slug: 'importing-movie',
          type: MediaType.MOVIE,
          ingestionStatus: IngestionStatus.IMPORTING,
        });
        // Job exists in queue
        importJobPort.hasActiveJob.mockResolvedValue('sync-movie_123');

        const result = await service.importMedia(123, MediaType.MOVIE);

        expect(result.status).toBe(IMPORT_STATUS.IMPORTING);
        expect(result.ingestionStatus).toBe(IngestionStatus.IMPORTING);
        expect(result.jobId).toBe('sync-movie_123');
        expect(importJobPort.queueImport).not.toHaveBeenCalled();
      });

      it('should re-queue job when media is stuck in IMPORTING state', async () => {
        mediaRepository.findByTmdbId.mockResolvedValue({
          id: 'existing-id',
          slug: 'stuck-movie',
          type: MediaType.MOVIE,
          ingestionStatus: IngestionStatus.IMPORTING,
        });
        // Job does NOT exist (stuck state)
        importJobPort.hasActiveJob.mockResolvedValue(null);
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-movie_123' });

        const result = await service.importMedia(123, MediaType.MOVIE);

        expect(result.status).toBe(IMPORT_STATUS.IMPORTING);
        expect(result.jobId).toBe('sync-movie_123');
        // Should re-queue the job
        expect(importJobPort.queueImport).toHaveBeenCalledWith(123, MediaType.MOVIE);
      });
    });

    describe('when media does not exist', () => {
      beforeEach(() => {
        mediaRepository.findByTmdbId.mockResolvedValue(null);
      });

      it('should import movie from TMDB and queue for sync', async () => {
        metadataPort.getMovie.mockResolvedValue({
          title: 'The Matrix',
        });
        mediaRepository.upsertStub.mockResolvedValue({
          id: 'new-id',
          slug: 'the-matrix',
        });
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-movie_123' });

        const result = await service.importMedia(123, MediaType.MOVIE);

        expect(metadataPort.getMovie).toHaveBeenCalledWith(123);
        expect(mediaRepository.upsertStub).toHaveBeenCalledWith({
          tmdbId: 123,
          type: MediaType.MOVIE,
          title: 'The Matrix',
          slug: 'the-matrix',
          ingestionStatus: IngestionStatus.IMPORTING,
        });
        expect(importJobPort.queueImport).toHaveBeenCalledWith(123, MediaType.MOVIE);
        expect(result.status).toBe(IMPORT_STATUS.IMPORTING);
        expect(result.id).toBe('new-id');
        expect(result.slug).toBe('the-matrix');
        expect(result.jobId).toBe('sync-movie_123');
      });

      it('should import show from TMDB and queue for sync', async () => {
        metadataPort.getShow.mockResolvedValue({
          title: 'Breaking Bad',
        });
        mediaRepository.upsertStub.mockResolvedValue({
          id: 'new-show-id',
          slug: 'breaking-bad',
        });
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-show_456' });

        const result = await service.importMedia(456, MediaType.SHOW);

        expect(metadataPort.getShow).toHaveBeenCalledWith(456);
        expect(importJobPort.queueImport).toHaveBeenCalledWith(456, MediaType.SHOW);
        expect(result.status).toBe(IMPORT_STATUS.IMPORTING);
        expect(result.type).toBe(MediaType.SHOW);
      });

      it('should return NOT_FOUND when TMDB returns null', async () => {
        metadataPort.getMovie.mockResolvedValue(null);

        const result = await service.importMedia(999, MediaType.MOVIE);

        expect(result.status).toBe(IMPORT_STATUS.NOT_FOUND);
        expect(result.tmdbId).toBe(999);
        expect(result.type).toBe(MediaType.MOVIE);
        expect(result.id).toBeUndefined();
        expect(mediaRepository.upsertStub).not.toHaveBeenCalled();
        expect(importJobPort.queueImport).not.toHaveBeenCalled();
      });

      it('should generate fallback slug when title is empty', async () => {
        metadataPort.getMovie.mockResolvedValue({
          title: '',
        });
        mediaRepository.upsertStub.mockResolvedValue({
          id: 'new-id',
          slug: 'tmdb-123',
        });
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-movie_123' });

        await service.importMedia(123, MediaType.MOVIE);

        expect(mediaRepository.upsertStub).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'TMDB #123',
            slug: 'tmdb-123',
          }),
        );
      });

      it('should generate fallback slug when title is null', async () => {
        metadataPort.getMovie.mockResolvedValue({
          title: null,
        });
        mediaRepository.upsertStub.mockResolvedValue({
          id: 'new-id',
          slug: 'tmdb-123',
        });
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-movie_123' });

        await service.importMedia(123, MediaType.MOVIE);

        expect(mediaRepository.upsertStub).toHaveBeenCalledWith(
          expect.objectContaining({
            slug: 'tmdb-123',
          }),
        );
      });

      it('should handle Cyrillic titles in slug generation', async () => {
        metadataPort.getMovie.mockResolvedValue({
          title: 'Тіні забутих предків',
        });
        mediaRepository.upsertStub.mockResolvedValue({
          id: 'new-id',
          slug: 'tini-zabutykh-predkiv',
        });
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-movie_789' });

        const result = await service.importMedia(789, MediaType.MOVIE);

        expect(result.status).toBe(IMPORT_STATUS.IMPORTING);
        expect(mediaRepository.upsertStub).toHaveBeenCalled();
      });

      it('should deduplicate concurrent requests for the same media', async () => {
        // Simulate slow metadata response
        let resolveGetMovie: (value: MediaMetadata) => void;
        const slowPromise = new Promise<MediaMetadata>((resolve) => {
          resolveGetMovie = resolve;
        });
        metadataPort.getMovie.mockReturnValue(slowPromise);
        mediaRepository.upsertStub.mockResolvedValue({
          id: 'new-id',
          slug: 'the-matrix',
        });
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-movie_123' });

        // Start two concurrent requests
        const promise1 = service.importMedia(123, MediaType.MOVIE);
        const promise2 = service.importMedia(123, MediaType.MOVIE);

        // Resolve metadata response
        resolveGetMovie!({ title: 'The Matrix' });

        // Both should return the same result
        const [result1, result2] = await Promise.all([promise1, promise2]);

        expect(result1).toEqual(result2);
        // TMDB should be called only once
        expect(metadataPort.getMovie).toHaveBeenCalledTimes(1);
        // upsertStub should be called only once
        expect(mediaRepository.upsertStub).toHaveBeenCalledTimes(1);
        // Queue should be called only once
        expect(importJobPort.queueImport).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('getImportJobStatus', () => {
    it('should throw BadRequestException for invalid job ID', async () => {
      importJobPort.isValidImportJobId.mockReturnValue(false);

      await expect(service.getImportJobStatus('invalid-job-id')).rejects.toThrow(
        BadRequestException,
      );
      expect(importJobPort.getJobStatus).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when job does not exist', async () => {
      importJobPort.isValidImportJobId.mockReturnValue(true);
      importJobPort.getJobStatus.mockResolvedValue(null);

      await expect(service.getImportJobStatus('sync-movie_123')).rejects.toThrow(NotFoundException);
    });

    it('should return job status with slug when job is READY', async () => {
      importJobPort.isValidImportJobId.mockReturnValue(true);
      importJobPort.getJobStatus.mockResolvedValue({
        status: JOB_STATUS.READY,
        errorMessage: null,
        tmdbId: 123,
      });
      mediaRepository.findByTmdbId.mockResolvedValue({
        id: 'media-id',
        slug: 'the-matrix',
        type: MediaType.MOVIE,
        ingestionStatus: IngestionStatus.READY,
      });

      const result = await service.getImportJobStatus('sync-movie_123');

      expect(result.status).toBe(JOB_STATUS.READY);
      expect(result.slug).toBe('the-matrix');
      expect(result.errorMessage).toBeNull();
      expect(mediaRepository.findByTmdbId).toHaveBeenCalledWith(123);
    });

    it('should return job status without slug when job is PROCESSING', async () => {
      importJobPort.isValidImportJobId.mockReturnValue(true);
      importJobPort.getJobStatus.mockResolvedValue({
        status: JOB_STATUS.PROCESSING,
        errorMessage: null,
        tmdbId: 123,
      });

      const result = await service.getImportJobStatus('sync-movie_123');

      expect(result.status).toBe(JOB_STATUS.PROCESSING);
      expect(result.slug).toBeNull();
      expect(mediaRepository.findByTmdbId).not.toHaveBeenCalled();
    });

    it('should return job status with error message when job FAILED', async () => {
      importJobPort.isValidImportJobId.mockReturnValue(true);
      importJobPort.getJobStatus.mockResolvedValue({
        status: JOB_STATUS.FAILED,
        errorMessage: 'TMDB API error',
        tmdbId: 123,
      });

      const result = await service.getImportJobStatus('sync-movie_123');

      expect(result.status).toBe(JOB_STATUS.FAILED);
      expect(result.slug).toBeNull();
      expect(result.errorMessage).toBe('TMDB API error');
    });

    it('should return null slug when media not found in DB after READY', async () => {
      importJobPort.isValidImportJobId.mockReturnValue(true);
      importJobPort.getJobStatus.mockResolvedValue({
        status: JOB_STATUS.READY,
        errorMessage: null,
        tmdbId: 123,
      });
      mediaRepository.findByTmdbId.mockResolvedValue(null);

      const result = await service.getImportJobStatus('sync-movie_123');

      expect(result.status).toBe(JOB_STATUS.READY);
      expect(result.slug).toBeNull();
    });
  });
});
