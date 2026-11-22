import { z } from 'zod';

import { defineTool, type Tool } from '@ratingo/ai-core';

import { SeriesMetric } from '../../../digest/public';
import {
  InvestigationTool,
  METRIC_DEFAULT_WINDOW,
  METRIC_OFFSET_MAX_DAYS,
  MetricTemplateName,
} from '../../domain/constants/investigation.constants';

import type { InvestigationExecutors } from './investigation-executors';
import { METRIC_TEMPLATES } from './metric-templates';

const TEMPLATE_NAMES = Object.values(MetricTemplateName) as [
  MetricTemplateName,
  ...MetricTemplateName[],
];
const SERIES_METRICS = Object.values(SeriesMetric) as [SeriesMetric, ...SeriesMetric[]];

const templateCatalog = TEMPLATE_NAMES.map(
  (name) => `${name}: ${METRIC_TEMPLATES[name].description}`,
).join(' ');

const METRICS_OUTPUT_CAP = 3000;
const PRODUCT_OUTPUT_CAP = 3000;
const SNAPSHOT_OUTPUT_CAP = 6000;
const CHANGES_OUTPUT_CAP = 4000;

export const metricsQueryInput = z.object({
  template: z.enum(TEMPLATE_NAMES).describe('Name of a ready-made metric query'),
  queue: z.string().optional().describe('Queue name, for the queue_* templates'),
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

export const productStatsInput = z.object({
  metric: z.enum(SERIES_METRICS).describe('new_users, actions or active_users'),
  window: z
    .string()
    .optional()
    .describe('How far back to look, such as 3d or 7d (at most 7d). Default 7d'),
});

export const recentChangesInput = z.object({
  window: z
    .string()
    .optional()
    .describe('How far back to look, such as 24h or 7d (at most 7d). Default 24h'),
});

const noInput = z.object({});

export const buildInvestigationTools = (executors: InvestigationExecutors): Tool[] => [
  defineTool({
    name: InvestigationTool.METRICS_QUERY,
    description: `Runs one ready-made Prometheus query. Only these templates exist. ${templateCatalog}`,
    inputSchema: metricsQueryInput,
    readOnly: true,
    maxOutputChars: METRICS_OUTPUT_CAP,
    handler: (input) => executors.metricsQuery(input),
  }),
  defineTool({
    name: InvestigationTool.PRODUCT_STATS,
    description:
      'Daily product numbers by Kyiv day: new_users (signups), actions (watch states, ratings, reviews, saves, subscriptions, imports), active_users.',
    inputSchema: productStatsInput,
    readOnly: true,
    maxOutputChars: PRODUCT_OUTPUT_CAP,
    handler: (input) => executors.productStats(input),
  }),
  defineTool({
    name: InvestigationTool.DIGEST_SNAPSHOT,
    description:
      'Today’s overall picture: the level (ok, note, action) of every block, the advice items and their numbers with last week for comparison, and which sources answered.',
    inputSchema: noInput,
    readOnly: true,
    maxOutputChars: SNAPSHOT_OUTPUT_CAP,
    handler: () => executors.digestSnapshot(),
  }),
  defineTool({
    name: InvestigationTool.RECENT_CHANGES,
    description:
      'Pull requests merged into main and development and recent deploys, with merge and deploy times in Kyiv time. Titles and numbers only.',
    inputSchema: recentChangesInput,
    readOnly: true,
    maxOutputChars: CHANGES_OUTPUT_CAP,
    handler: (input) => executors.recentChanges(input),
  }),
];
