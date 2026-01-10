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

  describe('calculateDiff - new season detection', () => {
    it('should detect new season based on aired episodes, not totalSeasons', () => {
      // This tests the core fix: new_season should trigger when
      // lastEpisodeKey changes to a new season, not when totalSeasons increases

      const before = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 3, // TMDB shows 3 seasons announced
        nextAirDate: null,
        lastEpisodeKey: 'S2E10', // But only 2 seasons have aired
      };

      const after = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 3, // Still 3 (no change in announced)
        nextAirDate: new Date('2025-03-01'),
        lastEpisodeKey: 'S3E1', // Season 3 episode 1 aired!
      };

      // Access private method via any cast
      const diff = (service as any).calculateDiff(12345, before, after);

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes.newSeason).toBeDefined();
      expect(diff.changes.newSeason.seasonNumber).toBe(3);
    });

    it('should NOT trigger new season when only totalSeasons increases', () => {
      // totalSeasons increased (announcement) but no new episodes aired
      const before = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 2,
        nextAirDate: null,
        lastEpisodeKey: 'S2E10',
      };

      const after = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 3, // Season 3 announced!
        nextAirDate: new Date('2025-06-01'),
        lastEpisodeKey: 'S2E10', // But still no new episodes
      };

      const diff = (service as any).calculateDiff(12345, before, after);

      // Should NOT trigger new_season notification
      expect(diff.changes.newSeason).toBeUndefined();
    });

    it('should detect new episode within same season', () => {
      const before = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 2,
        nextAirDate: null,
        lastEpisodeKey: 'S2E5',
      };

      const after = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 2,
        nextAirDate: null,
        lastEpisodeKey: 'S2E6', // New episode in same season
      };

      const diff = (service as any).calculateDiff(12345, before, after);

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes.newEpisode).toBeDefined();
      expect(diff.changes.newEpisode.season).toBe(2);
      expect(diff.changes.newEpisode.episode).toBe(6);
      // Should NOT trigger new_season (same season)
      expect(diff.changes.newSeason).toBeUndefined();
    });

    it('should detect status change', () => {
      const before = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 5,
        nextAirDate: null,
        lastEpisodeKey: 'S5E10',
      };

      const after = {
        mediaItemId: 'media-1',
        status: 'Ended',
        totalSeasons: 5,
        nextAirDate: null,
        lastEpisodeKey: 'S5E10',
      };

      const diff = (service as any).calculateDiff(12345, before, after);

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes.statusChanged).toEqual({
        from: 'Returning Series',
        to: 'Ended',
      });
    });
  });
});
