import { Test, TestingModule } from '@nestjs/testing';

import { ReleaseStatus } from '../../../../common/enums/release-status.enum';
import { CLOCK_PORT } from '../../../shared/clock';
import { MovieVerdictService } from '../../../shared/verdict';
import { MovieNotFoundError } from '../../domain/errors';
import { MOVIE_REPOSITORY } from '../../domain/repositories/movie.repository.interface';

import { CatalogUserStateEnricher } from './catalog-userstate-enricher.service';
import { MovieDetailsService } from './movie-details.service';

describe('MovieDetailsService', () => {
  let service: MovieDetailsService;
  let movieRepository: any;
  let userStateEnricher: any;
  let clock: any;

  const mockMovie = {
    id: 'movie-1',
    tmdbId: 123,
    title: 'Test Movie',
    slug: 'test-movie',
    overview: 'A test movie',
    releaseDate: new Date('2024-06-01'),
    theatricalReleaseDate: new Date('2024-05-15'),
    digitalReleaseDate: new Date('2024-08-01'),
    stats: {
      ratingoScore: 75,
      qualityScore: 70,
      popularityScore: 60,
      liveWatchers: 100,
      totalWatchers: 5000,
    },
    externalRatings: {
      imdb: { rating: 7.5, voteCount: 10000 },
      tmdb: { rating: 7.2, voteCount: 5000 },
      trakt: null,
      metacritic: { rating: 72 },
      rottenTomatoes: null,
    },
    genres: [{ id: 'g1', name: 'Action', slug: 'action' }],
  };

  // Fixed test date for predictable tests
  const testNow = new Date('2025-01-15T12:00:00.000Z');

  beforeEach(async () => {
    const mockMovieRepository = {
      findBySlug: jest.fn(),
    };

    const mockUserStateEnricher = {
      enrichOne: jest.fn(async (_userId: string | null, item: any) => ({
        ...item,
        userState: null,
      })),
    };

    const mockClock = {
      now: jest.fn(() => testNow),
    };

    const mockVerdictService = {
      compute: jest.fn(() => ({
        type: 'quality',
        messageKey: 'strongRatings',
        context: '7.5',
        hintKey: 'forLater',
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovieDetailsService,
        { provide: MOVIE_REPOSITORY, useValue: mockMovieRepository },
        { provide: CLOCK_PORT, useValue: mockClock },
        { provide: CatalogUserStateEnricher, useValue: mockUserStateEnricher },
        { provide: MovieVerdictService, useValue: mockVerdictService },
      ],
    }).compile();

    service = module.get<MovieDetailsService>(MovieDetailsService);
    movieRepository = module.get(MOVIE_REPOSITORY);
    userStateEnricher = module.get(CatalogUserStateEnricher);
    clock = module.get(CLOCK_PORT);
  });

  describe('getBySlug', () => {
    it('should return enriched movie details when found', async () => {
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await service.getBySlug('test-movie');

      expect(movieRepository.findBySlug).toHaveBeenCalledWith('test-movie');
      expect(userStateEnricher.enrichOne).toHaveBeenCalled();
      expect(result.id).toBe('movie-1');
      expect(result.title).toBe('Test Movie');
      expect(result.userState).toBeNull();
    });

    it('should throw MovieNotFoundError when movie not found', async () => {
      movieRepository.findBySlug.mockResolvedValue(null);

      await expect(service.getBySlug('unknown-movie')).rejects.toThrow(MovieNotFoundError);
      await expect(service.getBySlug('unknown-movie')).rejects.toThrow(
        'Movie with slug "unknown-movie" not found',
      );
    });

    it('should include card metadata in response', async () => {
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await service.getBySlug('test-movie');

      expect(result.card).toBeDefined();
    });

    it('should compute releaseStatus correctly for released movie', async () => {
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await service.getBySlug('test-movie');

      // Movie with digitalReleaseDate in the past should be STREAMING
      expect(result.releaseStatus).toBe(ReleaseStatus.STREAMING);
    });

    it('should compute releaseStatus as upcoming for future release', async () => {
      const futureDate = new Date(testNow);
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const upcomingMovie = {
        ...mockMovie,
        releaseDate: futureDate,
        theatricalReleaseDate: futureDate,
        digitalReleaseDate: null,
      };
      movieRepository.findBySlug.mockResolvedValue(upcomingMovie);

      const result = await service.getBySlug('test-movie');

      expect(result.releaseStatus).toBe(ReleaseStatus.UPCOMING);
    });

    it('should compute releaseStatus as in_theaters when only theatrical release', async () => {
      const recentTheatrical = new Date(testNow);
      recentTheatrical.setDate(testNow.getDate() - 7); // Released 7 days ago

      const inTheatersMovie = {
        ...mockMovie,
        releaseDate: recentTheatrical,
        theatricalReleaseDate: recentTheatrical,
        digitalReleaseDate: null,
      };
      movieRepository.findBySlug.mockResolvedValue(inTheatersMovie);

      const result = await service.getBySlug('test-movie');

      expect(result.releaseStatus).toBe(ReleaseStatus.IN_THEATERS);
    });

    it('should include verdict in response', async () => {
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await service.getBySlug('test-movie');

      expect(result.verdict).toBeDefined();
      expect(result.verdict.type).toBeDefined();
      expect(result.verdict.hintKey).toBeDefined();
      expect(result.verdict.messageKey).toBeDefined();
    });

    it('should pass userId to enricher when provided', async () => {
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      await service.getBySlug('test-movie', 'user-123');

      expect(userStateEnricher.enrichOne).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({ id: 'movie-1' }),
      );
    });

    it('should pass null userId to enricher when not provided', async () => {
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      await service.getBySlug('test-movie');

      expect(userStateEnricher.enrichOne).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({ id: 'movie-1' }),
      );
    });

    it('should include userState from enricher in response', async () => {
      const mockUserState = {
        mediaItemId: 'movie-1',
        state: 'watched',
        progress: null,
      };
      userStateEnricher.enrichOne.mockResolvedValue({
        ...mockMovie,
        userState: mockUserState,
      });
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      const result = await service.getBySlug('test-movie', 'user-123');

      expect(result.userState).toEqual(mockUserState);
    });

    it('should use clock.now() for release status computation', async () => {
      movieRepository.findBySlug.mockResolvedValue(mockMovie);

      await service.getBySlug('test-movie');

      expect(clock.now).toHaveBeenCalled();
    });

    it('should handle movie with null stats gracefully', async () => {
      const movieWithNullStats = {
        ...mockMovie,
        stats: null,
      };
      movieRepository.findBySlug.mockResolvedValue(movieWithNullStats);

      const result = await service.getBySlug('test-movie');

      expect(result).toBeDefined();
      expect(result.verdict).toBeDefined();
    });

    it('should handle movie with null externalRatings gracefully', async () => {
      const movieWithNullRatings = {
        ...mockMovie,
        externalRatings: {
          imdb: null,
          tmdb: null,
          trakt: null,
          metacritic: null,
          rottenTomatoes: null,
        },
      };
      movieRepository.findBySlug.mockResolvedValue(movieWithNullRatings);

      const result = await service.getBySlug('test-movie');

      expect(result).toBeDefined();
      expect(result.verdict).toBeDefined();
    });
  });
});
