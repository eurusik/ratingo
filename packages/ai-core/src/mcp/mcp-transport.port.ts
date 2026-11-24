import type { JsonSchema } from '../model/model.types';

export interface McpLaunchSpec {
  server: string;
  command: string;
  args: readonly string[];
  env: Readonly<Record<string, string>>;
  startTimeoutMs: number;
}

export interface McpRemoteTool {
  name: string;
  inputSchema: JsonSchema;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
}

export interface McpToolListing {
  tools: McpRemoteTool[];
  truncated: boolean;
}

export interface McpToolOutput {
  isError: boolean;
  text: string;
}

export interface McpCallOptions {
  timeoutMs: number;
}

export interface McpConnection {
  readonly isOpen: boolean;
  listTools(options: McpCallOptions): Promise<McpToolListing>;
  callTool(
    name: string,
    args: Record<string, unknown>,
    options: McpCallOptions,
  ): Promise<McpToolOutput>;
  onClose(listener: () => void): void;
  close(): Promise<void>;
}

export interface McpTransport {
  connect(spec: McpLaunchSpec): Promise<McpConnection>;
}

export const MCP_TRANSPORT_PORT = Symbol('MCP_TRANSPORT_PORT');

export class McpTimeoutError extends Error {
  constructor(server: string, operation: string, timeoutMs: number) {
    super(`MCP server "${server}" did not answer ${operation} within ${timeoutMs} ms`);
    this.name = 'McpTimeoutError';
  }
}

export class McpConnectionClosedError extends Error {
  constructor(server: string) {
    super(`MCP server "${server}" closed the connection`);
    this.name = 'McpConnectionClosedError';
  }
}
