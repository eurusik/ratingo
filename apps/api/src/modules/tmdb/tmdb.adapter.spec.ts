import { Test, TestingModule } from '@nestjs/testing';
import { TmdbAdapter } from './tmdb.adapter';
import tmdbConfig from '@/config/tmdb.config';
import { MediaType } from '@/common/enums/media-type.enum';
import { TmdbApiException } from '@/common/exceptions';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock TmdbMapper
jest.mock('./mappers/tmdb.mapper', () => ({
  TmdbMapper: {
    toDomain: jest.fn((data, type) => ({
      type,
      title: data.title || data.name,
      externalIds: { tmdbId: data.id },
      popularity: data.popularity,
      credits: { cast: [], crew: [] },
    })),
  },
}));

describe('TmdbAdapter', () => {
  let adapter: TmdbAdapter;

  const mockConfig = {
    apiKey: 'test-api-key',
    apiUrl: 'https://api.themoviedb.org/3',
  };

  beforeEach(async () => {
    mockFetch.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TmdbAdapter,
        { provide: tmdbConfig.KEY, useValue: mockConfig },
      ],
    }).compile();

    adapter = module.get<TmdbAdapter>(TmdbAdapter);
  });

  describe('getMovie', () => {
    it('should fetch movie with correct URL and params', async () => {
      const mockMovieData = {
        id: 550,
        title: 'Fight Club',
        popularity: 100,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMovieData),
      });

      const result = await adapter.getMovie(550);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Fight Club');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/movie/550')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api_key=test-api-key')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('language=uk-UA')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('include_video_language=uk%2Cen')
      );
    });

    it('should return null when movie not found (404)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await adapter.getMovie(999999);

      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(adapter.getMovie(550)).rejects.toThrow(TmdbApiException);
    });

    it('should include append_to_response params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 550, title: 'Test' }),
      });

      await adapter.getMovie(550);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('append_to_response=')
      );
    });
  });

  describe('getShow', () => {
    it('should fetch show with correct URL', async () => {
      const mockShowData = {
        id: 1000,
        name: 'Breaking Bad',
        popularity: 200,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockShowData),
      });

      const result = await adapter.getShow(1000);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Breaking Bad');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tv/1000')
      );
    });

    it('should return null when show not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await adapter.getShow(999999);

      expect(result).toBeNull();
    });
  });

  describe('getTrending', () => {
    it('should fetch trending and filter by media type', async () => {
      const mockTrendingData = {
        results: [
          { id: 1, media_type: 'movie' },
          { id: 2, media_type: 'tv' },
          { id: 3, media_type: 'person' }, // Should be filtered out
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTrendingData),
      });

      const result = await adapter.getTrending(1);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { tmdbId: 1, type: MediaType.MOVIE },
        { tmdbId: 2, type: MediaType.SHOW },
      ]);
    });

    it('should use movie endpoint when type is MOVIE', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await adapter.getTrending(1, MediaType.MOVIE);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/trending/movie/day')
      );
    });

    it('should use tv endpoint when type is SHOW', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await adapter.getTrending(1, MediaType.SHOW);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/trending/tv/day')
      );
    });

    it('should use correct endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await adapter.getTrending(2);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/trending/all/day')
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2')
      );
    });

    it('should use default page 1', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await adapter.getTrending();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1')
      );
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      const result = await adapter.getTrending();

      expect(result).toEqual([]);
    });

    it('should handle missing results field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await adapter.getTrending();

      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(adapter.getMovie(550)).rejects.toThrow('Failed to communicate with TMDB');
    });
  });
});
