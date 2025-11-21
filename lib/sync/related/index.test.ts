import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRelatedTmdbIds } from './index';
import * as trakt from './trakt';
import * as tmdb from './tmdb';

// Spy on the imported functions
const getTraktRecommendationsSpy = vi.spyOn(trakt, 'getTraktRecommendations');
const getTmdbRecommendationsSpy = vi.spyOn(tmdb, 'getTmdbRecommendations');

describe('related/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return recommendations from Trakt if available', async () => {
    // Arrange
    const traktRecs = [101, 102];
    getTraktRecommendationsSpy.mockResolvedValue(traktRecs);
    getTmdbRecommendationsSpy.mockResolvedValue([]); // Should not be called

    // Act
    const result = await getRelatedTmdbIds(100, 'test-slug');

    // Assert
    expect(result).toEqual({ ids: traktRecs, source: 'trakt' });
    expect(getTraktRecommendationsSpy).toHaveBeenCalledWith('test-slug', 100);
    expect(getTmdbRecommendationsSpy).not.toHaveBeenCalled();
  });

  it('should fall back to TMDB if Trakt returns no recommendations', async () => {
    // Arrange
    const tmdbRecs = [201, 202];
    getTraktRecommendationsSpy.mockResolvedValue([]);
    getTmdbRecommendationsSpy.mockResolvedValue(tmdbRecs);

    // Act
    const result = await getRelatedTmdbIds(100, 'test-slug');

    // Assert
    expect(result).toEqual({ ids: tmdbRecs, source: 'tmdb' });
    expect(getTraktRecommendationsSpy).toHaveBeenCalledWith('test-slug', 100);
    expect(getTmdbRecommendationsSpy).toHaveBeenCalledWith(100);
  });

  it('should return from Trakt even if TMDB also has recommendations', async () => {
    // Arrange
    const traktRecs = [101];
    const tmdbRecs = [201];
    getTraktRecommendationsSpy.mockResolvedValue(traktRecs);
    getTmdbRecommendationsSpy.mockResolvedValue(tmdbRecs);

    // Act
    const result = await getRelatedTmdbIds(100, 'test-slug');

    // Assert
    expect(result).toEqual({ ids: traktRecs, source: 'trakt' });
    expect(getTmdbRecommendationsSpy).not.toHaveBeenCalled();
  });

  it('should return an empty result if both sources are empty', async () => {
    // Arrange
    getTraktRecommendationsSpy.mockResolvedValue([]);
    getTmdbRecommendationsSpy.mockResolvedValue([]);

    // Act
    const result = await getRelatedTmdbIds(100, 'test-slug');

    // Assert
    expect(result).toEqual({ ids: [], source: 'trakt' });
    expect(getTraktRecommendationsSpy).toHaveBeenCalled();
    expect(getTmdbRecommendationsSpy).toHaveBeenCalled();
  });

  it('should retain tmdb as source if it returns results after a trakt failure', async () => {
    // Arrange
    getTraktRecommendationsSpy.mockResolvedValue([]);
    getTmdbRecommendationsSpy.mockResolvedValue([201]);

    // Act
    const result = await getRelatedTmdbIds(100, 'test-slug');

    // Assert
    expect(result.source).toBe('tmdb');
  });
});
