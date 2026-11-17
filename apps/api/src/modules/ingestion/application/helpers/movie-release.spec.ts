import * as fc from 'fast-check';

import { effectiveMovieReleaseDate, isUnreleasedMovie } from './movie-release';

const NOW = new Date('2026-11-17T12:00:00Z');
const day = (offset: number): Date => new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);

describe('movie-release', () => {
  describe('effectiveMovieReleaseDate', () => {
    it('prefers the theatrical date', () => {
      expect(
        effectiveMovieReleaseDate({
          theatricalReleaseDate: day(10),
          digitalReleaseDate: day(40),
          releaseDate: day(-100),
        }),
      ).toEqual(day(10));
    });

    it('falls back to the digital date for digital-only movies', () => {
      expect(
        effectiveMovieReleaseDate({ digitalReleaseDate: day(5), releaseDate: day(-200) }),
      ).toEqual(day(5));
    });

    it('falls back to the primary release date', () => {
      expect(effectiveMovieReleaseDate({ releaseDate: day(3) })).toEqual(day(3));
    });

    it('returns null without any date', () => {
      expect(effectiveMovieReleaseDate({})).toBeNull();
    });
  });

  describe('isUnreleasedMovie', () => {
    it('is true for a future theatrical date', () => {
      expect(isUnreleasedMovie({ theatricalReleaseDate: day(1) }, NOW)).toBe(true);
    });

    it('is false on the release instant and after it', () => {
      expect(isUnreleasedMovie({ theatricalReleaseDate: NOW }, NOW)).toBe(false);
      expect(isUnreleasedMovie({ theatricalReleaseDate: day(-1) }, NOW)).toBe(false);
    });

    it('is false for a movie without dates', () => {
      expect(isUnreleasedMovie({ releaseDate: null }, NOW)).toBe(false);
    });

    it('matches the sign of the offset of the effective date', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -3650, max: 3650 }).filter((n) => n !== 0),
          (offset) => {
            expect(isUnreleasedMovie({ digitalReleaseDate: day(offset) }, NOW)).toBe(offset > 0);
          },
        ),
      );
    });
  });
});
