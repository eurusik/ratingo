import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { CatalogImportService } from './catalog-import.service';
import { MEDIA_REPOSITORY } from '../../domain/repositories/media.repository.interface';
import { TmdbAdapter } from '../../../tmdb/public';
import { INGESTION_QUEUE, IngestionJob } from '../../../ingestion/ingestion.constants';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { ImportStatus } from '../../domain/types/import.types';

describe('CatalogImportService', () => {
  let service: CatalogImportService;
  let mediaRepository: any;
  let tmdbAdapter: any;
  let ingestionQueue: any;

  beforeEach(async () => {
    const mockMediaRepository = {
      findByTmdbId: jest.fn(),
      upsertStub: jest.fn(),
    };

    const mockTmdbAdapter = {
      getMovie: jest.fn(),
      getShow: jest.fn(),
    };

    const mockQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogImportService,
        { provide: MEDIA_REPOSITORY, useValue: mockMediaRepository },
        { provide: TmdbAdapter, useValue: mockTmdbAdapter },
        { provide: getQueueToken(INGESTION_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<CatalogImportService>(CatalogImportService);
    mediaRepository = module.get(MEDIA_REPOSITORY);
    tmdbAdapter = module.get(TmdbAdapter);
    ingestionQueue = module.get(getQueueToken(INGESTION_QUEUE));
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
        expect(ingestionQueue.add).not.toHaveBeenCalled();
      });

      it('should return IMPORTING status for existing importing media', async () => {
        mediaRepository.findByTmdbId.mockResolvedValue({
          id: 'existing-id',
          slug: 'importing-movie',
          type: MediaType.MOVIE,
          ingestionStatus: IngestionStatus.IMPORTING,
        });

        const result = await service.importMedia(123, MediaType.MOVIE);

        expect(result.status).toBe(ImportStatus.IMPORTING);
        expect(result.ingestionStatus).toBe(IngestionStatus.IMPORTING);
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
        ingestionQueue.add.mockResolvedValue({ id: 'job-123' });

        const result = await service.importMedia(123, MediaType.MOVIE);

        expect(tmdbAdapter.getMovie).toHaveBeenCalledWith(123);
        expect(mediaRepository.upsertStub).toHaveBeenCalledWith({
          tmdbId: 123,
          type: MediaType.MOVIE,
          title: 'The Matrix',
          slug: 'the-matrix',
          ingestionStatus: IngestionStatus.IMPORTING,
        });
        expect(ingestionQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_MOVIE, { tmdbId: 123 });
        expect(result.status).toBe(ImportStatus.IMPORTING);
        expect(result.id).toBe('new-id');
        expect(result.slug).toBe('the-matrix');
        expect(result.jobId).toBe('job-123');
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
        ingestionQueue.add.mockResolvedValue({ id: 'job-456' });

        const result = await service.importMedia(456, MediaType.SHOW);

        expect(tmdbAdapter.getShow).toHaveBeenCalledWith(456);
        expect(ingestionQueue.add).toHaveBeenCalledWith(IngestionJob.SYNC_SHOW, { tmdbId: 456 });
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
        expect(ingestionQueue.add).not.toHaveBeenCalled();
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
        ingestionQueue.add.mockResolvedValue({ id: 'job-123' });

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
        ingestionQueue.add.mockResolvedValue({ id: 'job-123' });

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
        ingestionQueue.add.mockResolvedValue({ id: 'job-789' });

        const result = await service.importMedia(789, MediaType.MOVIE);

        expect(result.status).toBe(ImportStatus.IMPORTING);
        expect(mediaRepository.upsertStub).toHaveBeenCalled();
      });
    });
  });
});
