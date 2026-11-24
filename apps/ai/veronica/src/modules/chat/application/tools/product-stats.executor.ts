import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import {
  PRODUCT_SERIES_PORT,
  SourceState,
  kyivDateOf,
  type ProductSeriesPort,
} from '../../../digest/public';
import { parseWindow } from '../../domain/policies/metric-params.policy';

import type { ProductStatsInput } from './investigation-executors';

const MS_PER_DAY = 86_400_000;
const HOURS_PER_DAY = 24;
const DEFAULT_PRODUCT_WINDOW = '7d';

@Injectable()
export class ProductStatsExecutor {
  constructor(
    @Inject(PRODUCT_SERIES_PORT) private readonly series: ProductSeriesPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async run(input: ProductStatsInput): Promise<unknown> {
    const window = parseWindow(input.window ?? DEFAULT_PRODUCT_WINDOW);
    if (window === null) {
      throw new Error('window must look like 3d or 7d and be at most 7 days');
    }
    const nowMs = this.clock.nowMs();
    const completeDays = Math.max(1, Math.ceil(window.hours / HOURS_PER_DAY));
    const days = Array.from({ length: completeDays + 1 }, (_, index) =>
      kyivDateOf(nowMs - (completeDays - index) * MS_PER_DAY),
    );
    const today = days[days.length - 1];
    const reading = await this.series.series(input.metric, days[0], today);
    if (reading.state === SourceState.UNAVAILABLE) {
      return { metric: input.metric, unavailable: reading.reason };
    }
    const valueOf = new Map(reading.data.map((row) => [row.day, row.value]));
    return {
      metric: input.metric,
      days: days.map((day) => ({
        day,
        value: valueOf.get(day) ?? 0,
        ...(day === today ? { partialDay: true } : {}),
      })),
      totalOfCompleteDays: days.slice(0, -1).reduce((sum, day) => sum + (valueOf.get(day) ?? 0), 0),
    };
  }
}
