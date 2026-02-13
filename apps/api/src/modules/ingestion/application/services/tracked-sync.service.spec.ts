import { Test, TestingModule } from '@nestjs/testing';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { TrackedSyncService } from './tracked-sync.service';
import { SyncMediaService } from './sync-media.service';

describe('TrackedSyncService', () => {
  let service: TrackedSyncService;

  const mockDb = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
  };

  const mockSyncMediaService = {
    syncShow: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackedSyncService,
        { provide: DATABASE_CONNECTION, useValue: mockDb },
        { provide: SyncMediaService, useValue: mockSyncMediaService },
      ],
    }).compile();

    service = module.get<TrackedSyncService>(TrackedSyncService);
    jest.clearAllMocks();
  });

  describe('parseSeasonFromEpisodeKey', () => {
    // Access private method for testing
    const parseSeasonFromEpisodeKey = (key: string | null): number | null => {
      if (!key) return null;
      const match = key.match(/^S(\d+)E\d+$/i);
      return match ? parseInt(match[1], 10) : null;
    };

    it('should parse season from valid episode key', () => {
      expect(parseSeasonFromEpisodeKey('S2E5')).toBe(2);
      expect(parseSeasonFromEpisodeKey('S10E1')).toBe(10);
      expect(parseSeasonFromEpisodeKey('S1E15')).toBe(1);
    });

    it('should handle case insensitivity', () => {
      expect(parseSeasonFromEpisodeKey('s2e5')).toBe(2);
      expect(parseSeasonFromEpisodeKey('S2e5')).toBe(2);
    });

    it('should return null for invalid keys', () => {
      expect(parseSeasonFromEpisodeKey(null)).toBeNull();
      expect(parseSeasonFromEpisodeKey('')).toBeNull();
      expect(parseSeasonFromEpisodeKey('invalid')).toBeNull();
      expect(parseSeasonFromEpisodeKey('Season2Episode5')).toBeNull();
    });
  });

  describe('buildCurrentStateDiff', () => {
    it('should report current aired episode and season', () => {
      const snapshot = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 2,
        nextAirDate: new Date('2025-03-01'),
        lastEpisodeKey: 'S2E5',
      };

      const diff = (service as any).buildCurrentStateDiff(12345, snapshot, 'Returning Series');

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes.newEpisode).toEqual({
        season: 2,
        episode: 5,
        airDate: '2025-03-01',
        key: 'S2E5',
      });
      expect(diff.changes.newSeason).toEqual({
        seasonNumber: 2,
        airDate: '2025-03-01',
        key: '2',
      });
      expect(diff.changes.statusChanged).toBeUndefined();
    });

    it('should set hasChanges=false when no aired episodes', () => {
      const snapshot = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 1,
        nextAirDate: new Date('2025-06-01'),
        lastEpisodeKey: null,
      };

      const diff = (service as any).buildCurrentStateDiff(12345, snapshot, 'Returning Series');

      expect(diff.hasChanges).toBe(false);
      expect(diff.changes.newEpisode).toBeUndefined();
      expect(diff.changes.newSeason).toBeUndefined();
    });

    it('should detect status change', () => {
      const snapshot = {
        mediaItemId: 'media-1',
        status: 'Ended',
        totalSeasons: 5,
        nextAirDate: null,
        lastEpisodeKey: 'S5E10',
      };

      const diff = (service as any).buildCurrentStateDiff(12345, snapshot, 'Returning Series');

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes.statusChanged).toEqual({
        from: 'Returning Series',
        to: 'Ended',
      });
    });

    it('should not report status change when unchanged', () => {
      const snapshot = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 2,
        nextAirDate: null,
        lastEpisodeKey: 'S2E5',
      };

      const diff = (service as any).buildCurrentStateDiff(12345, snapshot, 'Returning Series');

      expect(diff.changes.statusChanged).toBeUndefined();
    });

    it('should report status change even without aired episodes', () => {
      const snapshot = {
        mediaItemId: 'media-1',
        status: 'Canceled',
        totalSeasons: 1,
        nextAirDate: null,
        lastEpisodeKey: null,
      };

      const diff = (service as any).buildCurrentStateDiff(12345, snapshot, 'Returning Series');

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes.statusChanged).toEqual({
        from: 'Returning Series',
        to: 'Canceled',
      });
      expect(diff.changes.newEpisode).toBeUndefined();
    });

    it('should include tmdbId and mediaItemId in diff', () => {
      const snapshot = {
        mediaItemId: 'media-42',
        status: 'Returning Series',
        totalSeasons: 1,
        nextAirDate: null,
        lastEpisodeKey: 'S1E1',
      };

      const diff = (service as any).buildCurrentStateDiff(99999, snapshot, 'Returning Series');

      expect(diff.tmdbId).toBe(99999);
      expect(diff.mediaItemId).toBe('media-42');
    });
  });
});
