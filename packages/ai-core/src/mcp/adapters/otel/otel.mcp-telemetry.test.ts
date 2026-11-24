import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { AI_METRIC_NAMES } from '../../../telemetry/ai-metric-names';
import { McpCallOutcome, McpServerEvent } from '../../mcp-telemetry.port';
import { MCP_SERVER_EVENT_LOG, OtelMcpTelemetry } from './otel.mcp-telemetry';

class TestMetricReader extends MetricReader {
  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}

interface Point {
  value: unknown;
  attributes: Record<string, unknown>;
}

describe('OtelMcpTelemetry', () => {
  let reader: TestMetricReader;
  let telemetry: OtelMcpTelemetry;
  const logger = { info: jest.fn() };

  const points = async (metricName: string): Promise<Point[]> => {
    const { resourceMetrics } = await reader.collect();
    const metric = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((candidate) => candidate.descriptor.name === metricName);
    return (metric?.dataPoints ?? []) as unknown as Point[];
  };

  beforeEach(() => {
    logger.info.mockClear();
    reader = new TestMetricReader();
    telemetry = new OtelMcpTelemetry(
      new MeterProvider({ readers: [reader] }).getMeter('test'),
      logger,
    );
  });

  it('counts calls and records their duration by server, tool and outcome', async () => {
    telemetry.callFinished({
      server: 'ga',
      tool: 'run_report',
      outcome: McpCallOutcome.OK,
      durationMs: 1_500,
    });

    const [calls] = await points(AI_METRIC_NAMES.MCP_CALLS);
    const [duration] = await points(AI_METRIC_NAMES.MCP_CALL_DURATION);
    const attributes = { server: 'ga', tool: 'run_report', outcome: 'ok' };
    expect(calls).toMatchObject({ value: 1, attributes });
    expect(duration).toMatchObject({ value: { sum: 1.5, count: 1 }, attributes });
  });

  it('counts server events and logs them with a redacted detail', async () => {
    telemetry.serverEvent({
      server: 'ga',
      event: McpServerEvent.START_FAILED,
      detail: 'boom token=supersecretvalue',
    });

    const [events] = await points(AI_METRIC_NAMES.MCP_SERVER_EVENTS);
    expect(events).toMatchObject({ value: 1, attributes: { server: 'ga', event: 'start_failed' } });
    expect(logger.info).toHaveBeenCalledWith(MCP_SERVER_EVENT_LOG, {
      server: 'ga',
      event: 'start_failed',
      detail: 'boom [REDACTED]',
    });
  });
});
