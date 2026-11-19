import { formatReleaseBadge, formatReleaseDate } from './release-label';

describe('release dates', () => {
  it('formats a short badge without abbreviation dots', () => {
    expect(formatReleaseBadge('uk', '2026-12-12T00:00:00.000Z')).toBe('12 груд');
    expect(formatReleaseBadge('en', '2026-12-12T00:00:00.000Z')).toBe('Dec 12');
  });

  it('keeps the UTC calendar day and names the year only when it is not this year', () => {
    const now = new Date('2026-11-19T12:00:00.000Z');
    expect(formatReleaseDate('uk', '2026-12-18T00:00:00.000Z', now)).toBe('18 грудня');
    expect(formatReleaseDate('uk', '2027-01-08T00:00:00.000Z', now)).toBe('8 січня 2027 р.');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatReleaseBadge('uk', 'soon')).toBe('');
  });
});
