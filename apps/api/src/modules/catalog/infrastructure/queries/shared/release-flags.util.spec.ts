import { calculateReleaseFlags } from './release-flags.util';
import {
  NEW_RELEASE_THRESHOLDS,
  CLASSIC_THRESHOLDS,
} from '../../../domain/constants/catalog.constants';

describe('calculateReleaseFlags', () => {
  const fixedNow = new Date('2025-06-15');

  describe('isNew flag', () => {
    it('should return isNew=true for release within threshold days', () => {
      const releaseDate = new Date('2025-05-01'); // 45 days ago (< 60)
      const result = calculateReleaseFlags(releaseDate, null, null, fixedNow);
      expect(result.isNew).toBe(true);
    });

    it('should return isNew=false for release older than threshold days', () => {
      const releaseDate = new Date('2025-03-01'); // 106 days ago (> 60)
      const result = calculateReleaseFlags(releaseDate, null, null, fixedNow);
      expect(result.isNew).toBe(false);
    });

    it('should return isNew=true for release exactly at threshold boundary', () => {
      const cutoffDate = new Date(fixedNow);
      cutoffDate.setDate(fixedNow.getDate() - NEW_RELEASE_THRESHOLDS.DAYS);
      const result = calculateReleaseFlags(cutoffDate, null, null, fixedNow);
      expect(result.isNew).toBe(true);
    });

    it('should return isNew=false for release one day before threshold', () => {
      const cutoffDate = new Date(fixedNow);
      cutoffDate.setDate(fixedNow.getDate() - NEW_RELEASE_THRESHOLDS.DAYS - 1);
      const result = calculateReleaseFlags(cutoffDate, null, null, fixedNow);
      expect(result.isNew).toBe(false);
    });
  });

  describe('isClassic flag - by age', () => {
    it('should return isClassic=true for release older than threshold years', () => {
      const releaseDate = new Date('2010-01-01'); // 15 years old (> 10)
      const result = calculateReleaseFlags(releaseDate, null, null, fixedNow);
      expect(result.isClassic).toBe(true);
    });

    it('should return isClassic=false for recent release', () => {
      const releaseDate = new Date('2020-01-01'); // 5 years old (< 10)
      const result = calculateReleaseFlags(releaseDate, null, null, fixedNow);
      expect(result.isClassic).toBe(false);
    });

    it('should return isClassic=true for release exactly at age threshold', () => {
      const cutoffDate = new Date(fixedNow);
      cutoffDate.setFullYear(fixedNow.getFullYear() - CLASSIC_THRESHOLDS.YEARS_OLD);
      const result = calculateReleaseFlags(cutoffDate, null, null, fixedNow);
      expect(result.isClassic).toBe(true);
    });
  });

  describe('isClassic flag - by quality and engagement', () => {
    it('should return isClassic=true for high ratingo score and watchers', () => {
      const releaseDate = new Date('2020-01-01'); // Recent but high quality
      const result = calculateReleaseFlags(
        releaseDate,
        CLASSIC_THRESHOLDS.RATINGO_SCORE, // exactly threshold
        CLASSIC_THRESHOLDS.TOTAL_WATCHERS + 1, // above threshold
        fixedNow,
      );
      expect(result.isClassic).toBe(true);
    });

    it('should return isClassic=false when ratingo score is below threshold', () => {
      const releaseDate = new Date('2020-01-01');
      const result = calculateReleaseFlags(
        releaseDate,
        CLASSIC_THRESHOLDS.RATINGO_SCORE - 1, // below threshold
        CLASSIC_THRESHOLDS.TOTAL_WATCHERS + 1,
        fixedNow,
      );
      expect(result.isClassic).toBe(false);
    });

    it('should return isClassic=false when watchers at or below threshold', () => {
      const releaseDate = new Date('2020-01-01');
      const result = calculateReleaseFlags(
        releaseDate,
        CLASSIC_THRESHOLDS.RATINGO_SCORE,
        CLASSIC_THRESHOLDS.TOTAL_WATCHERS, // exactly threshold (not above)
        fixedNow,
      );
      expect(result.isClassic).toBe(false);
    });

    it('should return isClassic=false when both score and watchers below threshold', () => {
      const releaseDate = new Date('2020-01-01');
      const result = calculateReleaseFlags(releaseDate, 50, 5000, fixedNow);
      expect(result.isClassic).toBe(false);
    });
  });

  describe('null/undefined handling', () => {
    it('should return both flags false when releaseDate is null', () => {
      const result = calculateReleaseFlags(null, 90, 50000, fixedNow);
      expect(result).toEqual({ isNew: false, isClassic: false });
    });

    it('should handle null ratingoScore gracefully', () => {
      const releaseDate = new Date('2020-01-01');
      const result = calculateReleaseFlags(releaseDate, null, 50000, fixedNow);
      expect(result.isClassic).toBe(false); // null score treated as 0
    });

    it('should handle null totalWatchers gracefully', () => {
      const releaseDate = new Date('2020-01-01');
      const result = calculateReleaseFlags(releaseDate, 90, null, fixedNow);
      expect(result.isClassic).toBe(false); // null watchers treated as 0
    });

    it('should handle undefined ratingoScore gracefully', () => {
      const releaseDate = new Date('2020-01-01');
      const result = calculateReleaseFlags(releaseDate, undefined, 50000, fixedNow);
      expect(result.isClassic).toBe(false);
    });
  });

  describe('combined flags', () => {
    it('should return both isNew and isClassic true for old classic re-released recently', () => {
      // This is theoretically possible - classic by quality, new by theatrical release
      const releaseDate = new Date('2025-05-20'); // 26 days ago
      const result = calculateReleaseFlags(releaseDate, 95, 100000, fixedNow);
      expect(result.isNew).toBe(true);
      expect(result.isClassic).toBe(true);
    });

    it('should return both flags false for mid-age, mid-quality content', () => {
      const releaseDate = new Date('2022-01-01'); // 3.5 years old
      const result = calculateReleaseFlags(releaseDate, 60, 5000, fixedNow);
      expect(result.isNew).toBe(false);
      expect(result.isClassic).toBe(false);
    });
  });

  describe('default now parameter', () => {
    it('should use current date when now is not provided', () => {
      const recentRelease = new Date();
      recentRelease.setDate(recentRelease.getDate() - 10);
      const result = calculateReleaseFlags(recentRelease);
      expect(result.isNew).toBe(true);
    });
  });
});
