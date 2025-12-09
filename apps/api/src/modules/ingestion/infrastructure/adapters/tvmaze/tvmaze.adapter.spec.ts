import { Test, TestingModule } from '@nestjs/testing';
import { TvMazeAdapter } from './tvmaze.adapter';

// Mock fetch globally
global.fetch = jest.fn();

describe('TvMazeAdapter', () => {
  let adapter: TvMazeAdapter;

  beforeEach(async () => {
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [TvMazeAdapter],
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
        rating: null,
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
});
