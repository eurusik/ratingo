import * as path from 'node:path';
import { McpConstraintKind } from '../mcp-tool-policy.types';
import { McpTransportKind } from '../mcp-server.definition';
import type { McpServerDefinition, McpServerTimeouts } from '../mcp-server.definition';
import type { McpCallRecord, McpServerEventRecord, McpTelemetry } from '../mcp-telemetry.port';

const FAKE_SERVER_SCRIPT = path.join(__dirname, 'fake-mcp-server.cjs');
export const FAKE_PINNED_PROPERTY = '123';
export const FAKE_OUTPUT_CAP = 100;

const FAST_TIMEOUTS: McpServerTimeouts = {
  startMs: 15_000,
  callMs: 1_500,
  idleTtlMs: 60_000,
  restartCooldownMs: 1,
};

export function fakeServerDefinition(
  timeouts: Partial<McpServerTimeouts> = {},
): McpServerDefinition {
  return {
    name: 'fake',
    pinnedVersion: '1.0.0',
    launch: {
      kind: McpTransportKind.STDIO,
      command: process.execPath,
      args: [FAKE_SERVER_SCRIPT, '--fixture-version=1.0.0'],
    },
    env: {
      constants: { FAKE_MODE: 'test' },
      required: ['FAKE_TOKEN'],
      optional: ['FAKE_MCP_FAIL_START'],
    },
    timeouts: { ...FAST_TIMEOUTS, ...timeouts },
    policy: {
      tools: {
        echo: { description: 'Echo text back.' },
        report: {
          description: 'Run a report.',
          pinnedArguments: { property_id: FAKE_PINNED_PROPERTY },
          constraints: {
            limit: { kind: McpConstraintKind.NUMBER, min: 1, max: 50, default: 10 },
            dimensions: { kind: McpConstraintKind.ONE_OF, values: ['date', 'country'] },
            date_ranges: {
              kind: McpConstraintKind.DATE_RANGES,
              maxRanges: 2,
              maxSpanDays: 31,
              maxLookbackDays: 90,
            },
          },
        },
        slow: { description: 'Answer slowly.' },
        crash: { description: 'Crash.' },
        huge: { description: 'Long output.', maxOutputChars: FAKE_OUTPUT_CAP },
        inject: { description: 'Injection attempt.' },
        fail: { description: 'Tool error.' },
        env_keys: { description: 'Environment names.' },
        pid: { description: 'Process id.' },
        delete_everything: { description: 'A write tool that must never be bridged.' },
        missing_tool: { description: 'Listed in policy but absent on the server.' },
      },
    },
  };
}

export class RecordingMcpTelemetry implements McpTelemetry {
  readonly calls: McpCallRecord[] = [];
  readonly events: McpServerEventRecord[] = [];

  callFinished(record: McpCallRecord): void {
    this.calls.push(record);
  }

  serverEvent(record: McpServerEventRecord): void {
    this.events.push(record);
  }

  eventNames(): string[] {
    return this.events.map((record) => record.event);
  }
}
