import fc from 'fast-check';

import { ShipBudget } from './ship-budget';

const MINUTE = 60_000;
const DAY = 86_400_000;
const LIMITS = { maxRecordsPerMinute: 10, maxBytesPerDay: 10_000 };

describe('ShipBudget', () => {
  it('admits up to the per-minute limit, then refuses until the next minute', () => {
    const budget = new ShipBudget(LIMITS);

    const verdicts = Array.from({ length: 12 }, () => budget.admit('info', 10, 0));

    expect(verdicts.filter((verdict) => verdict === 'ok')).toHaveLength(10);
    expect(verdicts[10]).toBe('rate_limit');
    expect(budget.admit('info', 10, MINUTE)).toBe('ok');
  });

  it('lets errors use twice the per-minute rate', () => {
    const budget = new ShipBudget(LIMITS);

    const verdicts = Array.from({ length: 25 }, () => budget.admit('error', 10, 0));

    expect(verdicts.filter((verdict) => verdict === 'ok')).toHaveLength(20);
  });

  it('keeps 20 percent of the daily bytes for errors', () => {
    const budget = new ShipBudget({ maxRecordsPerMinute: 1_000_000, maxBytesPerDay: 1_000 });

    expect(budget.admit('warn', 800, 0)).toBe('ok');
    expect(budget.admit('warn', 1, 0)).toBe('daily_cap');
    expect(budget.admit('error', 150, 0)).toBe('ok');
    expect(budget.admit('error', 100, 0)).toBe('daily_cap');
  });

  it('resets the daily bytes at the UTC day boundary', () => {
    const budget = new ShipBudget({ maxRecordsPerMinute: 1_000_000, maxBytesPerDay: 1_000 });
    budget.admit('error', 1_000, 0);

    expect(budget.admit('error', 1, 1)).toBe('daily_cap');
    expect(budget.admit('error', 1, DAY)).toBe('ok');
  });

  it('never admits more than the daily cap in a day, whatever the traffic', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            level: fc.constantFrom('debug', 'info', 'warn', 'error'),
            bytes: fc.integer({ min: 1, max: 400 }),
            at: fc.integer({ min: 0, max: DAY - 1 }),
          }),
          { maxLength: 300 },
        ),
        (events) => {
          const budget = new ShipBudget({ maxRecordsPerMinute: 1_000_000, maxBytesPerDay: 3_000 });
          const admitted = [...events]
            .sort((a, b) => a.at - b.at)
            .filter((event) => budget.admit(event.level, event.bytes, event.at) === 'ok')
            .reduce((sum, event) => sum + event.bytes, 0);
          return admitted <= 3_000;
        },
      ),
    );
  });
});
