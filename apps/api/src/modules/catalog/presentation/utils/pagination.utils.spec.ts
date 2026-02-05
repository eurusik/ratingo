import { buildPaginationMeta } from './pagination.utils';

describe('buildPaginationMeta', () => {
  it('uses provided limit and offset', () => {
    const result = buildPaginationMeta({ limit: 10, offset: 5 }, { length: 10, total: 100 });

    expect(result).toEqual({
      count: 10,
      total: 100,
      limit: 10,
      offset: 5,
      hasMore: true,
    });
  });

  it('applies default limit when not provided', () => {
    const result = buildPaginationMeta({ offset: 0 }, { length: 5, total: 5 });

    expect(result.limit).toBe(20);
  });

  it('applies default offset when not provided', () => {
    const result = buildPaginationMeta({ limit: 10 }, { length: 5, total: 5 });

    expect(result.offset).toBe(0);
  });

  it('calculates hasMore correctly when more items exist', () => {
    const result = buildPaginationMeta({ limit: 10, offset: 0 }, { length: 10, total: 50 });

    expect(result.hasMore).toBe(true);
  });

  it('calculates hasMore correctly when no more items', () => {
    const result = buildPaginationMeta({ limit: 10, offset: 40 }, { length: 10, total: 50 });

    expect(result.hasMore).toBe(false);
  });

  it('uses result length as total when total not provided', () => {
    const result = buildPaginationMeta({ limit: 10, offset: 0 }, { length: 5 });

    expect(result.total).toBe(5);
    expect(result.hasMore).toBe(false);
  });

  it('handles empty result correctly', () => {
    const result = buildPaginationMeta({ limit: 20, offset: 0 }, { length: 0, total: 0 });

    expect(result).toEqual({
      count: 0,
      total: 0,
      limit: 20,
      offset: 0,
      hasMore: false,
    });
  });

  it('handles offset beyond total', () => {
    const result = buildPaginationMeta({ limit: 10, offset: 100 }, { length: 0, total: 50 });

    expect(result.hasMore).toBe(false);
    expect(result.count).toBe(0);
  });
});
