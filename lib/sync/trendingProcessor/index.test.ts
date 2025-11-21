import { describe, it, expect } from 'vitest';

describe('trendingProcessor/index facade', () => {
  it('exports key functions and types', async () => {
    const mod = await import('./index');
    expect(typeof mod.runTrendingProcessor).toBe('function');
    expect(typeof mod.createTrendingCache).toBe('function');
    expect(typeof mod.processTrendingTask).toBe('function');
    expect(typeof mod.fetchPendingTasks).toBe('function');
    expect(typeof mod.measurePerformance).toBe('function');
  });
});
