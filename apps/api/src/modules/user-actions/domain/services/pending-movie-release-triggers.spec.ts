import * as fc from 'fast-check';

import { addUtcDays, utcDateFromDayId } from '@/common/utils/date.util';

import { MOVIE_DIGITAL_RELEASE_AWAIT_DAYS } from '../constants/subscription.constants';
import { SUBSCRIPTION_TRIGGER } from '../entities/user-subscription.entity';
import { type MovieReleaseSchedule } from '../ports/movie-release.port';

import { pendingMovieReleaseTriggers } from './pending-movie-release-triggers';

const today = utcDateFromDayId('20261119');

const schedule = (overrides: Partial<MovieReleaseSchedule>): MovieReleaseSchedule => ({
  theatricalReleaseDate: null,
  digitalReleaseDate: null,
  releaseDate: null,
  ...overrides,
});

describe('pendingMovieReleaseTriggers', () => {
  it('waits for both releases of a movie that is not out yet, digital first', () => {
    const triggers = pendingMovieReleaseTriggers(
      schedule({
        theatricalReleaseDate: addUtcDays(today, 10),
        digitalReleaseDate: addUtcDays(today, 60),
      }),
      today,
    );

    expect(triggers).toEqual([SUBSCRIPTION_TRIGGER.ON_STREAMING, SUBSCRIPTION_TRIGGER.RELEASE]);
  });

  it('waits for both releases when no date is known yet', () => {
    expect(pendingMovieReleaseTriggers(schedule({}), today)).toEqual([
      SUBSCRIPTION_TRIGGER.ON_STREAMING,
      SUBSCRIPTION_TRIGGER.RELEASE,
    ]);
  });

  it('treats a release today as still pending', () => {
    expect(
      pendingMovieReleaseTriggers(schedule({ theatricalReleaseDate: today }), today),
    ).toContain(SUBSCRIPTION_TRIGGER.RELEASE);
  });

  it('waits only for the digital release of a movie already in cinemas', () => {
    const triggers = pendingMovieReleaseTriggers(
      schedule({ theatricalReleaseDate: addUtcDays(today, -20) }),
      today,
    );

    expect(triggers).toEqual([SUBSCRIPTION_TRIGGER.ON_STREAMING]);
  });

  it('waits for nothing once the digital release has passed', () => {
    const triggers = pendingMovieReleaseTriggers(
      schedule({
        theatricalReleaseDate: addUtcDays(today, -90),
        digitalReleaseDate: addUtcDays(today, -1),
      }),
      today,
    );

    expect(triggers).toEqual([]);
  });

  it('stops waiting for a digital release of a movie that came out long ago', () => {
    const triggers = pendingMovieReleaseTriggers(
      schedule({ releaseDate: addUtcDays(today, -MOVIE_DIGITAL_RELEASE_AWAIT_DAYS - 1) }),
      today,
    );

    expect(triggers).toEqual([]);
  });

  it('never waits for a release whose date is already behind', () => {
    const pastDay = fc.integer({ min: 1, max: 20_000 }).map((days) => addUtcDays(today, -days));
    const anyDay = fc.option(
      fc.integer({ min: -20_000, max: 20_000 }).map((days) => addUtcDays(today, days)),
      { nil: null },
    );

    fc.assert(
      fc.property(pastDay, anyDay, anyDay, (theatrical, digital, releaseDate) => {
        const triggers = pendingMovieReleaseTriggers(
          schedule({ theatricalReleaseDate: theatrical, digitalReleaseDate: digital, releaseDate }),
          today,
        );
        return !triggers.includes(SUBSCRIPTION_TRIGGER.RELEASE);
      }),
    );
  });

  it('always waits for a digital release dated today or later', () => {
    const futureDay = fc.integer({ min: 0, max: 20_000 }).map((days) => addUtcDays(today, days));
    const anyDay = fc.option(
      fc.integer({ min: -20_000, max: 20_000 }).map((days) => addUtcDays(today, days)),
      { nil: null },
    );

    fc.assert(
      fc.property(futureDay, anyDay, anyDay, (digital, theatrical, releaseDate) =>
        pendingMovieReleaseTriggers(
          schedule({ theatricalReleaseDate: theatrical, digitalReleaseDate: digital, releaseDate }),
          today,
        ).includes(SUBSCRIPTION_TRIGGER.ON_STREAMING),
      ),
    );
  });
});
