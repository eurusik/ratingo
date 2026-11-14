import { formatRelativeTime } from './relative-time';

const NOW = Date.parse('2026-11-14T12:00:00Z');
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe('formatRelativeTime', () => {
  it('says “just now” for the first minute', () => {
    expect(formatRelativeTime(ago(20), NOW, 'uk', 'щойно')).toBe('щойно');
  });

  it('picks the largest whole unit', () => {
    expect(formatRelativeTime(ago(5 * 60), NOW, 'en', 'just now')).toBe('5 minutes ago');
    expect(formatRelativeTime(ago(2 * 3600), NOW, 'en', 'just now')).toBe('2 hours ago');
    expect(formatRelativeTime(ago(24 * 3600), NOW, 'en', 'just now')).toBe('yesterday');
    expect(formatRelativeTime(ago(8 * 24 * 3600), NOW, 'en', 'just now')).toBe('last week');
    expect(formatRelativeTime(ago(400 * 24 * 3600), NOW, 'en', 'just now')).toBe('last year');
  });

  it('treats dates from the future as just now', () => {
    expect(formatRelativeTime(ago(-600), NOW, 'en', 'just now')).toBe('just now');
  });

  it('shows the full date before the client clock is known', () => {
    expect(formatRelativeTime(ago(60), Number.POSITIVE_INFINITY, 'en', 'just now')).toMatch(/2026/);
  });
});
