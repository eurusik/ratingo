import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createPerformanceTracker,
  trackPhase,
  addShowTime,
  calculateShowStats,
} from './performance';

describe('trending/performance', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('createPerformanceTracker initializes phases and retry handler', () => {
    const t = createPerformanceTracker();
    expect(t.phases.trendingFetchMs).toBe(0);
    const handler = t.onRetryLabel('X');
    handler(1, new Error('e'));
    expect(t.retryCounts['X']).toBe(1);
  });

  it('addShowTime and calculateShowStats compute avg and max', () => {
    const t = createPerformanceTracker();
    addShowTime(t, 10);
    addShowTime(t, 30);
    const stats = calculateShowStats(t);
    expect(stats.avg).toBe(20);
    expect(stats.max).toBe(30);
  });

  it('trackPhase measures duration and returns result', async () => {
    const t = createPerformanceTracker();
    const spy = vi.spyOn(Date, 'now');
    spy.mockReturnValueOnce(1000);
    spy.mockReturnValueOnce(1030);
    const res = await trackPhase(t, 'monthlyMapsMs', async () => 42 as any);
    expect(res).toBe(42);
    expect(t.phases.monthlyMapsMs).toBe(30);
  });
});
