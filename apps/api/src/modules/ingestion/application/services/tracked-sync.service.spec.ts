import { Test, TestingModule } from '@nestjs/testing';

import { parseSeasonFromEpisodeKey } from '@/modules/ingestion/domain/interfaces/show-sync-diff.interface';
import { CLOCK_PORT } from '@/modules/shared/clock';
import { TRACKED_SHOW_REPOSITORY } from '@/modules/ingestion/domain/repositories/tracked-show.repository.interface';
import { TrackedSyncService } from './tracked-sync.service';
import { SyncMediaService } from './sync-media.service';

describe('TrackedSyncService', () => {
  let service: TrackedSyncService;

  const mockTrackedShowRepository = {
    findByTmdbId: jest.fn().mockResolvedValue(null),
    findLatestEpisodeAiredBy: jest.fn().mockResolvedValue(null),
  };

  const mockSyncMediaService = {
    syncShow: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackedSyncService,
        { provide: TRACKED_SHOW_REPOSITORY, useValue: mockTrackedShowRepository },
        { provide: CLOCK_PORT, useValue: { now: () => new Date('2026-01-01T00:00:00.000Z') } },
        { provide: SyncMediaService, useValue: mockSyncMediaService },
      ],
    }).compile();

    service = module.get<TrackedSyncService>(TrackedSyncService);
    jest.clearAllMocks();
  });

  describe('parseSeasonFromEpisodeKey', () => {
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

  const before = (status: string | null, firstAirDate: Date | null = new Date('2024-01-01')) => ({
    mediaItemId: 'media-1',
    status,
    totalSeasons: 2,
    nextAirDate: null,
    firstAirDate,
  });

  describe('premiere date announcement', () => {
    const undatedSnapshot = {
      mediaItemId: 'media-1',
      status: 'Planned',
      totalSeasons: 1,
      nextAirDate: null,
      firstAirDate: new Date('2026-03-12T00:00:00.000Z'),
      lastEpisodeKey: null,
      lastEpisodeAirDate: null,
    };

    it('reports a premiere date that just appeared for a show that had none', () => {
      const diff = (service as any).buildCurrentStateDiff(
        12345,
        undatedSnapshot,
        before('Planned', null),
      );

      expect(diff.hasChanges).toBe(true);
      expect(diff.changes.premiereDateAnnounced).toEqual({ airDate: '2026-03-12' });
    });

    it.each([
      ['the date was already known', before('Planned')],
      ['the show was not tracked before', null],
    ])('stays quiet when %s', (_case, previous) => {
      const diff = (service as any).buildCurrentStateDiff(12345, undatedSnapshot, previous);

      expect(diff.changes.premiereDateAnnounced).toBeUndefined();
    });

    it('stays quiet when the new date is already in the past', () => {
      const diff = (service as any).buildCurrentStateDiff(
        12345,
        { ...undatedSnapshot, firstAirDate: new Date('2025-12-01T00:00:00.000Z') },
        before('Planned', null),
      );

      expect(diff.changes.premiereDateAnnounced).toBeUndefined();
    });

    it('stays quiet when episodes are already out', () => {
      const diff = (service as any).buildCurrentStateDiff(
        12345,
        { ...undatedSnapshot, lastEpisodeKey: 'S1E1', lastEpisodeAirDate: new Date('2025-12-30') },
        before('Planned', null),
      );

      expect(diff.changes.premiereDateAnnounced).toBeUndefined();
    });
  });

  describe('buildCurrentStateDiff', () => {
    it('should report current aired episode and season', () => {
      const snapshot = {
        mediaItemId: 'media-1',
        status: 'Returning Series',
        totalSeasons: 2,
        nextAirDate: new Date('2025-03-15'),
        lastEpisodeKey: 'S2E5',
        lastEpisodeAirDate: new Date('2025-03-01'),
      };

      const diff = (service as any).buildCurrentStateDiff(
        12345,
        snapshot,
        before('Returning Series'),
      );

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
        lastEpisodeAirDate: null,
      };

      const diff = (service as any).buildCurrentStateDiff(
        12345,
        snapshot,
        before('Returning Series'),
      );

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
        lastEpisodeAirDate: new Date('2025-01-20'),
      };

      const diff = (service as any).buildCurrentStateDiff(
        12345,
        snapshot,
        before('Returning Series'),
      );

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
        lastEpisodeAirDate: new Date('2025-02-10'),
      };

      const diff = (service as any).buildCurrentStateDiff(
        12345,
        snapshot,
        before('Returning Series'),
      );

      expect(diff.changes.statusChanged).toBeUndefined();
    });

    it('should report status change even without aired episodes', () => {
      const snapshot = {
        mediaItemId: 'media-1',
        status: 'Canceled',
        totalSeasons: 1,
        nextAirDate: null,
        lastEpisodeKey: null,
        lastEpisodeAirDate: null,
      };

      const diff = (service as any).buildCurrentStateDiff(
        12345,
        snapshot,
        before('Returning Series'),
      );

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
        lastEpisodeAirDate: new Date('2025-01-05'),
      };

      const diff = (service as any).buildCurrentStateDiff(99999, snapshot, 'Returning Series');

      expect(diff.tmdbId).toBe(99999);
      expect(diff.mediaItemId).toBe('media-42');
    });
  });
});
