import { RowList, type ClockPort } from '@ratingo/ai-core';

import { InvalidOpsInputError } from '../shared/invalid-ops-input.error';
import { formatKyivDateTime } from '../time/kyiv-time';

import { METRIC_TEMPLATES, type QueryResult } from './metric-templates';
import type { MetricsQueryInput } from './metrics-query.input';
import { METRIC_SERIES_CAP } from './metrics.constants';
import type { MetricsPort } from './metrics.port';

const MS_PER_DAY = 86_400_000;

const PARAMETER_KEYS = ['queue', 'job', 'provider', 'status', 'window', 'offset_days'] as const;

const providedParameters = (input: MetricsQueryInput): Record<string, unknown> =>
  Object.fromEntries(
    PARAMETER_KEYS.flatMap((key) => (input[key] === undefined ? [] : [[key, input[key]]])),
  );

export class MetricsQueryExecutor {
  constructor(
    private readonly metrics: MetricsPort,
    private readonly clock: ClockPort,
  ) {}

  async run(input: MetricsQueryInput): Promise<unknown> {
    const template = METRIC_TEMPLATES[input.template];
    const parsed = template.params.safeParse(providedParameters(input));
    if (!parsed.success) {
      const problems = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
        .join('; ');
      throw new InvalidOpsInputError(`Invalid parameters for ${template.name}: ${problems}`);
    }
    const params = parsed.data;
    const offsetDays = Number(params.offset_days ?? 0);
    const atMs = this.clock.nowMs() - offsetDays * MS_PER_DAY;
    const { results, seriesOmitted } = await this.fetch(template.queries(params), atMs);
    const envelope = {
      template: template.name,
      window: params.window ?? null,
      offsetDays,
      evaluatedAtKyiv: formatKyivDateTime(atMs),
      ...(seriesOmitted > 0 ? { seriesOmitted } : {}),
    };
    const reading = template.present(results, atMs, params);
    return 'data' in reading && reading.data instanceof RowList
      ? reading.data.around((data) => ({ ...envelope, data }))
      : { ...envelope, ...reading };
  }

  private async fetch(
    queries: readonly { name: string; promql: string }[],
    atMs: number,
  ): Promise<{ results: QueryResult[]; seriesOmitted: number }> {
    const fetched = await Promise.all(
      queries.map(async (query) => ({
        name: query.name,
        samples: await this.metrics.instant(query.promql, atMs),
      })),
    );
    return {
      results: fetched.map((result) => ({
        name: result.name,
        samples: result.samples.slice(0, METRIC_SERIES_CAP),
      })),
      seriesOmitted: fetched.reduce(
        (sum, result) => sum + Math.max(0, result.samples.length - METRIC_SERIES_CAP),
        0,
      ),
    };
  }
}
