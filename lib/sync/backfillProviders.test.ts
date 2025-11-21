import { describe, it, expect, vi } from 'vitest';

vi.mock('./backfillProviders/index', () => ({
  backfillProviderRegistryFromJoinTable: vi.fn(async () => ({ inserted: 1, updated: 2 })),
}));

describe('backfillProviders facade', () => {
  it('delegates to backfillProviders/index', async () => {
    const { backfillProviderRegistryFromJoinTable } = await import('./backfillProviders');
    const res = await backfillProviderRegistryFromJoinTable();
    expect(res).toEqual({ inserted: 1, updated: 2 });
  });
});
