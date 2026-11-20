import fc from 'fast-check';

import { ShowStatus } from '@/common/enums/show-status.enum';

import { isAwaitingPremiere } from './show-premiere';

const NOW = new Date('2026-11-20T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

const anyStatus = fc.constantFrom<string | null>(...Object.values(ShowStatus), null);
const futureDate = fc
  .integer({ min: 1, max: 3650 })
  .map((days) => new Date(NOW.getTime() + days * DAY_MS));
const pastDate = fc
  .integer({ min: 0, max: 3650 })
  .map((days) => new Date(NOW.getTime() - days * DAY_MS));

describe('isAwaitingPremiere', () => {
  it('awaits a show whose first air date is still ahead, whatever its status', () => {
    fc.assert(
      fc.property(futureDate, anyStatus, (firstAirDate, status) => {
        expect(isAwaitingPremiere({ firstAirDate, status, hasAiredEpisode: false }, NOW)).toBe(
          true,
        );
      }),
    );
  });

  it('never awaits a show that already has an aired episode', () => {
    fc.assert(
      fc.property(fc.option(futureDate, { nil: null }), anyStatus, (firstAirDate, status) => {
        expect(isAwaitingPremiere({ firstAirDate, status, hasAiredEpisode: true }, NOW)).toBe(
          false,
        );
      }),
    );
  });

  it('never awaits a show whose first air date has passed', () => {
    fc.assert(
      fc.property(pastDate, anyStatus, (firstAirDate, status) => {
        expect(isAwaitingPremiere({ firstAirDate, status, hasAiredEpisode: false }, NOW)).toBe(
          false,
        );
      }),
    );
  });

  it.each([
    [ShowStatus.PLANNED, true],
    [ShowStatus.IN_PRODUCTION, true],
    [ShowStatus.PILOT, true],
    [ShowStatus.RETURNING_SERIES, false],
    [ShowStatus.ENDED, false],
    [ShowStatus.CANCELED, false],
    [null, false],
  ])('treats an undated %s show as awaiting: %s', (status, expected) => {
    expect(isAwaitingPremiere({ firstAirDate: null, status, hasAiredEpisode: false }, NOW)).toBe(
      expected,
    );
  });
});
