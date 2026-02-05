import { buildYearStart, buildYearRange, buildYearConditions } from './year-range.util';

describe('year-range.util', () => {
  describe('buildYearStart', () => {
    it('returns January 1st 00:00:00 UTC for given year', () => {
      const date = buildYearStart(2024);

      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(0);
      expect(date.getUTCDate()).toBe(1);
      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });

    it('works for different years', () => {
      expect(buildYearStart(2000).getUTCFullYear()).toBe(2000);
      expect(buildYearStart(1990).getUTCFullYear()).toBe(1990);
      expect(buildYearStart(2030).getUTCFullYear()).toBe(2030);
    });
  });

  describe('buildYearRange', () => {
    it('returns start and end dates for a year', () => {
      const { start, end } = buildYearRange(2024);

      expect(start.getUTCFullYear()).toBe(2024);
      expect(start.getUTCMonth()).toBe(0);
      expect(start.getUTCDate()).toBe(1);

      expect(end.getUTCFullYear()).toBe(2025);
      expect(end.getUTCMonth()).toBe(0);
      expect(end.getUTCDate()).toBe(1);
    });

    it('end date is exclusive (first day of next year)', () => {
      const { end } = buildYearRange(2020);

      expect(end.toISOString()).toBe('2021-01-01T00:00:00.000Z');
    });
  });

  describe('buildYearConditions', () => {
    const mockColumn = { name: 'releaseDate' } as never;

    it('returns empty array when no year params provided', () => {
      const conditions = buildYearConditions(mockColumn);

      expect(conditions).toEqual([]);
    });

    it('returns empty array when all year params are undefined', () => {
      const conditions = buildYearConditions(mockColumn, undefined, undefined, undefined);

      expect(conditions).toEqual([]);
    });

    it('returns 3 conditions for exact year', () => {
      const conditions = buildYearConditions(mockColumn, 2024);

      // isNotNull, gte, lt
      expect(conditions).toHaveLength(3);
    });

    it('returns 2 conditions for yearFrom only', () => {
      const conditions = buildYearConditions(mockColumn, undefined, 2020);

      // isNotNull, gte
      expect(conditions).toHaveLength(2);
    });

    it('returns 2 conditions for yearTo only', () => {
      const conditions = buildYearConditions(mockColumn, undefined, undefined, 2024);

      // isNotNull, lt
      expect(conditions).toHaveLength(2);
    });

    it('returns 3 conditions for yearFrom and yearTo', () => {
      const conditions = buildYearConditions(mockColumn, undefined, 2020, 2024);

      // isNotNull, gte, lt
      expect(conditions).toHaveLength(3);
    });

    it('year takes precedence (ignores yearFrom/yearTo when year is set)', () => {
      const conditionsWithYear = buildYearConditions(mockColumn, 2024, 2020, 2025);
      const conditionsYearOnly = buildYearConditions(mockColumn, 2024);

      // Both should produce 3 conditions (exact year)
      expect(conditionsWithYear).toHaveLength(3);
      expect(conditionsYearOnly).toHaveLength(3);
    });
  });
});
