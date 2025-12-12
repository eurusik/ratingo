import { Test, TestingModule } from '@nestjs/testing';
import { DropOffService } from './drop-off.service';
import { TraktRatingsAdapter } from '@/modules/ingestion/infrastructure/adapters/trakt/trakt-ratings.adapter';
import { DropOffAnalyzerService } from '@/modules/shared/drop-off-analyzer';
import { SHOW_REPOSITORY } from '@/modules/catalog/domain/repositories/show.repository.interface';

describe('DropOffService', () => {
  let service: DropOffService;
  let traktAdapter: jest.Mocked<TraktRatingsAdapter>;
  let dropOffAnalyzer: jest.Mocked<DropOffAnalyzerService>;
  let showRepository: any;

  beforeEach(async () => {
    const mockTraktAdapter = {
      getShowEpisodesForAnalysis: jest.fn(),
    };

    const mockDropOffAnalyzer = {
      analyze: jest.fn(),
    };

    const mockShowRepository = {
      findShowsForAnalysis: jest.fn(),
      saveDropOffAnalysis: jest.fn(),
      getDropOffAnalysis: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DropOffService,
        { provide: TraktRatingsAdapter, useValue: mockTraktAdapter },
        { provide: DropOffAnalyzerService, useValue: mockDropOffAnalyzer },
        { provide: SHOW_REPOSITORY, useValue: mockShowRepository },
      ],
    }).compile();

    service = module.get<DropOffService>(DropOffService);
    traktAdapter = module.get(TraktRatingsAdapter);
    dropOffAnalyzer = module.get(DropOffAnalyzerService);
    showRepository = module.get(SHOW_REPOSITORY);
  });

  describe('analyzeShow', () => {
    it('should return null when no episode data from Trakt', async () => {
      traktAdapter.getShowEpisodesForAnalysis.mockResolvedValue(null);

      const result = await service.analyzeShow(12345);

      expect(result).toBeNull();
      expect(dropOffAnalyzer.analyze).not.toHaveBeenCalled();
      expect(showRepository.saveDropOffAnalysis).not.toHaveBeenCalled();
    });

    it('should return null when seasons array is empty', async () => {
      traktAdapter.getShowEpisodesForAnalysis.mockResolvedValue({
        traktId: 100,
        seasons: [],
      });

      const result = await service.analyzeShow(12345);

      expect(result).toBeNull();
    });

    it('should analyze and save drop-off data', async () => {
      const episodeData = {
        traktId: 100,
        seasons: [
          {
            number: 1,
            episodes: [
              { number: 1, title: 'Pilot', rating: 8.5, votes: 10000 },
              { number: 2, title: 'Episode 2', rating: 8.0, votes: 9000 },
            ],
          },
        ],
      };

      const analysisResult = {
        dropOffPoint: null,
        dropOffPercent: 0,
        overallRetention: 90,
        seasonEngagement: [{ season: 1, avgRating: 8.25, avgVotes: 9500, engagementDrop: 0 }],
        insight: 'Серіал тримає аудиторію стабільно',
        insightType: 'steady' as const,
        analyzedAt: '2025-12-08T00:00:00.000Z',
        episodesAnalyzed: 2,
      };

      traktAdapter.getShowEpisodesForAnalysis.mockResolvedValue(episodeData);
      dropOffAnalyzer.analyze.mockReturnValue(analysisResult);

      const result = await service.analyzeShow(12345);

      expect(result).toEqual(analysisResult);
      expect(dropOffAnalyzer.analyze).toHaveBeenCalledWith(episodeData.seasons);
      expect(showRepository.saveDropOffAnalysis).toHaveBeenCalledWith(12345, analysisResult);
    });

    it('should handle errors gracefully', async () => {
      traktAdapter.getShowEpisodesForAnalysis.mockRejectedValue(new Error('API Error'));

      const result = await service.analyzeShow(12345);

      expect(result).toBeNull();
    });
  });

  describe('analyzeAllShows', () => {
    it('should analyze multiple shows', async () => {
      const shows = [
        { tmdbId: 100, title: 'Show 1' },
        { tmdbId: 200, title: 'Show 2' },
      ];

      showRepository.findShowsForAnalysis.mockResolvedValue(shows);

      // Mock analyzeShow behavior
      traktAdapter.getShowEpisodesForAnalysis
        .mockResolvedValueOnce({
          traktId: 1,
          seasons: [{ number: 1, episodes: [{ number: 1, title: 'Ep1', rating: 8, votes: 1000 }] }],
        })
        .mockResolvedValueOnce({
          traktId: 2,
          seasons: [{ number: 1, episodes: [{ number: 1, title: 'Ep1', rating: 7, votes: 800 }] }],
        });

      dropOffAnalyzer.analyze.mockReturnValue({
        dropOffPoint: null,
        dropOffPercent: 0,
        overallRetention: 100,
        seasonEngagement: [],
        insight: 'Test',
        insightType: 'steady',
        analyzedAt: new Date().toISOString(),
        episodesAnalyzed: 1,
      });

      const result = await service.analyzeAllShows(2);

      expect(result).toEqual({ analyzed: 2, failed: 0 });
      expect(showRepository.findShowsForAnalysis).toHaveBeenCalledWith(2);
    });

    it('should count failed analyses', async () => {
      const shows = [
        { tmdbId: 100, title: 'Show 1' },
        { tmdbId: 200, title: 'Show 2' },
      ];

      showRepository.findShowsForAnalysis.mockResolvedValue(shows);

      // First succeeds, second fails
      traktAdapter.getShowEpisodesForAnalysis
        .mockResolvedValueOnce({
          traktId: 1,
          seasons: [{ number: 1, episodes: [{ number: 1, title: 'Ep1', rating: 8, votes: 1000 }] }],
        })
        .mockResolvedValueOnce(null); // No data

      dropOffAnalyzer.analyze.mockReturnValue({
        dropOffPoint: null,
        dropOffPercent: 0,
        overallRetention: 100,
        seasonEngagement: [],
        insight: 'Test',
        insightType: 'steady',
        analyzedAt: new Date().toISOString(),
        episodesAnalyzed: 1,
      });

      const result = await service.analyzeAllShows(2);

      expect(result).toEqual({ analyzed: 1, failed: 1 });
    });

    it('should use default limit of 50', async () => {
      showRepository.findShowsForAnalysis.mockResolvedValue([]);

      await service.analyzeAllShows();

      expect(showRepository.findShowsForAnalysis).toHaveBeenCalledWith(50);
    });
  });

  describe('getAnalysis', () => {
    it('should return analysis from repository', async () => {
      const mockAnalysis = {
        dropOffPoint: { season: 2, episode: 1, title: 'Test' },
        dropOffPercent: 45,
        overallRetention: 55,
        seasonEngagement: [],
        insight: 'Test insight',
        insightType: 'drops_late' as const,
        analyzedAt: '2025-12-08T00:00:00.000Z',
        episodesAnalyzed: 20,
      };

      showRepository.getDropOffAnalysis.mockResolvedValue(mockAnalysis);

      const result = await service.getAnalysis(12345);

      expect(result).toEqual(mockAnalysis);
      expect(showRepository.getDropOffAnalysis).toHaveBeenCalledWith(12345);
    });

    it('should return null when no analysis exists', async () => {
      showRepository.getDropOffAnalysis.mockResolvedValue(null);

      const result = await service.getAnalysis(12345);

      expect(result).toBeNull();
    });
  });
});
