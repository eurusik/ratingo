import fc from 'fast-check';
import { groupByAge, notificationGroup, notificationTime } from './notification-time';

const NOW = new Date(2026, 10, 15, 18, 0).getTime();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('notification time', () => {
  it('splits notifications into today, this week and earlier', () => {
    expect(notificationGroup(new Date(NOW - 2 * HOUR).toISOString(), NOW)).toBe('today');
    expect(notificationGroup(new Date(NOW - 2 * DAY).toISOString(), NOW)).toBe('week');
    expect(notificationGroup(new Date(NOW - 10 * DAY).toISOString(), NOW)).toBe('earlier');
  });

  it('keeps every notification exactly once and in its order', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 30 * DAY }), { maxLength: 30 }), (ages) => {
        const items = ages.map((age, index) => ({
          id: index,
          createdAt: new Date(NOW - age).toISOString(),
        }));
        const grouped = groupByAge(items, NOW).flatMap((group) => group.items);
        expect(grouped.map((item) => item.id).sort((a, b) => a - b)).toEqual(
          items.map((item) => item.id),
        );
      }),
    );
  });

  it('shows hours for today and a weekday for this week', () => {
    expect(notificationTime(new Date(NOW - 2 * HOUR).toISOString(), NOW, 'en')).toMatch(/2 hr/);
    expect(notificationTime(new Date(NOW - 2 * DAY).toISOString(), NOW, 'en')).toBe('Fri');
  });
});
