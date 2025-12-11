import { Test, TestingModule } from '@nestjs/testing';
import { OmdbAdapter } from './omdb.adapter';
import omdbConfig from '@/config/omdb.config';
import { MediaType } from '@/common/enums/media-type.enum';
import { OmdbApiException } from '@/common/exceptions';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('OmdbAdapter', () => {
  let adapter: OmdbAdapter;

  const mockConfig = {
    apiKey: 'test-api-key',
    apiUrl: 'https://www.omdbapi.com',
  };

  beforeEach(async () => {
    mockFetch.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [OmdbAdapter, { provide: omdbConfig.KEY, useValue: mockConfig }],
    }).compile();

    adapter = module.get<OmdbAdapter>(OmdbAdapter);
  });

  describe('getAggregatedRatings', () => {
    it('should fetch and parse all ratings correctly', async () => {
      const mockOmdbResponse = {
        imdbRating: '8.8',
        imdbVotes: '2,000,000',
        Metascore: '66',
        Ratings: [
          { Source: 'Internet Movie Database', Value: '8.8/10' },
          { Source: 'Rotten Tomatoes', Value: '79%' },
          { Source: 'Metacritic', Value: '66/100' },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOmdbResponse),
      });

      const result = await adapter.getAggregatedRatings('tt0137523', MediaType.MOVIE);

      expect(result).toEqual({
        imdbRating: 8.8,
        imdbVotes: 2000000,
        rottenTomatoes: 79,
        metacritic: 66,
        metascore: 66,
      });
    });

    it('should use correct type mapping for movies', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ imdbRating: 'N/A' }),
      });

      await adapter.getAggregatedRatings('tt0137523', MediaType.MOVIE);

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('type=movie'));
    });

    it('should use correct type mapping for shows', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ imdbRating: 'N/A' }),
      });

      await adapter.getAggregatedRatings('tt0903747', MediaType.SHOW);

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('type=series'));
    });

    it('should include IMDb ID in request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await adapter.getAggregatedRatings('tt0137523', MediaType.MOVIE);

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('i=tt0137523'));
    });

    it('should handle N/A values', async () => {
      const mockOmdbResponse = {
        imdbRating: 'N/A',
        imdbVotes: 'N/A',
        Metascore: 'N/A',
        Ratings: [],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOmdbResponse),
      });

      const result = await adapter.getAggregatedRatings('tt0000000', MediaType.MOVIE);

      expect(result).toEqual({
        imdbRating: null,
        imdbVotes: null,
        rottenTomatoes: null,
        metacritic: null,
        metascore: null,
      });
    });

    it('should handle missing Ratings array', async () => {
      const mockOmdbResponse = {
        imdbRating: '7.5',
        imdbVotes: '100,000',
        Metascore: '70',
        // No Ratings array
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOmdbResponse),
      });

      const result = await adapter.getAggregatedRatings('tt1234567', MediaType.MOVIE);

      expect(result.imdbRating).toBe(7.5);
      expect(result.imdbVotes).toBe(100000);
      expect(result.metascore).toBe(70);
      expect(result.rottenTomatoes).toBeNull();
      expect(result.metacritic).toBeNull();
    });

    it('should parse votes with commas correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            imdbRating: '9.0',
            imdbVotes: '1,500,000',
          }),
      });

      const result = await adapter.getAggregatedRatings('tt0903747', MediaType.SHOW);

      expect(result.imdbVotes).toBe(1500000);
    });

    it('should return nulls on API error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await adapter.getAggregatedRatings('tt0137523', MediaType.MOVIE);

      expect(result).toEqual({
        imdbRating: null,
        imdbVotes: null,
        rottenTomatoes: null,
        metacritic: null,
        metascore: null,
      });
    });

    it('should return nulls on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const result = await adapter.getAggregatedRatings('tt0137523', MediaType.MOVIE);

      expect(result).toEqual({
        imdbRating: null,
        imdbVotes: null,
        rottenTomatoes: null,
        metacritic: null,
        metascore: null,
      });
    });

    it('should throw if API key is missing', async () => {
      const moduleWithoutKey = await Test.createTestingModule({
        providers: [
          OmdbAdapter,
          { provide: omdbConfig.KEY, useValue: { ...mockConfig, apiKey: '' } },
        ],
      }).compile();

      const adapterWithoutKey = moduleWithoutKey.get<OmdbAdapter>(OmdbAdapter);

      const result = await adapterWithoutKey.getAggregatedRatings('tt0137523', MediaType.MOVIE);

      // Should return nulls due to error handling
      expect(result.imdbRating).toBeNull();
    });
  });

  describe('rating parsing', () => {
    it('should parse Rotten Tomatoes percentage', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            Ratings: [{ Source: 'Rotten Tomatoes', Value: '95%' }],
          }),
      });

      const result = await adapter.getAggregatedRatings('tt0000000', MediaType.MOVIE);

      expect(result.rottenTomatoes).toBe(95);
    });

    it('should parse Metacritic score', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            Ratings: [{ Source: 'Metacritic', Value: '85/100' }],
          }),
      });

      const result = await adapter.getAggregatedRatings('tt0000000', MediaType.MOVIE);

      expect(result.metacritic).toBe(85);
    });

    it('should handle malformed rating values', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            Ratings: [
              { Source: 'Rotten Tomatoes', Value: 'invalid' },
              { Source: 'Metacritic', Value: 'bad' },
            ],
          }),
      });

      const result = await adapter.getAggregatedRatings('tt0000000', MediaType.MOVIE);

      expect(result.rottenTomatoes).toBeNull();
      expect(result.metacritic).toBeNull();
    });
  });
});
