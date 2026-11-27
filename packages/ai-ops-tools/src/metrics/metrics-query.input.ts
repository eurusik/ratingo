import { z } from 'zod';

import {
  METRIC_DEFAULT_WINDOW,
  METRIC_OFFSET_MAX_DAYS,
  MetricTemplateName,
} from './metrics.constants';

export const METRIC_TEMPLATE_NAMES = Object.values(MetricTemplateName) as [
  MetricTemplateName,
  ...MetricTemplateName[],
];
export const metricsQueryInput = z.object({
  template: z.enum(METRIC_TEMPLATE_NAMES).describe('Name of a ready-made metric query'),
  queue: z.string().optional().describe('Queue name, for the queue_* templates'),
  job: z
    .string()
    .optional()
    .describe('Part of a job name such as refresh-all, for scheduler_last_runs'),
  provider: z.string().optional().describe('Provider host name, for http_client_errors'),
  status: z.string().optional().describe('HTTP status such as 429, for http_client_errors'),
  window: z
    .string()
    .optional()
    .describe(
      `How far back to look, such as 6h, 24h or 7d (at most 7d). Default ${METRIC_DEFAULT_WINDOW}`,
    ),
  offset_days: z
    .number()
    .int()
    .min(0)
    .max(METRIC_OFFSET_MAX_DAYS)
    .optional()
    .describe('Shift the whole query this many days into the past, for comparison. Default 0'),
});

export type MetricsQueryInput = z.infer<typeof metricsQueryInput>;
