import type { McpRefusal } from './mcp-tool-policy.types';

export class McpCallRefusedError extends Error {
  constructor(
    readonly tool: string,
    readonly refusal: McpRefusal,
  ) {
    super(JSON.stringify({ status: 'refused', tool, ...refusal }));
    this.name = 'McpCallRefusedError';
  }
}

export class McpToolUnavailableError extends Error {
  constructor(
    readonly tool: string,
    readonly server: string,
    readonly reason: string,
  ) {
    super(
      JSON.stringify({
        status: 'unavailable',
        tool,
        reason,
        message: `The "${server}" data source is unavailable right now. Answer without it and say that this data could not be fetched.`,
      }),
    );
    this.name = 'McpToolUnavailableError';
  }
}

export class McpToolFailedError extends Error {
  constructor(
    readonly tool: string,
    wrappedOutput: string,
  ) {
    super(wrappedOutput);
    this.name = 'McpToolFailedError';
  }
}

export const McpUnavailableReason = {
  START_FAILED: 'start_failed',
  COOLING_DOWN: 'cooling_down',
  CRASHED: 'crashed',
  SHUT_DOWN: 'shut_down',
} as const;
export type McpUnavailableReason = (typeof McpUnavailableReason)[keyof typeof McpUnavailableReason];

export class McpServerUnavailableError extends Error {
  constructor(
    readonly server: string,
    readonly reason: McpUnavailableReason,
  ) {
    super(`MCP server "${server}" is unavailable (${reason})`);
    this.name = 'McpServerUnavailableError';
  }
}
