import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTmdbRecommendations } from './tmdb';
import { tmdbClient } from '@/lib/api/tmdb';
import * as genreUtils from './genres';

// Mock dependencies
vi.mock('@/lib/api/tmdb', () => ({
  tmdbClient: {
    getRecommendations: vi.fn(),
    getShowGenres: vi.fn(),
  },
}));

const getBaseGenresSpy = vi.spyOn(genreUtils, 'getBaseGenres');

describe('related/tmdb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return filtered TMDB recommendations', async () => {
    // Arrange
    const baseTmdbId = 200;
    const mockRecommendations = {
      results: [
        { id: 201, genre_ids: [10, 20] }, // Keep
        { id: 202, genre_ids: [16] }, // Banned
        { id: 203, genre_ids: [30] }, // Mismatch
        { id: 204, genre_ids: [10] }, // Keep
        { id: 205, genre_ids: [] }, // Keep (empty genres match all)
        { id: 206 }, // Filtered out (no genre_ids)
      ],
    };

    vi.mocked(tmdbClient.getRecommendations).mockResolvedValue(mockRecommendations as any);
    // getBaseGenres is called internally, which in turn calls tmdbClient.getShowGenres
    vi.mocked(tmdbClient.getShowGenres).mockResolvedValue([10, 20]); // Base genres

    // Act
    const result = await getTmdbRecommendations(baseTmdbId);

    // Assert
    expect(tmdbClient.getRecommendations).toHaveBeenCalledWith(baseTmdbId, 1);
    expect(getBaseGenresSpy).toHaveBeenCalledWith(baseTmdbId);
    expect(result).toEqual([201, 204, 205]);
  });

  it('should return an empty array if TMDB returns no recommendations', async () => {
    vi.mocked(tmdbClient.getRecommendations).mockResolvedValue({
      page: 1,
      total_pages: 1,
      total_results: 0,
      results: [],
    });
    vi.mocked(tmdbClient.getShowGenres).mockResolvedValue([10]);

    const result = await getTmdbRecommendations(123);

    expect(result).toEqual([]);
  });

  it('should return an empty array if the API call fails', async () => {
    vi.mocked(tmdbClient.getRecommendations).mockRejectedValue(new Error('API Error'));

    const result = await getTmdbRecommendations(123);

    expect(result).toEqual([]);
  });

  it('should return an empty array if base genre fetching fails', async () => {
    const mockRecommendations = { results: [{ id: 201, genre_ids: [10] }] };
    vi.mocked(tmdbClient.getRecommendations).mockResolvedValue(mockRecommendations as any);
    vi.mocked(tmdbClient.getShowGenres).mockRejectedValue(new Error('Base Genre Error'));

    const result = await getTmdbRecommendations(200);

    expect(result).toEqual([]);
  });

  it('should handle recommendations with invalid data', async () => {
    const mockRecommendations = {
      results: [
        { id: 201, genre_ids: [10] },
        { id: null, genre_ids: [10] },
        { id: 203, genre_ids: null },
      ],
    };
    vi.mocked(tmdbClient.getRecommendations).mockResolvedValue(mockRecommendations as any);
    vi.mocked(tmdbClient.getShowGenres).mockResolvedValue([10]);

    const result = await getTmdbRecommendations(200);

    expect(result).toEqual([201]);
  });
});
