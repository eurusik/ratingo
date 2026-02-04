import { applyPaginationDefaults, normalizeListQuery, resolveDaysBack } from './query-normalizer';

describe('normalizeListQuery', () => {
  it('parses comma-separated genres into array', () => {
    const query = { genres: 'action, comedy, drama' } as any;
    const result = normalizeListQuery(query);

    expect(result.genres).toEqual(['action', 'comedy', 'drama']);
  });

  it('returns undefined genres when not provided', () => {
    const query = {} as any;
    const result = normalizeListQuery(query);

    expect(result.genres).toBeUndefined();
  });

  it('filters empty genre strings', () => {
    const query = { genres: 'action,, ,comedy' } as any;
    const result = normalizeListQuery(query);

    expect(result.genres).toEqual(['action', 'comedy']);
  });

  it('preserves other query properties', () => {
    const query = { limit: 10, offset: 5, genres: 'action' } as any;
    const result = normalizeListQuery(query);

    expect(result.limit).toBe(10);
    expect(result.offset).toBe(5);
  });
});

describe('resolveDaysBack', () => {
  it('returns provided daysBack when positive', () => {
    expect(resolveDaysBack(30, 14)).toBe(30);
  });

  it('returns default when daysBack is undefined', () => {
    expect(resolveDaysBack(undefined, 14)).toBe(14);
  });

  it('returns default when daysBack is zero', () => {
    expect(resolveDaysBack(0, 14)).toBe(14);
  });

  it('returns default when daysBack is negative', () => {
    expect(resolveDaysBack(-5, 14)).toBe(14);
  });

  it('clamps daysBack to maximum (365)', () => {
    expect(resolveDaysBack(1000, 14)).toBe(365);
  });

  it('allows values up to maximum', () => {
    expect(resolveDaysBack(365, 14)).toBe(365);
  });
});

describe('applyPaginationDefaults', () => {
  it('applies default limit when not provided', () => {
    const result = applyPaginationDefaults({ offset: 10 });

    expect(result.limit).toBe(20);
    expect(result.offset).toBe(10);
  });

  it('applies default offset when not provided', () => {
    const result = applyPaginationDefaults({ limit: 50 });

    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('applies both defaults when neither provided', () => {
    const result = applyPaginationDefaults({});

    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('preserves provided values', () => {
    const result = applyPaginationDefaults({ limit: 10, offset: 5 });

    expect(result.limit).toBe(10);
    expect(result.offset).toBe(5);
  });

  it('preserves other query properties', () => {
    const result = applyPaginationDefaults({ limit: 10, offset: 5, genres: ['action'] } as any);

    expect(result.genres).toEqual(['action']);
  });
});
