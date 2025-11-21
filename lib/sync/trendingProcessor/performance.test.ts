import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  measurePerformance,
  createPerformanceMetrics,
  formatPerformanceMetrics,
} from './performance';

describe('trendingProcessor/performance', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('measurePerformance returns result and correct duration on success', async () => {
    const spy = vi.spyOn(performance, 'now');
    spy.mockReturnValueOnce(100);
    spy.mockReturnValueOnce(260);
    const fn = vi.fn(async () => 42);
    const res = await measurePerformance(fn);
    expect(res.result).toBe(42);
    expect(res.duration).toBe(160);
    expect(fn).toHaveBeenCalled();
    expect(res.startTime).toBeInstanceOf(Date);
    expect(res.endTime).toBeInstanceOf(Date);
  });

  it('measurePerformance returns undefined result and duration on error', async () => {
    const spy = vi.spyOn(performance, 'now');
    spy.mockReturnValueOnce(500);
    spy.mockReturnValueOnce(620);
    const fn = vi.fn(async () => {
      throw new Error('boom');
    });
    const res = await measurePerformance(fn);
    expect(res.result).toBeUndefined();
    expect(res.duration).toBe(120);
  });

  it('createPerformanceMetrics computes counters and passes phases', () => {
    const results = [true, false, true, true];
    const phases = { fetch: 150, processing: 2500, db: 300 };
    const metrics = createPerformanceMetrics(results, phases);
    expect(metrics.totalProcessed).toBe(4);
    expect(metrics.succeeded).toBe(3);
    expect(metrics.failed).toBe(1);
    expect(metrics.phases).toEqual(phases);
  });

  it('formatPerformanceMetrics returns readable string with phases', () => {
    const metrics = {
      totalProcessed: 4,
      succeeded: 3,
      failed: 1,
      averageProcessingTime: 0,
      maxProcessingTime: 0,
      minProcessingTime: 0,
      phases: { fetch: 150, processing: 2500 },
    };
    const out = formatPerformanceMetrics(metrics as any);
    expect(out).toContain('Всього оброблено: 4');
    expect(out).toContain('Успішно: 3');
    expect(out).toContain('Невдало: 1');
    expect(out).toContain('Фази обробки:');
    expect(out).toContain('fetch: 150мс');
    expect(out).toContain('processing: 2500мс');
  });
});
