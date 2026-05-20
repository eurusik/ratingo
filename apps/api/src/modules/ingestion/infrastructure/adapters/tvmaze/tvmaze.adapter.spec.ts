import { Test, TestingModule } from '@nestjs/testing';
import { TvMazeAdapter } from './tvmaze.adapter';
import tvmazeConfig from '@/config/tvmaze.config';

// Mock fetch globally
global.fetch = jest.fn();

describe('TvMazeAdapter', () => {
  let adapter: TvMazeAdapter;

  const mockConfig = {
    apiUrl: 'https://api.tvmaze.com',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TvMazeAdapter, { provide: tvmazeConfig.KEY, useValue: mockConfig }],
    }).compile();

    adapter = module.get<TvMazeAdapter>(TvMazeAdapter);
  });

  describe('getEpisodesByImdbId', () => {
    it('should return episodes when show is found', async () => {
      // Mock lookup response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123, name: 'Test Show' }),
      });

      // Mock episodes response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 1,
            season: 1,
            number: 1,
            name: 'Pilot',
            summary: '<p>Intro</p>',
            airstamp: '2023-01-01T20:00:00+00:00',
            runtime: 60,
            image: { original: 'http://image.com/1.jpg' },
            rating: { average: 8.5 },
          },
        ],
      });

      const result = await adapter.getEpisodesByImdbId('tt1234567');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        seasonNumber: 1,
        number: 1,
        title: 'Pilot',
        overview: 'Intro',
        airDate: new Date('2023-01-01T20:00:00+00:00'),
        runtime: 60,
        stillPath: 'http://image.com/1.jpg',
        rating: 8.5,
      });
    });

    it('should return empty array if show not found', async () => {
      // Mock lookup response (404)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await adapter.getEpisodesByImdbId('tt0000000');

      expect(result).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      // Mock lookup ok
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 123 }),
      });

      // Mock episodes error
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await adapter.getEpisodesByImdbId('tt123');
      expect(result).toEqual([]);
    });
  });

  describe('getEpisodesByShowName', () => {
    it('should return episodes when show is found by name', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 86953, name: 'Тиха Нава' }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 1,
            season: 1,
            number: 1,
            name: 'Episode 1',
            summary: '<p>First</p>',
            airstamp: '2024-10-01T20:00:00+00:00',
            runtime: 45,
            image: null,
            rating: { average: 7.0 },
          },
        ],
      });

      const result = await adapter.getEpisodesByShowName('Тиха Нава');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/singlesearch/shows?q='),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        seasonNumber: 1,
        number: 1,
        title: 'Episode 1',
        overview: 'First',
        airDate: new Date('2024-10-01T20:00:00+00:00'),
        runtime: 45,
        stillPath: null,
        rating: 7.0,
      });
    });

    it('should return empty array when no show matches the name', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await adapter.getEpisodesByShowName('NonexistentShow12345');
      expect(result).toEqual([]);
    });

    it('should map null and missing rating to null', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 86953, name: 'Test' }),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 1,
            season: 1,
            number: 1,
            name: 'Ep1',
            summary: null,
            airstamp: null,
            runtime: null,
            image: null,
            rating: { average: null },
          },
          {
            id: 2,
            season: 1,
            number: 2,
            name: 'Ep2',
            summary: null,
            airstamp: null,
            runtime: null,
            image: null,
          },
        ],
      });

      const result = await adapter.getEpisodesByShowName('Test');

      expect(result).toHaveLength(2);
      expect(result[0].rating).toBeNull();
      expect(result[1].rating).toBeNull();
    });

    it('should return empty array on API error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await adapter.getEpisodesByShowName('Test');
      expect(result).toEqual([]);
    });
  });
});
