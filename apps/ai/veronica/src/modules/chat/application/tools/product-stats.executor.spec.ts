import { FixedClock } from '@ratingo/ai-core';

import { available, unavailable, type DailyValue } from '../../../digest/public';

import { ProductStatsExecutor } from './product-stats.executor';

const NOW_MS = Date.UTC(2026, 10, 22, 12, 0, 0);

const executorWith = (
  reading:
    ReturnType<typeof available<DailyValue[]>> | ReturnType<typeof unavailable<DailyValue[]>>,
) => {
  const asked: unknown[][] = [];
  const executor = new ProductStatsExecutor(
    {
      series: async (...args) => {
        asked.push(args);
        return reading;
      },
    },
    new FixedClock(NOW_MS),
  );
  return { executor, asked };
};

describe('ProductStatsExecutor', () => {
  it('lists complete days plus today as partial, with zero for a day without rows', async () => {
    const { executor, asked } = executorWith(
      available([
        { day: '2026-11-20', value: 5 },
        { day: '2026-11-22', value: 2 },
      ]),
    );
    const result = await executor.run({ metric: 'new_users', window: '3d' });
    expect(asked).toEqual([['new_users', '2026-11-19', '2026-11-22']]);
    expect(result).toEqual({
      metric: 'new_users',
      days: [
        { day: '2026-11-19', value: 0 },
        { day: '2026-11-20', value: 5 },
        { day: '2026-11-21', value: 0 },
        { day: '2026-11-22', value: 2, partialDay: true },
      ],
      totalOfCompleteDays: 5,
    });
  });

  it('reads the last 7 days by default', async () => {
    const { executor, asked } = executorWith(available([]));
    await executor.run({ metric: 'actions' });
    expect(asked[0].slice(1)).toEqual(['2026-11-15', '2026-11-22']);
  });

  it('reports a missing source instead of zeros', async () => {
    const { executor } = executorWith(unavailable('звіти про людей ще не підключені'));
    await expect(executor.run({ metric: 'new_users' })).resolves.toEqual({
      metric: 'new_users',
      unavailable: 'звіти про людей ще не підключені',
    });
  });

  it('rejects a window beyond 7 days', async () => {
    const { executor, asked } = executorWith(available([]));
    await expect(executor.run({ metric: 'new_users', window: '30d' })).rejects.toThrow(/7 days/);
    expect(asked).toEqual([]);
  });
});
