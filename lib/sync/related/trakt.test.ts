import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTraktRecommendations } from './trakt';
import { traktClient } from '@/lib/api/trakt';
import { tmdbClient } from '@/lib/api/tmdb';
import * as genreUtils from './genres';

// Mock external dependencies
vi.mock('@/lib/api/trakt', () => ({
  traktClient: {
    getRelatedShows: vi.fn(),
  },
}));

vi.mock('@/lib/api/tmdb', () => ({
  tmdbClient: {
    getShowGenres: vi.fn(),
  },
}));

// Spy on local genre functions to verify they are called
const getBaseGenresSpy = vi.spyOn(genreUtils, 'getBaseGenres');

describe('related/trakt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return filtered recommendations on a successful run', async () => {
    // Arrange
    const baseTmdbId = 100;
    const traktSlug = 'game-of-thrones';

    const mockRelatedShows = [
      { title: 's1', year: 2020, ids: { trakt: 1, slug: 's1', tvdb: 1, imdb: 'tt1', tmdb: 101 } },
      { title: 's2', year: 2020, ids: { trakt: 2, slug: 's2', tvdb: 2, imdb: 'tt2', tmdb: 102 } },
      { title: 's3', year: 2020, ids: { trakt: 3, slug: 's3', tvdb: 3, imdb: 'tt3', tmdb: 103 } },
      { title: 's4', year: 2020, ids: { trakt: 4, slug: 's4', tvdb: 4, imdb: 'tt4', tmdb: 104 } },
    ];

    vi.mocked(traktClient.getRelatedShows).mockResolvedValue(mockRelatedShows as any);

    // Mock genre calls
    vi.mocked(tmdbClient.getShowGenres).mockImplementation(async (id) => {
      if (id === baseTmdbId) return [10, 20]; // Base genres
      if (id === 101) return [10]; // Match
      if (id === 102) return [16]; // Banned
      if (id === 103) return [30]; // Mismatch
      if (id === 104) return [20]; // Match
      return [];
    });

    // Act
    const result = await getTraktRecommendations(traktSlug, baseTmdbId);

    // Assert
    expect(traktClient.getRelatedShows).toHaveBeenCalledWith(traktSlug, 12);
    expect(getBaseGenresSpy).toHaveBeenCalledWith(baseTmdbId);
    expect(tmdbClient.getShowGenres).toHaveBeenCalledWith(101);
    expect(tmdbClient.getShowGenres).toHaveBeenCalledWith(102);
    expect(tmdbClient.getShowGenres).toHaveBeenCalledWith(103);
    expect(tmdbClient.getShowGenres).toHaveBeenCalledWith(104);

    expect(result).toEqual([101, 104]);
  });

  it('should return an empty array if Trakt returns no related shows', async () => {
    vi.mocked(traktClient.getRelatedShows).mockResolvedValue([]);
    const result = await getTraktRecommendations('test', 123);
    expect(result).toEqual([]);
    expect(getBaseGenresSpy).not.toHaveBeenCalled();
  });

  it('should return an empty array if related shows have no valid TMDB IDs', async () => {
    const mockRelatedShows = [
      {
        title: 's1',
        year: 2020,
        ids: { trakt: 1, slug: 's1', tvdb: 1, imdb: 'tt123', tmdb: null },
      },
    ];
    vi.mocked(traktClient.getRelatedShows).mockResolvedValue(mockRelatedShows as any);
    const result = await getTraktRecommendations('test', 123);
    expect(result).toEqual([]);
  });

  it('should return an empty array if the main Trakt call fails', async () => {
    vi.mocked(traktClient.getRelatedShows).mockRejectedValue(new Error('API Error'));
    const result = await getTraktRecommendations('test', 123);
    expect(result).toEqual([]);
  });

  it('should handle cases where genre fetching fails for some shows', async () => {
    const mockRelatedShows = [
      { title: 's1', year: 2020, ids: { trakt: 1, slug: 's1', tvdb: 1, imdb: 'tt1', tmdb: 101 } },
      { title: 's2', year: 2020, ids: { trakt: 2, slug: 's2', tvdb: 2, imdb: 'tt2', tmdb: 102 } },
    ];
    vi.mocked(traktClient.getRelatedShows).mockResolvedValue(mockRelatedShows as any);

    // Base genres are found
    vi.mocked(tmdbClient.getShowGenres).mockImplementation(async (id) => {
      if (id === 100) return [10];
      if (id === 101) return [10]; // Match
      if (id === 102) throw new Error('Genre fetch failed'); // This one fails
      return [];
    });

    const result = await getTraktRecommendations('test', 100);

    expect(result).toEqual([101, 102]);
  });
});
