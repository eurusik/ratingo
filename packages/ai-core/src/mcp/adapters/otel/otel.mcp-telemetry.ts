import type { Counter, Histogram, Meter } from '@opentelemetry/api';
import type { RunLogger } from '../../../runs/run-logger.port';
import {
  AI_METRIC_ATTRIBUTES,
  AI_METRIC_NAMES,
  AI_METRIC_UNITS,
} from '../../../telemetry/ai-metric-names';
import { redactSecrets } from '../../../tools/redact';
import type { McpCallRecord, McpServerEventRecord, McpTelemetry } from '../../mcp-telemetry.port';

export const MCP_SERVER_EVENT_LOG = 'ai.mcp.server_event';
const MS_PER_SECOND = 1000;
const DURATION_BUCKETS_SECONDS = [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 60];
const MAX_DETAIL_CHARS = 500;

export class OtelMcpTelemetry implements McpTelemetry {
  private readonly calls: Counter;
  private readonly durations: Histogram;
  private readonly events: Counter;

  constructor(
    meter: Meter,
    private readonly logger: RunLogger,
  ) {
    this.calls = meter.createCounter(AI_METRIC_NAMES.MCP_CALLS);
    this.durations = meter.createHistogram(AI_METRIC_NAMES.MCP_CALL_DURATION, {
      unit: AI_METRIC_UNITS.DURATION,
      advice: { explicitBucketBoundaries: DURATION_BUCKETS_SECONDS },
    });
    this.events = meter.createCounter(AI_METRIC_NAMES.MCP_SERVER_EVENTS);
  }

  callFinished(record: McpCallRecord): void {
    const attributes = {
      [AI_METRIC_ATTRIBUTES.SERVER]: record.server,
      [AI_METRIC_ATTRIBUTES.TOOL]: record.tool,
      [AI_METRIC_ATTRIBUTES.OUTCOME]: record.outcome,
    };
    this.calls.add(1, attributes);
    this.durations.record(record.durationMs / MS_PER_SECOND, attributes);
  }

  serverEvent(record: McpServerEventRecord): void {
    this.events.add(1, {
      [AI_METRIC_ATTRIBUTES.SERVER]: record.server,
      [AI_METRIC_ATTRIBUTES.EVENT]: record.event,
    });
    this.logger.info(MCP_SERVER_EVENT_LOG, {
      server: record.server,
      event: record.event,
      detail:
        record.detail === undefined
          ? undefined
          : redactSecrets(record.detail).slice(0, MAX_DETAIL_CHARS),
    });
  }
}
