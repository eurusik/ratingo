import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { JobStatus } from '@/common/enums/job-status.enum';
import { MediaType } from '@/common/enums/media-type.enum';
import { TmdbAdapter } from '@/modules/tmdb/public';

import { IMPORT_JOB_PORT, IImportJobPort } from '../../domain/ports/import-job.port';
import { MEDIA_REPOSITORY } from '../../domain/repositories/media.repository.interface';
import { ImportStatus } from '../../domain/types/import.types';

import { CatalogImportService } from './catalog-import.service';

describe('CatalogImportService', () => {
  let service: CatalogImportService;
  let mediaRepository: any;
  let tmdbAdapter: any;
  let importJobPort: jest.Mocked<IImportJobPort>;

  beforeEach(async () => {
    const mockMediaRepository = {
      findByTmdbId: jest.fn(),
      upsertStub: jest.fn(),
    };

    const mockTmdbAdapter = {
      getMovie: jest.fn(),
      getShow: jest.fn(),
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
        { provide: TmdbAdapter, useValue: mockTmdbAdapter },
        { provide: IMPORT_JOB_PORT, useValue: mockImportJobPort },
      ],
    }).compile();

    service = module.get<CatalogImportService>(CatalogImportService);
    mediaRepository = module.get(MEDIA_REPOSITORY);
    tmdbAdapter = module.get(TmdbAdapter);
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

        expect(result.status).toBe(ImportStatus.READY);
        expect(result.id).toBe('existing-id');
        expect(result.slug).toBe('existing-movie');
        expect(result.ingestionStatus).toBe(IngestionStatus.READY);
        expect(tmdbAdapter.getMovie).not.toHaveBeenCalled();
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

        expect(result.status).toBe(ImportStatus.IMPORTING);
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

        expect(result.status).toBe(ImportStatus.IMPORTING);
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
        tmdbAdapter.getMovie.mockResolvedValue({
          title: 'The Matrix',
          tmdbId: 123,
        });
        mediaRepository.upsertStub.mockResolvedValue({
          id: 'new-id',
          slug: 'the-matrix',
        });
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-movie_123' });

        const result = await service.importMedia(123, MediaType.MOVIE);

        expect(tmdbAdapter.getMovie).toHaveBeenCalledWith(123);
        expect(mediaRepository.upsertStub).toHaveBeenCalledWith({
          tmdbId: 123,
          type: MediaType.MOVIE,
          title: 'The Matrix',
          slug: 'the-matrix',
          ingestionStatus: IngestionStatus.IMPORTING,
        });
        expect(importJobPort.queueImport).toHaveBeenCalledWith(123, MediaType.MOVIE);
        expect(result.status).toBe(ImportStatus.IMPORTING);
        expect(result.id).toBe('new-id');
        expect(result.slug).toBe('the-matrix');
        expect(result.jobId).toBe('sync-movie_123');
      });

      it('should import show from TMDB and queue for sync', async () => {
        tmdbAdapter.getShow.mockResolvedValue({
          title: 'Breaking Bad',
          tmdbId: 456,
        });
        mediaRepository.upsertStub.mockResolvedValue({
          id: 'new-show-id',
          slug: 'breaking-bad',
        });
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-show_456' });

        const result = await service.importMedia(456, MediaType.SHOW);

        expect(tmdbAdapter.getShow).toHaveBeenCalledWith(456);
        expect(importJobPort.queueImport).toHaveBeenCalledWith(456, MediaType.SHOW);
        expect(result.status).toBe(ImportStatus.IMPORTING);
        expect(result.type).toBe(MediaType.SHOW);
      });

      it('should return NOT_FOUND when TMDB returns null', async () => {
        tmdbAdapter.getMovie.mockResolvedValue(null);

        const result = await service.importMedia(999, MediaType.MOVIE);

        expect(result.status).toBe(ImportStatus.NOT_FOUND);
        expect(result.tmdbId).toBe(999);
        expect(result.type).toBe(MediaType.MOVIE);
        expect(result.id).toBeUndefined();
        expect(mediaRepository.upsertStub).not.toHaveBeenCalled();
        expect(importJobPort.queueImport).not.toHaveBeenCalled();
      });

      it('should generate fallback slug when title is empty', async () => {
        tmdbAdapter.getMovie.mockResolvedValue({
          title: '',
          tmdbId: 123,
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
        tmdbAdapter.getMovie.mockResolvedValue({
          title: null,
          tmdbId: 123,
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
        tmdbAdapter.getMovie.mockResolvedValue({
          title: 'Тіні забутих предків',
          tmdbId: 789,
        });
        mediaRepository.upsertStub.mockResolvedValue({
          id: 'new-id',
          slug: 'tini-zabutykh-predkiv',
        });
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-movie_789' });

        const result = await service.importMedia(789, MediaType.MOVIE);

        expect(result.status).toBe(ImportStatus.IMPORTING);
        expect(mediaRepository.upsertStub).toHaveBeenCalled();
      });

      it('should deduplicate concurrent requests for the same media', async () => {
        // Simulate slow TMDB response
        let resolveGetMovie: (value: any) => void;
        const slowPromise = new Promise((resolve) => {
          resolveGetMovie = resolve;
        });
        tmdbAdapter.getMovie.mockReturnValue(slowPromise);
        mediaRepository.upsertStub.mockResolvedValue({
          id: 'new-id',
          slug: 'the-matrix',
        });
        importJobPort.queueImport.mockResolvedValue({ jobId: 'sync-movie_123' });

        // Start two concurrent requests
        const promise1 = service.importMedia(123, MediaType.MOVIE);
        const promise2 = service.importMedia(123, MediaType.MOVIE);

        // Resolve TMDB response
        resolveGetMovie!({ title: 'The Matrix', tmdbId: 123 });

        // Both should return the same result
        const [result1, result2] = await Promise.all([promise1, promise2]);

        expect(result1).toEqual(result2);
        // TMDB should be called only once
        expect(tmdbAdapter.getMovie).toHaveBeenCalledTimes(1);
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
        status: JobStatus.READY,
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

      expect(result.status).toBe(JobStatus.READY);
      expect(result.slug).toBe('the-matrix');
      expect(result.errorMessage).toBeNull();
      expect(mediaRepository.findByTmdbId).toHaveBeenCalledWith(123);
    });

    it('should return job status without slug when job is PROCESSING', async () => {
      importJobPort.isValidImportJobId.mockReturnValue(true);
      importJobPort.getJobStatus.mockResolvedValue({
        status: JobStatus.PROCESSING,
        errorMessage: null,
        tmdbId: 123,
      });

      const result = await service.getImportJobStatus('sync-movie_123');

      expect(result.status).toBe(JobStatus.PROCESSING);
      expect(result.slug).toBeNull();
      expect(mediaRepository.findByTmdbId).not.toHaveBeenCalled();
    });

    it('should return job status with error message when job FAILED', async () => {
      importJobPort.isValidImportJobId.mockReturnValue(true);
      importJobPort.getJobStatus.mockResolvedValue({
        status: JobStatus.FAILED,
        errorMessage: 'TMDB API error',
        tmdbId: 123,
      });

      const result = await service.getImportJobStatus('sync-movie_123');

      expect(result.status).toBe(JobStatus.FAILED);
      expect(result.slug).toBeNull();
      expect(result.errorMessage).toBe('TMDB API error');
    });

    it('should return null slug when media not found in DB after READY', async () => {
      importJobPort.isValidImportJobId.mockReturnValue(true);
      importJobPort.getJobStatus.mockResolvedValue({
        status: JobStatus.READY,
        errorMessage: null,
        tmdbId: 123,
      });
      mediaRepository.findByTmdbId.mockResolvedValue(null);

      const result = await service.getImportJobStatus('sync-movie_123');

      expect(result.status).toBe(JobStatus.READY);
      expect(result.slug).toBeNull();
    });
  });
});
