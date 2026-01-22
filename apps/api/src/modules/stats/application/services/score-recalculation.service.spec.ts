import { Test, TestingModule } from '@nestjs/testing';
import { ScoreRecalculationService } from './score-recalculation.service';
import { STATS_REPOSITORY } from '../../domain/repositories/stats.repository.interface';
import { MEDIA_REPOSITORY } from '../../../catalog/public';
import { ScoreCalculatorService } from '../../../shared/score-calculator';
import { MediaType } from '@/common/enums/media-type.enum';

describe('ScoreRecalculationService', () => {
  let service: ScoreRecalculationService;
  let scoreCalculator: jest.Mocked<ScoreCalculatorService>;
  let statsRepository: any;
  let mediaRepository: any;

  const createScoreData = (id: string, tmdbId: number) => ({
    id,
    tmdbId,
    popularity: 85.5,
    totalWatchers: 10000,
    watchersCount: 500,
    ratingImdb: 8.5,
    ratingTrakt: 8.2,
    ratingMetacritic: 75,
    ratingRottenTomatoes: 88,
    voteCountImdb: 25000,
    voteCountTrakt: 5000,
    releaseDate: new Date('2024-01-15'),
    lastAirDate: null,
  });

  const mockScores = {
    ratingoScore: 85,
    qualityScore: 80,
    popularityScore: 75,
    freshnessScore: 90,
  };

  beforeEach(async () => {
    scoreCalculator = {
      calculate: jest.fn().mockReturnValue(mockScores),
    } as any;

    statsRepository = {
      bulkUpsert: jest.fn().mockResolvedValue(undefined),
    };

    mediaRepository = {
      findIdsForRecalculation: jest.fn(),
      findManyForScoring: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoreRecalculationService,
        { provide: ScoreCalculatorService, useValue: scoreCalculator },
        { provide: STATS_REPOSITORY, useValue: statsRepository },
        { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
      ],
    }).compile();

    service = module.get<ScoreRecalculationService>(ScoreRecalculationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recalculateScores', () => {
    it('should process items in batches', async () => {
      const batch1Ids = ['id-1', 'id-2'];
      const batch2Ids = ['id-3'];

      mediaRepository.findIdsForRecalculation
        .mockResolvedValueOnce(batch1Ids)
        .mockResolvedValueOnce(batch2Ids)
        .mockResolvedValueOnce([]);

      mediaRepository.findManyForScoring
        .mockResolvedValueOnce([createScoreData('id-1', 100), createScoreData('id-2', 101)])
        .mockResolvedValueOnce([createScoreData('id-3', 102)]);

      const result = await service.recalculateScores({ batchSize: 2 });

      expect(result.total).toBe(3);
      expect(mediaRepository.findIdsForRecalculation).toHaveBeenCalledTimes(3);
      expect(statsRepository.bulkUpsert).toHaveBeenCalledTimes(2);
      expect(scoreCalculator.calculate).toHaveBeenCalledTimes(3);
    });

    it('should return zero when no items to process', async () => {
      mediaRepository.findIdsForRecalculation.mockResolvedValue([]);

      const result = await service.recalculateScores({});

      expect(result.total).toBe(0);
      expect(statsRepository.bulkUpsert).not.toHaveBeenCalled();
    });

    it('should use default batch size of 100', async () => {
      mediaRepository.findIdsForRecalculation.mockResolvedValue([]);

      await service.recalculateScores({});

      expect(mediaRepository.findIdsForRecalculation).toHaveBeenCalledWith({
        type: undefined,
        limit: 100,
        offset: 0,
      });
    });

    it('should filter by media type when provided', async () => {
      mediaRepository.findIdsForRecalculation.mockResolvedValue([]);

      await service.recalculateScores({ type: MediaType.MOVIE, batchSize: 50 });

      expect(mediaRepository.findIdsForRecalculation).toHaveBeenCalledWith({
        type: MediaType.MOVIE,
        limit: 50,
        offset: 0,
      });
    });

    it('should correctly map scores to stats', async () => {
      const ids = ['id-1'];
      mediaRepository.findIdsForRecalculation.mockResolvedValueOnce(ids).mockResolvedValueOnce([]);
      mediaRepository.findManyForScoring.mockResolvedValue([createScoreData('id-1', 100)]);

      await service.recalculateScores({ batchSize: 10 });

      expect(statsRepository.bulkUpsert).toHaveBeenCalledWith([
        {
          mediaItemId: 'id-1',
          ratingoScore: 85,
          qualityScore: 80,
          popularityScore: 75,
          freshnessScore: 90,
        },
      ]);
    });

    it('should increment offset correctly', async () => {
      mediaRepository.findIdsForRecalculation
        .mockResolvedValueOnce(['id-1', 'id-2'])
        .mockResolvedValueOnce(['id-3'])
        .mockResolvedValueOnce([]);

      mediaRepository.findManyForScoring
        .mockResolvedValueOnce([createScoreData('id-1', 1), createScoreData('id-2', 2)])
        .mockResolvedValueOnce([createScoreData('id-3', 3)]);

      await service.recalculateScores({ batchSize: 2 });

      expect(mediaRepository.findIdsForRecalculation).toHaveBeenNthCalledWith(1, {
        type: undefined,
        limit: 2,
        offset: 0,
      });
      expect(mediaRepository.findIdsForRecalculation).toHaveBeenNthCalledWith(2, {
        type: undefined,
        limit: 2,
        offset: 2,
      });
      expect(mediaRepository.findIdsForRecalculation).toHaveBeenNthCalledWith(3, {
        type: undefined,
        limit: 2,
        offset: 4,
      });
    });

    it('should not call bulkUpsert when scoreDataList is empty', async () => {
      mediaRepository.findIdsForRecalculation
        .mockResolvedValueOnce(['id-1'])
        .mockResolvedValueOnce([]);
      mediaRepository.findManyForScoring.mockResolvedValue([]);

      const result = await service.recalculateScores({ batchSize: 10 });

      expect(result.total).toBe(0);
      expect(statsRepository.bulkUpsert).not.toHaveBeenCalled();
    });
  });
});
