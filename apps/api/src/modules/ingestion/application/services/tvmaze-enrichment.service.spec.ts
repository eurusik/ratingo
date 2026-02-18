import { Test, TestingModule } from '@nestjs/testing';
import { TvMazeEnrichmentService } from './tvmaze-enrichment.service';
import { TvMazeAdapter } from '../../infrastructure/adapters/tvmaze/tvmaze.adapter';
import { MediaType } from '@/common/enums/media-type.enum';
import { NormalizedMedia } from '../../domain/models/normalized-media.model';

describe('TvMazeEnrichmentService', () => {
  let service: TvMazeEnrichmentService;
  let tvMazeAdapter: jest.Mocked<TvMazeAdapter>;

  const mockShow: NormalizedMedia = {
    type: MediaType.SHOW,
    title: 'Test Show',
    originalTitle: 'Test Show Original',
    slug: 'test-show',
    externalIds: { tmdbId: 1000, imdbId: 'tt1234567' },
    popularity: 100,
    rating: 8.5,
    voteCount: 10000,
    isAdult: false,
    genres: [],
    credits: { cast: [], crew: [] },
    details: {
      seasons: [{ number: 1, name: 'Season 1', tmdbId: 101, episodeCount: 0, episodes: [] }],
    },
  };

  beforeEach(async () => {
    const mockTvMazeAdapter = {
      getEpisodesByImdbId: jest.fn(),
      getEpisodesByShowName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TvMazeEnrichmentService, { provide: TvMazeAdapter, useValue: mockTvMazeAdapter }],
    }).compile();

    service = module.get<TvMazeEnrichmentService>(TvMazeEnrichmentService);
    tvMazeAdapter = module.get(TvMazeAdapter);
  });

  describe('enrich', () => {
    it('should skip IMDb lookup and try name search when no imdbId', async () => {
      const mediaWithoutImdb = {
        ...mockShow,
        externalIds: { tmdbId: 1000 },
      };
      tvMazeAdapter.getEpisodesByShowName.mockResolvedValue([]);

      const result = await service.enrich(mediaWithoutImdb);

      expect(result).toEqual(mediaWithoutImdb);
      expect(tvMazeAdapter.getEpisodesByImdbId).not.toHaveBeenCalled();
      expect(tvMazeAdapter.getEpisodesByShowName).toHaveBeenCalled();
    });

    it('should return media unchanged if TVMaze returns no episodes', async () => {
      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([]);
      tvMazeAdapter.getEpisodesByShowName.mockResolvedValue([]);

      const result = await service.enrich(mockShow);

      expect(result).toEqual(mockShow);
    });

    it('should merge TVMaze episodes with TMDB season metadata', async () => {
      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Pilot',
          airDate: new Date('2020-01-01'),
          runtime: 60,
          overview: 'First episode',
          stillPath: null,
          rating: 8.0,
        },
        {
          seasonNumber: 1,
          number: 2,
          title: 'Episode 2',
          airDate: new Date('2020-01-08'),
          runtime: 60,
          overview: 'Second episode',
          stillPath: null,
          rating: 8.5,
        },
      ]);

      const result = await service.enrich(mockShow);

      expect(result.details?.seasons).toHaveLength(1);
      expect(result.details?.seasons?.[0]).toMatchObject({
        number: 1,
        name: 'Season 1', // Inherited from TMDB
        tmdbId: 101,
        episodeCount: 2,
      });
      expect(result.details?.seasons?.[0].episodes).toHaveLength(2);
      expect(result.details?.seasons?.[0].episodes[0].title).toBe('Pilot');
    });

    it('should calculate nextAirDate from future episodes', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Past Episode',
          airDate: new Date('2020-01-01'),
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        },
        {
          seasonNumber: 1,
          number: 2,
          title: 'Future Episode',
          airDate: futureDate,
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(mockShow);

      expect(result.details?.nextAirDate).toEqual(futureDate);
    });

    it('should calculate lastAirDate from already-aired episodes', async () => {
      const pastDate1 = new Date('2024-01-01');
      const pastDate2 = new Date('2024-01-15'); // Most recent
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Episode 1',
          airDate: pastDate1,
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        },
        {
          seasonNumber: 1,
          number: 2,
          title: 'Episode 2',
          airDate: pastDate2,
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        },
        {
          seasonNumber: 1,
          number: 3,
          title: 'Future Episode',
          airDate: futureDate,
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(mockShow);

      expect(result.details?.lastAirDate).toEqual(pastDate2);
      expect(result.details?.nextAirDate).toEqual(futureDate);
    });

    it('should override TMDB lastAirDate with TVMaze data', async () => {
      const tmdbLastAirDate = new Date('2023-06-01');
      const tvMazeLastAirDate = new Date('2024-02-05');

      const showWithTmdbDate = {
        ...mockShow,
        details: {
          ...mockShow.details,
          lastAirDate: tmdbLastAirDate,
        },
      };

      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Recent Episode',
          airDate: tvMazeLastAirDate,
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(showWithTmdbDate);

      // TVMaze date should override TMDB date
      expect(result.details?.lastAirDate).toEqual(tvMazeLastAirDate);
    });

    it('should fallback to TMDB lastAirDate if no aired episodes in TVMaze', async () => {
      const tmdbLastAirDate = new Date('2023-06-01');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const showWithTmdbDate = {
        ...mockShow,
        details: {
          ...mockShow.details,
          lastAirDate: tmdbLastAirDate,
        },
      };

      // Only future episodes from TVMaze
      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Future Episode',
          airDate: futureDate,
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(showWithTmdbDate);

      // Should keep TMDB date as fallback
      expect(result.details?.lastAirDate).toEqual(tmdbLastAirDate);
    });

    it('should preserve TMDB-only seasons (e.g. Specials)', async () => {
      const showWithSpecials = {
        ...mockShow,
        details: {
          seasons: [
            { number: 0, name: 'Specials', tmdbId: 100, episodeCount: 5, episodes: [] },
            { number: 1, name: 'Season 1', tmdbId: 101, episodeCount: 0, episodes: [] },
          ],
        },
      };

      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Ep 1',
          airDate: new Date('2020-01-01'),
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(showWithSpecials);

      expect(result.details?.seasons).toHaveLength(2);
      expect(result.details?.seasons?.find((s) => s.number === 0)?.name).toBe('Specials');
    });

    it('should handle TVMaze failure gracefully', async () => {
      tvMazeAdapter.getEpisodesByImdbId.mockRejectedValue(new Error('TVMaze API Error'));

      const result = await service.enrich(mockShow);

      expect(result).toEqual(mockShow);
    });

    it('should fallback to name search when IMDb lookup returns empty', async () => {
      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([]);
      tvMazeAdapter.getEpisodesByShowName.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Name Fallback Ep',
          airDate: new Date('2024-01-01'),
          runtime: 45,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(mockShow);

      expect(tvMazeAdapter.getEpisodesByShowName).toHaveBeenCalledWith('Test Show Original');
      expect(result.details?.seasons?.[0].episodes).toHaveLength(1);
      expect(result.details?.seasons?.[0].episodes[0].title).toBe('Name Fallback Ep');
    });

    it('should try originalTitle first, then title for name search', async () => {
      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([]);
      tvMazeAdapter.getEpisodesByShowName.mockResolvedValueOnce([]); // originalTitle miss
      tvMazeAdapter.getEpisodesByShowName.mockResolvedValueOnce([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Found by title',
          airDate: new Date('2024-01-01'),
          runtime: 45,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(mockShow);

      expect(tvMazeAdapter.getEpisodesByShowName).toHaveBeenCalledTimes(2);
      expect(tvMazeAdapter.getEpisodesByShowName).toHaveBeenNthCalledWith(1, 'Test Show Original');
      expect(tvMazeAdapter.getEpisodesByShowName).toHaveBeenNthCalledWith(2, 'Test Show');
      expect(result.details?.seasons?.[0].episodes).toHaveLength(1);
    });

    it('should enrich via name search when no imdbId but show found by name', async () => {
      const mediaWithoutImdb = {
        ...mockShow,
        originalTitle: null,
        externalIds: { tmdbId: 1000 },
      };

      tvMazeAdapter.getEpisodesByShowName.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Ep via name',
          airDate: new Date('2024-05-01'),
          runtime: 50,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(mediaWithoutImdb);

      expect(tvMazeAdapter.getEpisodesByImdbId).not.toHaveBeenCalled();
      expect(tvMazeAdapter.getEpisodesByShowName).toHaveBeenCalledWith('Test Show');
      expect(result.details?.seasons?.[0].episodes).toHaveLength(1);
    });

    it('should reject name match when year difference > 1', async () => {
      const showFrom2020 = {
        ...mockShow,
        releaseDate: new Date('2020-01-01'),
      };

      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([]);
      tvMazeAdapter.getEpisodesByShowName.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Episode 1',
          airDate: new Date('2023-01-01'), // 3 years later - should reject
          runtime: 45,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(showFrom2020);

      // Should reject and return unchanged
      expect(result).toEqual(showFrom2020);
      expect(tvMazeAdapter.getEpisodesByShowName).toHaveBeenCalledTimes(2); // Tried both names
    });

    it('should accept name match when year difference <= 1', async () => {
      const showFrom2024 = {
        ...mockShow,
        releaseDate: new Date('2024-01-01'),
      };

      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([]);
      tvMazeAdapter.getEpisodesByShowName.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Episode 1',
          airDate: new Date('2024-10-01'), // Same year - should accept
          runtime: 45,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(showFrom2024);

      expect(result.details?.seasons?.[0].episodes).toHaveLength(1);
      expect(result.details?.seasons?.[0].episodes[0].title).toBe('Episode 1');
    });

    it('should skip year validation when releaseDate missing', async () => {
      const showWithoutReleaseDate = {
        ...mockShow,
        releaseDate: null,
      };

      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([]);
      tvMazeAdapter.getEpisodesByShowName.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Episode 1',
          airDate: new Date('2024-01-01'),
          runtime: 45,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(showWithoutReleaseDate);

      // Should accept without year check
      expect(result.details?.seasons?.[0].episodes).toHaveLength(1);
    });

    it('should skip year validation when episode airDate missing', async () => {
      const showFrom2024 = {
        ...mockShow,
        releaseDate: new Date('2024-01-01'),
      };

      tvMazeAdapter.getEpisodesByImdbId.mockResolvedValue([]);
      tvMazeAdapter.getEpisodesByShowName.mockResolvedValue([
        {
          seasonNumber: 1,
          number: 1,
          title: 'Episode 1',
          airDate: null, // No air date
          runtime: 45,
          overview: null,
          stillPath: null,
          rating: null,
        },
      ]);

      const result = await service.enrich(showFrom2024);

      // Should accept without year check
      expect(result.details?.seasons?.[0].episodes).toHaveLength(1);
    });

    it('should deduplicate when originalTitle equals title', async () => {
      const mediaWithSameNames = {
        ...mockShow,
        originalTitle: 'Test Show',
        title: 'Test Show',
        externalIds: { tmdbId: 1000 },
      };

      tvMazeAdapter.getEpisodesByShowName.mockResolvedValue([]);

      await service.enrich(mediaWithSameNames);

      expect(tvMazeAdapter.getEpisodesByShowName).toHaveBeenCalledTimes(1);
      expect(tvMazeAdapter.getEpisodesByShowName).toHaveBeenCalledWith('Test Show');
    });
  });
});
