import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import { METRICS_PORT, type MetricsPort } from '../../../digest/public';
import { METRIC_SERIES_CAP } from '../../domain/constants/investigation.constants';
import { formatKyivDateTime } from '../../domain/policies/kyiv-time.policy';

import type { MetricsQueryInput } from './investigation-executors';
import { METRIC_TEMPLATES, type QueryResult } from './metric-templates';

const MS_PER_DAY = 86_400_000;

const PARAMETER_KEYS = ['queue', 'provider', 'status', 'window', 'offset_days'] as const;

const providedParameters = (input: MetricsQueryInput): Record<string, unknown> =>
  Object.fromEntries(
    PARAMETER_KEYS.flatMap((key) => (input[key] === undefined ? [] : [[key, input[key]]])),
  );

@Injectable()
export class MetricsQueryExecutor {
  constructor(
    @Inject(METRICS_PORT) private readonly metrics: MetricsPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async run(input: MetricsQueryInput): Promise<unknown> {
    const template = METRIC_TEMPLATES[input.template];
    const parsed = template.params.safeParse(providedParameters(input));
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid parameters for ${template.name}: ${problems}`);
    }
    const params = parsed.data;
    const offsetDays = Number(params.offset_days ?? 0);
    const atMs = this.clock.nowMs() - offsetDays * MS_PER_DAY;
    const results: QueryResult[] = await Promise.all(
      template.queries(params).map(async (query) => ({
        name: query.name,
        samples: (await this.metrics.instant(query.promql, atMs)).slice(0, METRIC_SERIES_CAP),
      })),
    );
    return {
      template: template.name,
      window: params.window ?? null,
      offsetDays,
      evaluatedAtKyiv: formatKyivDateTime(atMs),
      ...template.present(results, atMs),
    };
  }
}
