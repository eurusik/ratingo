export const McpCallOutcome = {
  OK: 'ok',
  TOOL_ERROR: 'tool_error',
  REFUSED: 'refused',
  TIMEOUT: 'timeout',
  UNAVAILABLE: 'unavailable',
} as const;
export type McpCallOutcome = (typeof McpCallOutcome)[keyof typeof McpCallOutcome];

export const McpServerEvent = {
  STARTED: 'started',
  START_FAILED: 'start_failed',
  CRASHED: 'crashed',
  RESTARTED: 'restarted',
  IDLE_STOPPED: 'idle_stopped',
  UNCONFIGURED: 'unconfigured',
  TOOL_MISSING: 'tool_missing',
  TOOL_NOT_READ_ONLY: 'tool_not_read_only',
  TOOL_LIST_TRUNCATED: 'tool_list_truncated',
  POLICY_ARGUMENT_UNDECLARED: 'policy_argument_undeclared',
  RECYCLED_AFTER_TIMEOUT: 'recycled_after_timeout',
} as const;
export type McpServerEvent = (typeof McpServerEvent)[keyof typeof McpServerEvent];

export interface McpCallRecord {
  server: string;
  tool: string;
  outcome: McpCallOutcome;
  durationMs: number;
}

export interface McpServerEventRecord {
  server: string;
  event: McpServerEvent;
  detail?: string;
}

export interface McpTelemetry {
  callFinished(record: McpCallRecord): void;
  serverEvent(record: McpServerEventRecord): void;
}

export const MCP_TELEMETRY_PORT = Symbol('MCP_TELEMETRY_PORT');
