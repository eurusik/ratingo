import {
  McpTimeoutError,
  type JsonSchema,
  type McpConnection,
  type McpRemoteTool,
  type McpTransport,
} from '@ratingo/ai-core';

import type { Fixture } from './eval-case';
import { GA_CUSTOM_DEFINITIONS } from './google-analytics.dataset';
import {
  simulateRunRealtimeReport,
  simulateRunReport,
  type GaSimulation,
} from './google-analytics.simulator';

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

type Json = Record<string, unknown>;

const toolError = (tool: string, message: string) => ({
  isError: true,
  text: JSON.stringify({ error: `Failed to execute tool '${tool}': ${message}` }),
});

const answer = (tool: string, result: GaSimulation) =>
  result.ok ? { isError: false, text: JSON.stringify(result.body) } : toolError(tool, result.error);

const SIMULATED: Readonly<Record<string, (args: Json) => { isError: boolean; text: string }>> = {
  run_report: (args) => answer('run_report', simulateRunReport(args)),
  run_realtime_report: (args) => answer('run_realtime_report', simulateRunRealtimeReport(args)),
  get_custom_dimensions_and_metrics: () => ({
    isError: false,
    text: JSON.stringify(GA_CUSTOM_DEFINITIONS),
  }),
};

export class SimulatedGaConnection implements McpConnection {
  readonly isOpen = true;
  readonly received: { tool: string; args: Json }[] = [];

  constructor(private readonly fixtures: readonly Fixture[]) {}

  async listTools() {
    return { tools: [...GA_TOOL_LISTING], truncated: false };
  }

  async callTool(name: string, args: Json) {
    this.received.push({ tool: name, args });
    const outage = this.fixtures.find((entry) => entry.tool === `${GA_TOOL_PREFIX}${name}`);
    if (outage?.error === GA_UNAVAILABLE) {
      throw new McpTimeoutError(GA_SERVER, name, 1);
    }
    const run = SIMULATED[name];
    return run === undefined ? toolError(name, '404 Unknown tool') : run(args);
  }

  onClose(): void {}

  async close(): Promise<void> {}
}

export const simulatedGaTransport = (connection: SimulatedGaConnection): McpTransport => ({
  connect: async () => connection,
});
