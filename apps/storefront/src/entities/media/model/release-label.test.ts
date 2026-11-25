import { formatReleaseBadge, formatReleaseDate } from './release-label';

describe('release dates', () => {
  it('formats a short badge without abbreviation dots', () => {
    expect(formatReleaseBadge('uk', '2026-12-12T00:00:00.000Z')).toBe('12 груд');
    expect(formatReleaseBadge('en', '2026-12-12T00:00:00.000Z')).toBe('Dec 12');
  });

  it('keeps the calendar day of a date-only release and names the year only when it is not this year', () => {
    const now = new Date('2026-11-19T12:00:00.000Z');
    expect(formatReleaseDate('uk', '2026-12-18T00:00:00.000Z', now)).toBe('18 грудня');
    expect(formatReleaseDate('uk', '2027-01-08T00:00:00.000Z', now)).toBe('8 січня 2027 р.');
  });

  it('dates an evening US airing by the Kyiv day, as the release calendar does', () => {
    const now = new Date('2026-11-19T12:00:00.000Z');
    expect(formatReleaseBadge('uk', '2027-01-07T03:00:00.000Z')).toBe('7 січ');
    expect(formatReleaseDate('uk', '2026-12-31T23:00:00.000Z', now)).toBe('1 січня 2027 р.');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatReleaseBadge('uk', 'soon')).toBe('');
  });
});
