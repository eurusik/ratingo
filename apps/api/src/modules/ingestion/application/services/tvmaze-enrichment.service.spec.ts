import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TvMazeEnrichmentService } from './tvmaze-enrichment.service';
import {
  EPISODE_SCHEDULE_PORT,
  type EpisodeSchedulePort,
} from '@/modules/ingestion/domain/ports/episode-schedule.port';
import { MediaType } from '@/common/enums/media-type.enum';
import { ShowStatus } from '@/common/enums/show-status.enum';
import { EpisodeScheduleUnavailableError } from '@/modules/ingestion/domain/errors/episode-schedule-unavailable.error';
import { NormalizedMedia } from '@/modules/ingestion/domain/models/normalized-media.model';

describe('TvMazeEnrichmentService', () => {
  let service: TvMazeEnrichmentService;
  let episodeSchedule: jest.Mocked<EpisodeSchedulePort>;

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
    const mockEpisodeSchedule = {
      getEpisodesByImdbId: jest.fn(),
      getEpisodesByShowName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TvMazeEnrichmentService,
        { provide: EPISODE_SCHEDULE_PORT, useValue: mockEpisodeSchedule },
      ],
    }).compile();

    service = module.get<TvMazeEnrichmentService>(TvMazeEnrichmentService);
    episodeSchedule = module.get(EPISODE_SCHEDULE_PORT);
  });

  describe('enrich', () => {
    describe('duplicate episodes', () => {
      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('keeps one episode per number and warns once', async () => {
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        const episode = (number: number) => ({
          seasonNumber: 1,
          number,
          title: number === 11 ? "The Siblings' Room" : `Episode ${number}`,
          airDate: new Date(`2024-05-${String(number).padStart(2, '0')}T03:00:00Z`),
        });
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
          episode(10),
          episode(11),
          episode(11),
          episode(12),
        ]);

        const result = await service.enrich(mockShow);

        const season = result.details?.seasons?.find((s) => s.number === 1);
        expect(season?.episodes.map((e) => e.number)).toEqual([10, 11, 12]);
        expect(season?.episodeCount).toBe(3);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'TVMaze returned duplicate episodes',
            tmdbId: 1000,
            duplicates: ['S1E11'],
          }),
        );
      });
    });

    describe('skipped seasons', () => {
      afterEach(() => {
        jest.restoreAllMocks();
      });

      const episode = (seasonNumber: number, airDate: string) => ({
        seasonNumber,
        number: 1,
        title: `S${seasonNumber}E1`,
        airDate: new Date(airDate),
        runtime: 45,
        overview: '',
      });

      it('writes one summary line per show instead of a warning per season', async () => {
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
          episode(1, '2020-01-01'),
          episode(3, '2021-01-01'),
          episode(4, '2022-01-01'),
        ]);

        await service.enrich(mockShow);

        expect(warn).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'TVMaze seasons skipped for tt1234567',
            skippedSeasons: 2,
            notInTmdb: 2,
            yearMismatch: 0,
            skippedSeasonNumbers: '3,4',
          }),
        );
      });

      it('stays silent when every season is used', async () => {
        const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue([episode(1, '2020-01-01')]);

        await service.enrich(mockShow);

        expect(log).not.toHaveBeenCalled();
      });

      it('counts year mismatches separately', async () => {
        const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
        const dated = {
          ...mockShow,
          details: {
            seasons: [
              {
                number: 1,
                tmdbId: 101,
                episodeCount: 0,
                episodes: [],
                airDate: new Date('2010-01-01'),
              },
            ],
          },
        };
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue([episode(1, '2020-01-01')]);

        await service.enrich(dated);

        expect(log).toHaveBeenCalledWith(
          expect.objectContaining({ notInTmdb: 0, yearMismatch: 1, skippedSeasonNumbers: '1' }),
        );
      });
    });

    it('should skip IMDb lookup and try name search when no imdbId', async () => {
      const mediaWithoutImdb = {
        ...mockShow,
        externalIds: { tmdbId: 1000 },
      };
      episodeSchedule.getEpisodesByShowName.mockResolvedValue([]);

      const result = await service.enrich(mediaWithoutImdb);

      expect(result).toEqual(mediaWithoutImdb);
      expect(episodeSchedule.getEpisodesByImdbId).not.toHaveBeenCalled();
      expect(episodeSchedule.getEpisodesByShowName).toHaveBeenCalled();
    });

    it('should return media unchanged if TVMaze returns no episodes', async () => {
      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([]);
      episodeSchedule.getEpisodesByShowName.mockResolvedValue([]);

      const result = await service.enrich(mockShow);

      expect(result).toEqual(mockShow);
    });

    it('should merge TVMaze episodes with TMDB season metadata', async () => {
      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
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

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
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

    it('should write explicit null nextAirDate when no future episode exists (clears stale value)', async () => {
      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
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
      ]);
      const staleShow: NormalizedMedia = {
        ...mockShow,
        details: { ...mockShow.details, nextAirDate: new Date('2021-01-01') },
      };

      const result = await service.enrich(staleShow);

      expect(result.details?.nextAirDate).toBeNull();
    });

    it('should keep TMDB nextAirDate when TVMaze has no future episode but TMDB date is in the future', async () => {
      const tmdbNext = new Date();
      tmdbNext.setDate(tmdbNext.getDate() + 3);
      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
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
      ]);

      const result = await service.enrich({
        ...mockShow,
        details: { ...mockShow.details, nextAirDate: tmdbNext },
      });

      expect(result.details?.nextAirDate).toEqual(tmdbNext);
    });

    it('should calculate lastAirDate from already-aired episodes', async () => {
      const pastDate1 = new Date('2024-01-01');
      const pastDate2 = new Date('2024-01-15'); // Most recent
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
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

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
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
      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
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

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
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

    it('passes a TVMaze failure on instead of treating it as no data', async () => {
      const failure = new EpisodeScheduleUnavailableError(503, 'down');
      episodeSchedule.getEpisodesByImdbId.mockRejectedValue(failure);

      await expect(service.enrich(mockShow)).rejects.toBe(failure);
      expect(episodeSchedule.getEpisodesByShowName).not.toHaveBeenCalled();
    });

    it('passes a failed name search on after the IMDb lookup found nothing', async () => {
      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([]);
      episodeSchedule.getEpisodesByShowName.mockRejectedValue(
        new EpisodeScheduleUnavailableError(429, 'rate limited'),
      );

      await expect(service.enrich(mockShow)).rejects.toBeInstanceOf(
        EpisodeScheduleUnavailableError,
      );
    });

    it('should fallback to name search when IMDb lookup returns empty', async () => {
      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([]);
      episodeSchedule.getEpisodesByShowName.mockResolvedValue([
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

      const result = await service.enrich({ ...mockShow, releaseDate: new Date('2024-01-01') });

      expect(episodeSchedule.getEpisodesByShowName).toHaveBeenCalledWith('Test Show Original');
      expect(result.details?.seasons?.[0].episodes).toHaveLength(1);
      expect(result.details?.seasons?.[0].episodes[0].title).toBe('Name Fallback Ep');
    });

    it('should try originalTitle first, then title for name search', async () => {
      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([]);
      episodeSchedule.getEpisodesByShowName.mockResolvedValueOnce([]); // originalTitle miss
      episodeSchedule.getEpisodesByShowName.mockResolvedValueOnce([
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

      const result = await service.enrich({ ...mockShow, releaseDate: new Date('2024-01-01') });

      expect(episodeSchedule.getEpisodesByShowName).toHaveBeenCalledTimes(2);
      expect(episodeSchedule.getEpisodesByShowName).toHaveBeenNthCalledWith(
        1,
        'Test Show Original',
      );
      expect(episodeSchedule.getEpisodesByShowName).toHaveBeenNthCalledWith(2, 'Test Show');
      expect(result.details?.seasons?.[0].episodes).toHaveLength(1);
    });

    it('should enrich via name search when no imdbId but show found by name', async () => {
      const mediaWithoutImdb = {
        ...mockShow,
        originalTitle: null,
        externalIds: { tmdbId: 1000 },
        releaseDate: new Date('2024-05-01'),
      };

      episodeSchedule.getEpisodesByShowName.mockResolvedValue([
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

      expect(episodeSchedule.getEpisodesByImdbId).not.toHaveBeenCalled();
      expect(episodeSchedule.getEpisodesByShowName).toHaveBeenCalledWith('Test Show');
      expect(result.details?.seasons?.[0].episodes).toHaveLength(1);
    });

    it('should reject name match when year difference > 1', async () => {
      const showFrom2020 = {
        ...mockShow,
        releaseDate: new Date('2020-01-01'),
      };

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([]);
      episodeSchedule.getEpisodesByShowName.mockResolvedValue([
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
      expect(episodeSchedule.getEpisodesByShowName).toHaveBeenCalledTimes(2); // Tried both names
    });

    it('should accept name match when year difference <= 1', async () => {
      const showFrom2024 = {
        ...mockShow,
        releaseDate: new Date('2024-01-01'),
      };

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([]);
      episodeSchedule.getEpisodesByShowName.mockResolvedValue([
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

    it('should reject name match when releaseDate is missing', async () => {
      const showWithoutReleaseDate = {
        ...mockShow,
        releaseDate: null,
      };

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([]);
      episodeSchedule.getEpisodesByShowName.mockResolvedValue([
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

      expect(result).toEqual(showWithoutReleaseDate);
    });

    it('should reject name match when episode airDate is missing', async () => {
      const showFrom2024 = {
        ...mockShow,
        releaseDate: new Date('2024-01-01'),
      };

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([]);
      episodeSchedule.getEpisodesByShowName.mockResolvedValue([
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

      expect(result).toEqual(showFrom2024);
    });

    it('should update totalEpisodes when TVMaze finds more episodes than TMDB metadata', async () => {
      const showWithStaleTmdbCount = {
        ...mockShow,
        details: {
          ...mockShow.details,
          totalEpisodes: 6,
          seasons: [{ number: 1, name: 'Season 1', tmdbId: 101, episodeCount: 6, episodes: [] }],
        },
      };

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) => ({
          seasonNumber: 1,
          number: i + 1,
          title: `Episode ${i + 1}`,
          airDate: new Date('2024-01-01'),
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        })),
      );

      const result = await service.enrich(showWithStaleTmdbCount);

      expect(result.details?.totalEpisodes).toBe(12);
      expect(result.details?.seasons?.[0].episodeCount).toBe(12);
    });

    it('keeps the TMDB season size when TVMaze lists only part of an airing season', async () => {
      const airingShow = {
        ...mockShow,
        details: {
          ...mockShow.details,
          totalEpisodes: 10,
          seasons: [{ number: 1, name: 'Season 1', tmdbId: 101, episodeCount: 10, episodes: [] }],
        },
      };

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue(
        Array.from({ length: 4 }, (_, i) => ({
          seasonNumber: 1,
          number: i + 1,
          title: `Episode ${i + 1}`,
          airDate: new Date('2024-01-01'),
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        })),
      );

      const result = await service.enrich(airingShow);

      expect(result.details?.seasons?.[0].episodeCount).toBe(10);
      expect(result.details?.seasons?.[0].episodes).toHaveLength(4);
      expect(result.details?.totalEpisodes).toBe(10);
    });

    it('trusts the TVMaze list for an earlier season of an airing show', async () => {
      const airingShow = {
        ...mockShow,
        details: {
          ...mockShow.details,
          seasons: [
            { number: 1, name: 'Season 1', tmdbId: 101, episodeCount: 10, episodes: [] },
            { number: 2, name: 'Season 2', tmdbId: 102, episodeCount: 6, episodes: [] },
          ],
        },
      };

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
        ...Array.from({ length: 8 }, (_, i) => ({
          seasonNumber: 1,
          number: i + 1,
          title: `Episode ${i + 1}`,
          airDate: new Date('2024-01-01'),
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          seasonNumber: 2,
          number: i + 1,
          title: `Episode ${i + 1}`,
          airDate: new Date('2025-01-01'),
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        })),
      ]);

      const result = await service.enrich(airingShow);

      expect(result.details?.seasons?.map((season) => season.episodeCount)).toEqual([8, 6]);
      expect(result.details?.totalEpisodes).toBe(14);
    });

    it('should exclude Season 0 from totalEpisodes calculation', async () => {
      const showWithSpecialsAndSeason = {
        ...mockShow,
        details: {
          totalEpisodes: 12,
          seasons: [
            { number: 0, name: 'Specials', tmdbId: 100, episodeCount: 3, episodes: [] },
            { number: 1, name: 'Season 1', tmdbId: 101, episodeCount: 12, episodes: [] },
          ],
        },
      };

      episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
        ...Array.from({ length: 3 }, (_, i) => ({
          seasonNumber: 0,
          number: i + 1,
          title: `Special ${i + 1}`,
          airDate: new Date('2020-01-01'),
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        })),
        ...Array.from({ length: 12 }, (_, i) => ({
          seasonNumber: 1,
          number: i + 1,
          title: `Episode ${i + 1}`,
          airDate: new Date('2024-01-01'),
          runtime: 60,
          overview: null,
          stillPath: null,
          rating: null,
        })),
      ]);

      const result = await service.enrich(showWithSpecialsAndSeason);

      // Season 0 must not inflate totalEpisodes
      expect(result.details?.totalEpisodes).toBe(12);
    });

    describe('season sanity checks against TMDB', () => {
      const episode = (seasonNumber: number, number: number, airDate: string | null) => ({
        seasonNumber,
        number,
        title: `S${seasonNumber}E${number}`,
        airDate: airDate ? new Date(airDate) : null,
        runtime: 60,
        overview: null,
        stillPath: null,
        rating: null,
      });

      const showWithTwoSeasons: NormalizedMedia = {
        ...mockShow,
        details: {
          totalEpisodes: 15,
          seasons: [
            {
              number: 1,
              name: 'Season 1',
              tmdbId: 101,
              airDate: new Date('2022-10-02'),
              episodeCount: 7,
              episodes: [],
            },
            {
              number: 2,
              name: 'Season 2',
              tmdbId: 102,
              airDate: new Date('2024-05-12'),
              episodeCount: 8,
              episodes: [],
            },
          ],
        },
      };

      const tvMazeSeasons = (...extra: ReturnType<typeof episode>[]) => [
        ...Array.from({ length: 7 }, (_, i) => episode(1, i + 1, '2022-10-02')),
        ...Array.from({ length: 8 }, (_, i) => episode(2, i + 1, '2024-05-12')),
        ...extra,
      ];

      it('should accept the next season TVMaze announces before TMDB lists it', async () => {
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue(
          tvMazeSeasons(
            episode(3, 1, '2099-06-07T01:00:00Z'),
            episode(3, 2, '2099-06-14T01:00:00Z'),
          ),
        );

        const result = await service.enrich({
          ...showWithTwoSeasons,
          details: { ...showWithTwoSeasons.details, status: ShowStatus.RETURNING_SERIES },
        });

        const announced = result.details?.seasons?.find((s) => s.number === 3);
        expect(result.details?.seasons?.map((s) => s.number)).toEqual([1, 2, 3]);
        expect(announced).toMatchObject({ tmdbId: undefined, name: undefined, episodeCount: 2 });
        expect(result.details?.totalEpisodes).toBe(17);
        expect(result.details?.nextAirDate).toEqual(new Date('2099-06-07T01:00:00Z'));
      });

      it('should drop a TVMaze season two or more past the last TMDB season', async () => {
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue(
          tvMazeSeasons(episode(4, 1, '2099-06-07')),
        );

        const result = await service.enrich(showWithTwoSeasons);

        expect(result.details?.seasons?.map((s) => s.number)).toEqual([1, 2]);
        expect(result.details?.nextAirDate).toBeNull();
      });

      it('should drop an undated next season', async () => {
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue(tvMazeSeasons(episode(3, 1, null)));

        const result = await service.enrich(showWithTwoSeasons);

        expect(result.details?.seasons?.map((s) => s.number)).toEqual([1, 2]);
      });

      it.each([ShowStatus.ENDED, ShowStatus.CANCELED])(
        'should drop a next season of a show TMDB marks %s (spin-off folded in)',
        async (status) => {
          episodeSchedule.getEpisodesByImdbId.mockResolvedValue(
            tvMazeSeasons(episode(3, 1, '2099-06-07')),
          );

          const result = await service.enrich({
            ...showWithTwoSeasons,
            details: { ...showWithTwoSeasons.details, status },
          });

          expect(result.details?.seasons?.map((s) => s.number)).toEqual([1, 2]);
          expect(result.details?.totalEpisodes).toBe(15);
          expect(result.details?.nextAirDate).toBeNull();
        },
      );

      it('should keep the TMDB season when the TVMaze season airs in a different year', async () => {
        const anthologySeason: NormalizedMedia = {
          ...mockShow,
          details: {
            totalEpisodes: 8,
            seasons: [
              {
                number: 1,
                name: 'Miniseries',
                tmdbId: 301,
                airDate: new Date('2026-09-17'),
                episodeCount: 8,
                episodes: [],
              },
            ],
          },
        };
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue(
          Array.from({ length: 10 }, (_, i) => episode(1, i + 1, '2022-09-21')),
        );

        const result = await service.enrich(anthologySeason);

        expect(result).toEqual(anthologySeason);
      });

      it('should accept a TVMaze season without TMDB air date', async () => {
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue([episode(1, 1, '2020-01-01')]);

        const result = await service.enrich(mockShow);

        expect(result.details?.seasons?.[0].episodes).toHaveLength(1);
      });

      it('should accept every TVMaze season when TMDB lists no seasons', async () => {
        const showWithoutSeasons: NormalizedMedia = { ...mockShow, details: {} };
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue([
          episode(1, 1, '2020-01-01'),
          episode(2, 1, '2021-01-01'),
        ]);

        const result = await service.enrich(showWithoutSeasons);

        expect(result.details?.seasons?.map((s) => s.number)).toEqual([1, 2]);
        expect(result.details?.totalEpisodes).toBe(2);
      });

      it('should lower totalEpisodes when TVMaze lists fewer episodes of a finished show', async () => {
        const overcounted: NormalizedMedia = {
          ...mockShow,
          details: {
            status: ShowStatus.ENDED,
            totalEpisodes: 5,
            seasons: [{ number: 1, name: 'Season 1', tmdbId: 101, episodeCount: 5, episodes: [] }],
          },
        };
        episodeSchedule.getEpisodesByImdbId.mockResolvedValue(
          Array.from({ length: 4 }, (_, i) => episode(1, i + 1, '2026-09-25')),
        );

        const result = await service.enrich(overcounted);

        expect(result.details?.totalEpisodes).toBe(4);
        expect(result.details?.seasons?.[0].episodeCount).toBe(4);
      });

      it('should validate name matches against the earliest air date, not the first item', async () => {
        const showFrom2026: NormalizedMedia = {
          ...mockShow,
          externalIds: { tmdbId: 1000 },
          releaseDate: new Date('2026-09-17'),
        };
        episodeSchedule.getEpisodesByShowName.mockResolvedValue([
          episode(3, 1, '2026-09-17'),
          episode(1, 1, '2022-09-21'),
        ]);

        const result = await service.enrich(showFrom2026);

        expect(result).toEqual(showFrom2026);
      });
    });

    it('should deduplicate when originalTitle equals title', async () => {
      const mediaWithSameNames = {
        ...mockShow,
        originalTitle: 'Test Show',
        title: 'Test Show',
        externalIds: { tmdbId: 1000 },
      };

      episodeSchedule.getEpisodesByShowName.mockResolvedValue([]);

      await service.enrich(mediaWithSameNames);

      expect(episodeSchedule.getEpisodesByShowName).toHaveBeenCalledTimes(1);
      expect(episodeSchedule.getEpisodesByShowName).toHaveBeenCalledWith('Test Show');
    });
  });
});
