import fc from 'fast-check';
import type { UserMediaState } from '@/shared/api';
import { groupByMonth, matchesQuery, toHistoryRows } from './history-months';

function watched(id: string, title: string, updatedAt: string): UserMediaState {
  return {
    id,
    userId: 'user',
    mediaItemId: id,
    state: 'completed',
    rating: null,
    progress: null,
    notes: null,
    createdAt: updatedAt,
    updatedAt,
    mediaSummary: { id, type: 'movie', title, slug: id, poster: null },
  };
}

describe('history months', () => {
  it('groups consecutive titles by the month they were watched', () => {
    const rows = toHistoryRows([
      watched('a', 'Конклав', '2026-11-12T10:00:00Z'),
      watched('b', 'Анора', '2026-11-03T10:00:00Z'),
      watched('c', 'Субстанція', '2026-10-28T10:00:00Z'),
    ]);
    expect(groupByMonth(rows).map((month) => [month.key, month.rows.length])).toEqual([
      ['2026-11', 2],
      ['2026-10', 1],
    ]);
  });

  it('keeps every row exactly once', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.date({
            min: new Date('2020-01-01'),
            max: new Date('2030-01-01'),
            noInvalidDate: true,
          }),
        ),
        (dates) => {
          const rows = toHistoryRows(
            dates.map((date, index) => watched(String(index), 'x', date.toISOString())),
          );
          expect(groupByMonth(rows).flatMap((month) => month.rows)).toEqual(rows);
        },
      ),
    );
  });

  it('finds titles regardless of case', () => {
    const [row] = toHistoryRows([watched('a', 'Ведмідь', '2026-11-01T00:00:00Z')]);
    expect(matchesQuery(row, 'ведм')).toBe(true);
    expect(matchesQuery(row, '  ')).toBe(true);
    expect(matchesQuery(row, 'дюна')).toBe(false);
  });
});
