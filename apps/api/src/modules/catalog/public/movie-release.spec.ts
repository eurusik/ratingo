import * as fc from 'fast-check';

import {
  effectiveMovieRelease,
  effectiveMovieReleaseDate,
  isMovieReleasingFrom,
  MovieReleaseDateKind,
  resolveMovieRelease,
} from './index';

const NOW = new Date('2026-11-17T12:00:00Z');
const day = (offset: number): Date => new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000);
const iso = (offset: number): string => day(offset).toISOString();

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

  describe('effectiveMovieRelease', () => {
    it('labels a theatrical date as theatrical', () => {
      expect(
        effectiveMovieRelease({ theatricalReleaseDate: day(2), digitalReleaseDate: day(9) }),
      ).toEqual({
        date: day(2),
        kind: MovieReleaseDateKind.THEATRICAL,
      });
    });

    it('labels a digital fallback as digital', () => {
      expect(effectiveMovieRelease({ digitalReleaseDate: day(4), releaseDate: day(-50) })).toEqual({
        date: day(4),
        kind: MovieReleaseDateKind.DIGITAL,
      });
    });

    it('labels the primary release date fallback as theatrical', () => {
      expect(effectiveMovieRelease({ releaseDate: day(7) })).toEqual({
        date: day(7),
        kind: MovieReleaseDateKind.THEATRICAL,
      });
    });

    it('returns null without any date', () => {
      expect(effectiveMovieRelease({ releaseDate: null })).toBeNull();
    });
  });

  describe('isMovieReleasingFrom', () => {
    it('is true for a date later than the given day', () => {
      expect(isMovieReleasingFrom({ theatricalReleaseDate: day(1) }, NOW)).toBe(true);
    });

    it('is true on the given day itself and false before it', () => {
      expect(isMovieReleasingFrom({ theatricalReleaseDate: NOW }, NOW)).toBe(true);
      expect(isMovieReleasingFrom({ theatricalReleaseDate: day(-1) }, NOW)).toBe(false);
    });

    it('is false for a movie without dates', () => {
      expect(isMovieReleasingFrom({ releaseDate: null }, NOW)).toBe(false);
    });

    it('matches the sign of the offset of the effective date', () => {
      fc.assert(
        fc.property(fc.integer({ min: -3650, max: 3650 }), (offset) => {
          expect(isMovieReleasingFrom({ digitalReleaseDate: day(offset) }, NOW)).toBe(offset >= 0);
        }),
      );
    });
  });

  describe('resolveMovieRelease', () => {
    it('prefers the Ukrainian release when it shares the date', () => {
      const release = resolveMovieRelease({ theatricalReleaseDate: day(5) }, [
        { country: 'US', type: 3, date: iso(5) },
        { country: 'UA', type: 3, date: iso(5) },
      ]);

      expect(release).toEqual({
        date: day(5),
        kind: MovieReleaseDateKind.THEATRICAL,
        country: 'UA',
      });
    });

    it('labels a US date when Ukraine releases on another day', () => {
      const release = resolveMovieRelease({ theatricalReleaseDate: day(5) }, [
        { country: 'UA', type: 3, date: iso(12) },
        { country: 'US', type: 3, date: iso(5) },
      ]);

      expect(release?.country).toBe('US');
    });

    it('matches the release type of the date kind', () => {
      const release = resolveMovieRelease({ digitalReleaseDate: day(3) }, [
        { country: 'US', type: 3, date: iso(3) },
        { country: 'UA', type: 4, date: iso(3) },
      ]);

      expect(release).toMatchObject({ kind: MovieReleaseDateKind.DIGITAL, country: 'UA' });
    });

    it('leaves the country unknown when the date came from elsewhere', () => {
      expect(resolveMovieRelease({ releaseDate: day(9) }, null)?.country).toBeNull();
      expect(
        resolveMovieRelease({ theatricalReleaseDate: day(9) }, [
          { country: 'US', type: 3, date: iso(10) },
        ])?.country,
      ).toBeNull();
    });

    it('returns null without any date', () => {
      expect(resolveMovieRelease({}, [])).toBeNull();
    });
  });

  describe('resolveMovieRelease properties', () => {
    const offset = fc.integer({ min: -400, max: 400 });
    const maybeDate = fc.option(offset, { nil: undefined });
    const country = fc.constantFrom('UA', 'US');
    const entry = fc.record({ country, type: fc.constantFrom(3, 4), offset });

    it('dates the release by theatrical, then digital, then primary date', () => {
      fc.assert(
        fc.property(maybeDate, maybeDate, maybeDate, (theatrical, digital, primary) => {
          const release = resolveMovieRelease(
            {
              theatricalReleaseDate: theatrical === undefined ? null : day(theatrical),
              digitalReleaseDate: digital === undefined ? null : day(digital),
              releaseDate: primary === undefined ? null : day(primary),
            },
            [],
          );
          const expected = theatrical ?? digital ?? primary;
          expect(release?.date).toEqual(expected === undefined ? undefined : day(expected));
          expect(release?.kind).toBe(
            expected === undefined
              ? undefined
              : theatrical === undefined && digital !== undefined
                ? MovieReleaseDateKind.DIGITAL
                : MovieReleaseDateKind.THEATRICAL,
          );
        }),
      );
    });

    it('labels a country only from an entry of the same kind and day, preferring UA', () => {
      fc.assert(
        fc.property(offset, fc.array(entry, { maxLength: 6 }), (releaseOffset, entries) => {
          const releases = entries.map((e) => ({
            country: e.country,
            type: e.type,
            date: iso(e.offset),
          }));
          const release = resolveMovieRelease(
            { theatricalReleaseDate: day(releaseOffset) },
            releases,
          );
          const matching = entries.filter((e) => e.type === 3 && e.offset === releaseOffset);
          const expected = matching.some((e) => e.country === 'UA')
            ? 'UA'
            : (matching.at(0)?.country ?? null);
          expect(release?.country).toBe(expected);
        }),
      );
    });
  });
});
