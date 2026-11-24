import { McpTransportKind } from '../mcp-server.definition';
import type { McpServerDefinition } from '../mcp-server.definition';
import { McpConstraintKind } from '../mcp-tool-policy.types';
import type { McpToolRule } from '../mcp-tool-policy.types';

export const GOOGLE_ANALYTICS_MCP_VERSION = '1.1.0';
export const GOOGLE_ANALYTICS_MCP_HOME = `/opt/analytics-mcp-${GOOGLE_ANALYTICS_MCP_VERSION}`;
export const GoogleAnalyticsMcpKey = {
  CREDENTIALS_FILE: 'GOOGLE_APPLICATION_CREDENTIALS',
  PROPERTY_ID: 'GA_PROPERTY_ID',
} as const;

const PROPERTY_ID_ARGUMENT = 'property_id';
const REPORT_LIMIT = { kind: McpConstraintKind.NUMBER, min: 1, max: 50, default: 20 } as const;
const FILTER_ARGUMENTS = ['dimension_filter', 'metric_filter'] as const;
const pinnedProperty = { [PROPERTY_ID_ARGUMENT]: GoogleAnalyticsMcpKey.PROPERTY_ID };

const runReport: McpToolRule = {
  description:
    'Google Analytics 4 report for ratingo.top. dimensions and metrics are GA4 API names, such as date, sessionDefaultChannelGroup, sessionSource, pagePath, deviceCategory, country, newVsReturning, eventName; activeUsers, newUsers, sessions, screenPageViews, engagementRate, eventCount. date_ranges: one or two {start_date, end_date, name} with YYYY-MM-DD, today, yesterday or NdaysAgo, at most 90 days back; two ranges compare periods. Filter on eventName with dimension_filter to count one event. Keep reports small.',
  exposedArguments: [
    'date_ranges',
    'dimensions',
    'metrics',
    ...FILTER_ARGUMENTS,
    'order_bys',
    'limit',
  ],
  pinnedFromSettings: pinnedProperty,
  pinnedArguments: { return_property_quota: false },
  constraints: {
    date_ranges: {
      kind: McpConstraintKind.DATE_RANGES,
      maxRanges: 2,
      maxSpanDays: 90,
      maxLookbackDays: 90,
    },
    dimensions: { kind: McpConstraintKind.MAX_ITEMS, max: 4 },
    metrics: { kind: McpConstraintKind.MAX_ITEMS, max: 5 },
    order_bys: { kind: McpConstraintKind.MAX_ITEMS, max: 3 },
    limit: REPORT_LIMIT,
  },
};

const runRealtimeReport: McpToolRule = {
  description:
    'Google Analytics 4 activity on ratingo.top in the last 30 minutes. Realtime metrics: activeUsers, screenPageViews, eventCount. Realtime dimensions: country, deviceCategory, unifiedScreenName, eventName, minutesAgo.',
  exposedArguments: [
    'dimensions',
    'metrics',
    ...FILTER_ARGUMENTS,
    'order_bys',
    'limit',
    'minute_ranges',
  ],
  pinnedFromSettings: pinnedProperty,
  pinnedArguments: { return_property_quota: false },
  constraints: {
    dimensions: { kind: McpConstraintKind.MAX_ITEMS, max: 3 },
    metrics: { kind: McpConstraintKind.MAX_ITEMS, max: 4 },
    order_bys: { kind: McpConstraintKind.MAX_ITEMS, max: 3 },
    minute_ranges: { kind: McpConstraintKind.MAX_ITEMS, max: 2 },
    limit: REPORT_LIMIT,
  },
};

const customDefinitions: McpToolRule = {
  description:
    'Custom GA4 dimensions and metrics defined for ratingo.top, such as custom event parameters. Call it before a report that needs a custom name.',
  exposedArguments: [],
  pinnedFromSettings: pinnedProperty,
};

export const GOOGLE_ANALYTICS_MCP_SERVER: McpServerDefinition = {
  name: 'google-analytics',
  pinnedVersion: GOOGLE_ANALYTICS_MCP_VERSION,
  launch: {
    kind: McpTransportKind.STDIO,
    command: `${GOOGLE_ANALYTICS_MCP_HOME}/bin/analytics-mcp`,
    args: [],
  },
  env: {
    constants: { HOME: '/tmp', PYTHONDONTWRITEBYTECODE: '1', PYTHONUNBUFFERED: '1' },
    required: [GoogleAnalyticsMcpKey.CREDENTIALS_FILE],
  },
  settings: [GoogleAnalyticsMcpKey.PROPERTY_ID],
  timeouts: { startMs: 45_000, callMs: 25_000, idleTtlMs: 900_000, restartCooldownMs: 60_000 },
  maxOutputChars: 6_000,
  policy: {
    tools: {
      run_report: runReport,
      run_realtime_report: runRealtimeReport,
      get_custom_dimensions_and_metrics: customDefinitions,
    },
  },
};
