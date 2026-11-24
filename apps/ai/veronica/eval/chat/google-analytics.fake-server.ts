import {
  McpTimeoutError,
  type JsonSchema,
  type McpConnection,
  type McpRemoteTool,
  type McpTransport,
} from '@ratingo/ai-core';

import type { Fixture } from './eval-case';

export const GA_SERVER = 'google-analytics';
const GA_TOOL_PREFIX = `${GA_SERVER}__`;
export const GA_UNAVAILABLE = 'unavailable';

const propertyId = { anyOf: [{ type: 'integer' }, { type: 'string' }], title: 'Property Id' };
const filter = { additionalProperties: true, default: null, type: 'object' };
const objectList = {
  default: null,
  items: { additionalProperties: true, type: 'object' },
  type: 'array',
};
const stringList = { items: { type: 'string' }, type: 'array' };
const optionalInteger = { default: null, type: 'integer' };

const reportProperties: Record<string, JsonSchema> = {
  property_id: propertyId,
  dimensions: stringList,
  metrics: stringList,
  dimension_filter: filter,
  metric_filter: filter,
  order_bys: objectList,
  limit: optionalInteger,
  offset: optionalInteger,
  return_property_quota: { default: false, type: 'boolean' },
};

const GA_TOOL_LISTING: readonly McpRemoteTool[] = [
  {
    name: 'run_report',
    readOnlyHint: true,
    destructiveHint: false,
    inputSchema: {
      type: 'object',
      properties: {
        ...reportProperties,
        date_ranges: { items: { additionalProperties: true, type: 'object' }, type: 'array' },
        currency_code: { default: null, type: 'string' },
      },
      required: ['property_id', 'date_ranges', 'dimensions', 'metrics'],
    },
  },
  {
    name: 'run_realtime_report',
    readOnlyHint: true,
    destructiveHint: false,
    inputSchema: {
      type: 'object',
      properties: { ...reportProperties, minute_ranges: objectList },
      required: ['property_id', 'dimensions', 'metrics'],
    },
  },
  {
    name: 'get_custom_dimensions_and_metrics',
    readOnlyHint: true,
    destructiveHint: false,
    inputSchema: {
      type: 'object',
      properties: { property_id: propertyId },
      required: ['property_id'],
    },
  },
  {
    name: 'get_account_summaries',
    readOnlyHint: true,
    inputSchema: { type: 'object', properties: {} },
  },
];

const containsAll = (actual: unknown, expected: unknown): boolean =>
  Array.isArray(expected)
    ? Array.isArray(actual) && expected.every((item) => actual.includes(item))
    : actual === expected;

const matchesArguments = (fixture: Fixture, args: Record<string, unknown>): boolean =>
  Object.entries(fixture.match ?? {}).every(([key, value]) => containsAll(args[key], value));

export class FixtureGaConnection implements McpConnection {
  readonly isOpen = true;
  readonly received: { tool: string; args: Record<string, unknown> }[] = [];

  constructor(private readonly fixtures: readonly Fixture[]) {}

  async listTools() {
    return { tools: [...GA_TOOL_LISTING], truncated: false };
  }

  async callTool(name: string, args: Record<string, unknown>) {
    this.received.push({ tool: name, args });
    const fixture = this.fixtures.find(
      (entry) => entry.tool === `${GA_TOOL_PREFIX}${name}` && matchesArguments(entry, args),
    );
    if (fixture?.error === GA_UNAVAILABLE) {
      throw new McpTimeoutError(GA_SERVER, name, 1);
    }
    if (fixture === undefined || fixture.error !== undefined) {
      return { isError: true, text: fixture?.error ?? `No GA fixture for ${name}` };
    }
    return { isError: false, text: JSON.stringify(fixture.response) };
  }

  onClose(): void {}

  async close(): Promise<void> {}
}

export const fixtureGaTransport = (connection: FixtureGaConnection): McpTransport => ({
  connect: async () => connection,
});

type Row = readonly [readonly string[], readonly string[]];

const rowsOf = (rows: readonly Row[]) =>
  rows.map(([dimensions, metrics]) => ({
    dimension_values: dimensions.map((value) => ({ value })),
    metric_values: metrics.map((value) => ({ value })),
  }));

export const gaReport = (
  dimensions: readonly string[],
  metrics: readonly string[],
  rows: readonly Row[],
) => ({
  dimension_headers: dimensions.map((name) => ({ name })),
  metric_headers: metrics.map((name) => ({ name, type_: 'TYPE_INTEGER' })),
  rows: rowsOf(rows),
  row_count: rows.length,
  metadata: { currency_code: 'USD', time_zone: 'Europe/Kiev' },
  kind: 'analyticsData#runReport',
});

export const gaRealtimeReport = (
  dimensions: readonly string[],
  metrics: readonly string[],
  rows: readonly Row[],
) => ({
  dimension_headers: dimensions.map((name) => ({ name })),
  metric_headers: metrics.map((name) => ({ name, type_: 'TYPE_INTEGER' })),
  rows: rowsOf(rows),
  row_count: rows.length,
  kind: 'analyticsData#runRealtimeReport',
});
