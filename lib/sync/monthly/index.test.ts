import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMonthlyMaps, buildMonthlyMapsMovies } from './index';
import * as dates from './dates';
import * as processors from './processors';
import { traktClient } from '@/lib/api/trakt';

// Mock dependencies
vi.mock('./dates');
vi.mock('./processors');
vi.mock('@/lib/api/trakt', () => ({
  traktClient: {
    getWatchedShows: vi.fn(),
    getWatchedMovies: vi.fn(),
  },
}));

describe('monthly/index', () => {
  const mockDates = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];
  const mockRawData = ['raw0', 'raw1', 'raw2', 'raw3', 'raw4', 'raw5'];
  const mockProcessedData = [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(dates, 'getMonthlyStartDates').mockReturnValue(mockDates);
  });

  describe('buildMonthlyMaps', () => {
    it('should build monthly maps for shows correctly', async () => {
      // Arrange
      for (let i = 0; i < 6; i++) {
        vi.spyOn(traktClient, 'getWatchedShows').mockResolvedValueOnce(mockRawData[i]);
        vi.spyOn(processors, 'processWatchedShows').mockReturnValueOnce(mockProcessedData[i]);
      }

      // Act
      const result = await buildMonthlyMaps();

      // Assert
      expect(traktClient.getWatchedShows).toHaveBeenCalledTimes(6);
      expect(processors.processWatchedShows).toHaveBeenCalledTimes(6);
      for (let i = 0; i < 6; i++) {
        expect(traktClient.getWatchedShows).toHaveBeenCalledWith('monthly', mockDates[i], 200);
        expect(processors.processWatchedShows).toHaveBeenCalledWith(mockRawData[i]);
        expect(result[`m${i}`]).toEqual(mockProcessedData[i]);
      }
    });

    it('should return empty maps on traktClient error', async () => {
      // Arrange
      vi.spyOn(traktClient, 'getWatchedShows').mockRejectedValue(new Error('API Error'));

      // Act
      const result = await buildMonthlyMaps();

      // Assert
      expect(result).toEqual({ m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} });
    });
  });

  describe('buildMonthlyMapsMovies', () => {
    it('should build monthly maps for movies correctly', async () => {
      // Arrange
      for (let i = 0; i < 6; i++) {
        vi.spyOn(traktClient, 'getWatchedMovies').mockResolvedValueOnce(mockRawData[i]);
        vi.spyOn(processors, 'processWatchedMovies').mockReturnValueOnce(mockProcessedData[i]);
      }

      // Act
      const result = await buildMonthlyMapsMovies();

      // Assert
      expect(traktClient.getWatchedMovies).toHaveBeenCalledTimes(6);
      expect(processors.processWatchedMovies).toHaveBeenCalledTimes(6);
      for (let i = 0; i < 6; i++) {
        expect(traktClient.getWatchedMovies).toHaveBeenCalledWith('monthly', mockDates[i], 200);
        expect(processors.processWatchedMovies).toHaveBeenCalledWith(mockRawData[i]);
        expect(result[`m${i}`]).toEqual(mockProcessedData[i]);
      }
    });

    it('should return empty maps on traktClient error', async () => {
      // Arrange
      vi.spyOn(traktClient, 'getWatchedMovies').mockRejectedValue(new Error('API Error'));

      // Act
      const result = await buildMonthlyMapsMovies();

      // Assert
      expect(result).toEqual({ m0: {}, m1: {}, m2: {}, m3: {}, m4: {}, m5: {} });
    });
  });
});
