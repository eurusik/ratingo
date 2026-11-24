import { Client, ProtocolError, SdkError, SdkErrorCode } from '@modelcontextprotocol/client';
import type { CallToolResult, Tool as SdkTool } from '@modelcontextprotocol/client';
import { redactSecrets } from '../../../tools/redact';
import { McpConnectionClosedError, McpTimeoutError } from '../../mcp-transport.port';
import type {
  McpCallOptions,
  McpConnection,
  McpLaunchSpec,
  McpRemoteTool,
  McpToolOutput,
  McpTransport,
} from '../../mcp-transport.port';
import { ExplicitEnvStdioTransport, StdioProcessError } from './explicit-env.stdio-transport';

const MCP_CLIENT_INFO = { name: 'ratingo-ai-core', version: '0.1.0' } as const;
const NON_TEXT_PLACEHOLDER = '[non-text content omitted]';
const MAX_TOOL_PAGES = 10;

function remoteToolOf(tool: SdkTool): McpRemoteTool {
  return {
    name: tool.name,
    inputSchema: { ...tool.inputSchema },
    readOnlyHint: tool.annotations?.readOnlyHint,
    destructiveHint: tool.annotations?.destructiveHint,
  };
}

function textOfResult(result: CallToolResult): string {
  const parts = result.content.map((block) =>
    block.type === 'text' ? block.text : NON_TEXT_PLACEHOLDER,
  );
  if (parts.length === 0 && result.structuredContent !== undefined) {
    return JSON.stringify(result.structuredContent);
  }
  return parts.join('\n');
}

class SdkMcpConnection implements McpConnection {
  private open = true;
  private readonly closeListeners: Array<() => void> = [];

  constructor(
    private readonly server: string,
    private readonly client: Client,
    transport: ExplicitEnvStdioTransport,
  ) {
    transport.onclose = this.chainClose(transport.onclose);
  }

  get isOpen(): boolean {
    return this.open;
  }

  async listTools(options: McpCallOptions): Promise<McpRemoteTool[]> {
    const tools: McpRemoteTool[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_TOOL_PAGES; page += 1) {
      const result = await this.request('tools/list', options.timeoutMs, () =>
        this.client.listTools(cursor === undefined ? undefined : { cursor }, {
          timeout: options.timeoutMs,
        }),
      );
      tools.push(...result.tools.map(remoteToolOf));
      cursor = result.nextCursor;
      if (cursor === undefined) {
        break;
      }
    }
    return tools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
    options: McpCallOptions,
  ): Promise<McpToolOutput> {
    try {
      const result = await this.request(name, options.timeoutMs, () =>
        this.client.callTool({ name, arguments: args }, { timeout: options.timeoutMs }),
      );
      return { isError: result.isError === true, text: textOfResult(result) };
    } catch (error) {
      if (error instanceof ProtocolError) {
        return { isError: true, text: error.message };
      }
      throw error;
    }
  }

  onClose(listener: () => void): void {
    this.closeListeners.push(listener);
  }

  async close(): Promise<void> {
    this.open = false;
    await this.client.close();
  }

  private chainClose(previous: (() => void) | undefined): () => void {
    return () => {
      previous?.();
      this.open = false;
      for (const listener of this.closeListeners) {
        listener();
      }
    };
  }

  private async request<T>(
    operation: string,
    timeoutMs: number,
    send: () => Promise<T>,
  ): Promise<T> {
    if (!this.open) {
      throw new McpConnectionClosedError(this.server);
    }
    try {
      return await send();
    } catch (error) {
      if (error instanceof SdkError && error.code === SdkErrorCode.RequestTimeout) {
        throw new McpTimeoutError(this.server, operation, timeoutMs);
      }
      if (
        !this.open ||
        (error instanceof SdkError && error.code === SdkErrorCode.ConnectionClosed)
      ) {
        throw new McpConnectionClosedError(this.server);
      }
      throw error;
    }
  }
}

export class StdioMcpTransport implements McpTransport {
  async connect(spec: McpLaunchSpec): Promise<McpConnection> {
    const transport = new ExplicitEnvStdioTransport({
      command: spec.command,
      args: spec.args,
      env: spec.env,
    });
    const client = new Client(MCP_CLIENT_INFO);
    try {
      await client.connect(transport, { timeout: spec.startTimeoutMs });
    } catch (error) {
      await transport.close().catch(() => undefined);
      const stderr = redactSecrets(transport.stderrTail).trim();
      const reason = error instanceof Error ? error.message : 'unknown error';
      throw new StdioProcessError(stderr.length > 0 ? `${reason}; stderr: ${stderr}` : reason);
    }
    return new SdkMcpConnection(spec.server, client, transport);
  }
}
