import { calendarKey, isSameRangeAfterSignIn } from './calendar-keys';

const query = { startDate: '2026-11-08', days: 8, personalized: false, type: 'show' } as const;

describe('isSameRangeAfterSignIn', () => {
  it('reuses guest data only for the same range right after sign-in', () => {
    const guest = calendarKey({ viewerId: null, ...query });
    expect(isSameRangeAfterSignIn(guest, calendarKey({ viewerId: 'user', ...query }))).toBe(true);
  });

  it.each([
    ['another viewer', calendarKey({ viewerId: 'a', ...query }), { viewerId: 'b', ...query }],
    ['sign-out', calendarKey({ viewerId: 'a', ...query }), { viewerId: null, ...query }],
    [
      'another week',
      calendarKey({ viewerId: null, ...query }),
      { viewerId: 'a', ...query, startDate: '2026-11-15' },
    ],
    [
      'another type',
      calendarKey({ viewerId: null, ...query }),
      { viewerId: 'a', ...query, type: 'movie' as const },
    ],
  ])('never reuses data after %s', (_case, previous, next) => {
    expect(isSameRangeAfterSignIn(previous, calendarKey(next))).toBe(false);
  });
});
