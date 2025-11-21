import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCalendarSync } from './index';
import * as dates from './dates';
import * as shows from './shows';
import * as airings from './airings';
import { traktClient } from '@/lib/api/trakt';
import { withRetry } from '@/lib/sync/utils';

// Mocking all dependencies
vi.mock('./dates');
vi.mock('./shows');
vi.mock('./airings');
vi.mock('@/lib/api/trakt', () => ({
  traktClient: {
    getCalendarShows: vi.fn(),
  },
}));
vi.mock('@/lib/sync/utils', () => ({
  withRetry: vi.fn((fn) => fn()),
}));

describe('runCalendarSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process, insert, and update airings correctly', async () => {
    // Arrange
    vi.spyOn(dates, 'createCalendarConfig').mockReturnValue({ startDate: '2023-01-01', days: 7 });
    vi.spyOn(shows, 'getTrendingShows').mockResolvedValue([1, 2, 3]);
    vi.spyOn(traktClient, 'getCalendarShows').mockResolvedValue([
      { show: { ids: { tmdb: 1 } }, episode: { season: 1, number: 1 } }, // Will be updated
      { show: { ids: { tmdb: 2 } }, episode: { season: 1, number: 2 } }, // Will be inserted
      { show: { ids: { tmdb: 4 } }, episode: { season: 1, number: 3 } }, // Not in trending, will be skipped
    ]);
    vi.spyOn(shows, 'getShowIdByTmdbId').mockImplementation(async (tmdbId) => tmdbId);
    vi.spyOn(airings, 'getExistingAiring')
      .mockResolvedValueOnce({ id: 100 }) // For tmdbId 1
      .mockResolvedValueOnce(null); // For tmdbId 2
    vi.spyOn(airings, 'updateAiring').mockResolvedValue(undefined);
    vi.spyOn(airings, 'insertAiring').mockResolvedValue(undefined);

    // Act
    const result = await runCalendarSync();

    // Assert
    expect(result).toEqual({ processed: 2, inserted: 1, updated: 1 });
    expect(shows.getTrendingShows).toHaveBeenCalled();
    expect(traktClient.getCalendarShows).toHaveBeenCalledWith('2023-01-01', 7);
    expect(airings.updateAiring).toHaveBeenCalledTimes(1);
    expect(airings.insertAiring).toHaveBeenCalledTimes(1);
  });

  it('should handle errors during item processing and continue', async () => {
    // Arrange
    vi.spyOn(dates, 'createCalendarConfig').mockReturnValue({ startDate: '2023-01-01', days: 7 });
    vi.spyOn(shows, 'getTrendingShows').mockResolvedValue([1, 2]);
    vi.spyOn(traktClient, 'getCalendarShows').mockResolvedValue([
      { show: { ids: { tmdb: 1 } }, episode: { season: 1, number: 1 } }, // Will fail
      { show: { ids: { tmdb: 2 } }, episode: { season: 1, number: 2 } }, // Will be inserted
    ]);
    vi.spyOn(shows, 'getShowIdByTmdbId').mockRejectedValueOnce(new Error('Test Error'));
    vi.spyOn(airings, 'getExistingAiring').mockResolvedValue(null);
    vi.spyOn(airings, 'insertAiring').mockResolvedValue(undefined);

    // Act
    const result = await runCalendarSync();

    // Assert
    expect(result).toEqual({ processed: 1, inserted: 1, updated: 0 });
    expect(airings.insertAiring).toHaveBeenCalledTimes(1);
  });

  it('should use provided trendingSet if available', async () => {
    // Arrange
    const trendingSet = new Set([10, 20]);
    vi.spyOn(dates, 'createCalendarConfig').mockReturnValue({ startDate: '2023-01-01', days: 7 });
    vi.spyOn(traktClient, 'getCalendarShows').mockResolvedValue([
      { show: { ids: { tmdb: 10 } }, episode: { season: 1, number: 1 } },
    ]);
    vi.spyOn(shows, 'getShowIdByTmdbId').mockResolvedValue(10);
    vi.spyOn(airings, 'getExistingAiring').mockResolvedValue(null);
    vi.spyOn(airings, 'insertAiring').mockResolvedValue(undefined);

    // Act
    await runCalendarSync(trendingSet);

    // Assert
    expect(shows.getTrendingShows).not.toHaveBeenCalled();
    expect(airings.insertAiring).toHaveBeenCalledTimes(1);
  });
});
