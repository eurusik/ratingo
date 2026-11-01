import { buildMdblistRatingsJobId, buildNewReleaseJobId, buildSyncMediaJobId } from './job-ids';

// 2025-12-21T19:45:10Z
const FIXED_NOW = 1_766_346_310_000;

describe('job-ids', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('buildSyncMediaJobId', () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(FIXED_NOW);
    });

    it('daily scope is per UTC day', () => {
      expect(buildSyncMediaJobId('movie', 1, 'daily')).toBe('movie_1_20251221');
    });

    it('window scope uses the explicit dispatch window', () => {
      expect(buildSyncMediaJobId('show', 2, 'window', '2025122116')).toBe('show_2_2025122116');
    });

    it('window scope defaults to the current UTC hour bucket', () => {
      expect(buildSyncMediaJobId('movie', 1, 'window')).toBe('movie_1_2025122119');
    });

    it('window scope differs between 4h dispatch cycles of the same day', () => {
      expect(buildSyncMediaJobId('movie', 1, 'window', '2025122100')).not.toBe(
        buildSyncMediaJobId('movie', 1, 'window', '2025122104'),
      );
    });

    it('oneshot scope is stable', () => {
      expect(buildSyncMediaJobId('movie', 1, 'oneshot')).toBe('movie_1_oneshot');
    });
  });

  describe('buildNewReleaseJobId', () => {
    it('uses a distinct nr prefix that cannot collide with trending ids', () => {
      jest.useFakeTimers().setSystemTime(FIXED_NOW);
      const id = buildNewReleaseJobId(5);
      expect(id).toBe('nr_movie_5_20251221');
      expect(id).not.toBe(buildSyncMediaJobId('movie', 5, 'daily'));
      expect(id).not.toBe(buildSyncMediaJobId('movie', 5, 'window'));
    });
  });

  describe('buildMdblistRatingsJobId', () => {
    it('is keyed by media item and day', () => {
      expect(buildMdblistRatingsJobId('media-1', '20251221')).toBe(
        'backfill-mdblist-ratings_media-1_20251221',
      );
    });

    it('differs for two media items that share a tmdbId', () => {
      expect(buildMdblistRatingsJobId('movie-uuid', '20251221')).not.toBe(
        buildMdblistRatingsJobId('show-uuid', '20251221'),
      );
    });
  });
});
