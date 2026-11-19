import { calendarHref, parseCalendarLocation, weekRequest } from './calendar-query';

const TODAY = '2026-11-15';

describe('calendar query', () => {
  it('defaults to the current week and no explicit mode', () => {
    expect(parseCalendarLocation({}, TODAY)).toEqual({
      weekStart: '2026-11-09',
      mode: undefined,
      type: 'show',
    });
  });

  it('snaps any date in the week param to its Monday', () => {
    expect(parseCalendarLocation({ week: '2026-11-19', mode: 'all' }, TODAY)).toEqual({
      weekStart: '2026-11-16',
      mode: 'all',
      type: 'show',
    });
  });

  it.each([
    { week: 'soon' },
    { week: '2026-13-40' },
    { week: '2026-02-31' },
    { week: '0000-01-01' },
    { week: '2000-01-01' },
    { week: '2100-12-31' },
    { mode: 'friends' },
    { type: 'person' },
  ])('ignores invalid params %p', (params) => {
    expect(parseCalendarLocation(params, TODAY)).toEqual({
      weekStart: '2026-11-09',
      mode: undefined,
      type: 'show',
    });
  });

  it('reads the movie type from the URL', () => {
    expect(parseCalendarLocation({ type: 'movie' }, TODAY)).toMatchObject({ type: 'movie' });
  });

  it('keeps the current week out of the URL', () => {
    expect(calendarHref({ weekStart: '2026-11-09', type: 'show' }, TODAY)).toBe('/calendar');
    expect(calendarHref({ weekStart: '2026-11-16', mode: 'mine', type: 'show' }, TODAY)).toBe(
      '/calendar?week=2026-11-16&mode=mine',
    );
  });

  it('keeps shows, the default type, out of the URL', () => {
    expect(calendarHref({ weekStart: '2026-11-09', type: 'movie' }, TODAY)).toBe(
      '/calendar?type=movie',
    );
    expect(calendarHref({ weekStart: '2026-11-16', mode: 'all', type: 'movie' }, TODAY)).toBe(
      '/calendar?type=movie&week=2026-11-16&mode=all',
    );
  });

  it('asks the API for one extra UTC day so the whole Kyiv week is covered', () => {
    expect(weekRequest('2026-11-09')).toEqual({ startDate: '2026-11-08', days: 8 });
  });
});
