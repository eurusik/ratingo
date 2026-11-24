import type { Tool } from '../tools/define-tool';
import type { ToolSource } from '../tools/tool-source.port';
import { BridgedMcpTool } from './mcp-tool-bridge';
import type { McpBridgeDependencies } from './mcp-tool-bridge';
import type { McpSession } from './mcp-session';
import { McpCallOutcome, McpServerEvent } from './mcp-telemetry.port';
import type { McpServerEventRecord } from './mcp-telemetry.port';
import { McpTimeoutError } from './mcp-transport.port';
import type { McpRemoteTool } from './mcp-transport.port';

const LIST_TOOLS_LABEL = 'tools/list';

const isReadOnly = (remote: McpRemoteTool): boolean =>
  remote.readOnlyHint !== false && remote.destructiveHint !== true;

export class McpToolSource implements ToolSource {
  private readonly reportedListings = new WeakSet<readonly McpRemoteTool[]>();

  constructor(
    private readonly sessions: readonly McpSession[],
    private readonly deps: McpBridgeDependencies,
  ) {}

  async listTools(): Promise<readonly Tool[]> {
    const perServer = await Promise.all(this.sessions.map((session) => this.bridgeServer(session)));
    return perServer.flat();
  }

  private async bridgeServer(session: McpSession): Promise<Tool[]> {
    const remote = await this.remoteTools(session);
    if (remote === undefined) {
      return [];
    }
    const byName = new Map(remote.map((tool) => [tool.name, tool]));
    const mismatches: McpServerEventRecord[] = [];
    const tools = Object.entries(session.definition.policy.tools).flatMap(([toolName, rule]) => {
      const found = byName.get(toolName);
      if (found === undefined || !isReadOnly(found)) {
        const event =
          found === undefined ? McpServerEvent.TOOL_MISSING : McpServerEvent.TOOL_NOT_READ_ONLY;
        mismatches.push({ server: session.name, event, detail: toolName });
        return [];
      }
      return [new BridgedMcpTool(session, found, rule, this.deps)];
    });
    this.reportFirstTime(remote, mismatches);
    return tools;
  }

  private reportFirstTime(
    listing: readonly McpRemoteTool[],
    mismatches: readonly McpServerEventRecord[],
  ): void {
    if (this.reportedListings.has(listing)) {
      return;
    }
    this.reportedListings.add(listing);
    mismatches.forEach((record) => this.deps.telemetry.serverEvent(record));
  }

  private async remoteTools(session: McpSession): Promise<McpRemoteTool[] | undefined> {
    const startedMs = this.deps.clock.nowMs();
    try {
      return await session.tools();
    } catch (error) {
      this.deps.telemetry.callFinished({
        server: session.name,
        tool: LIST_TOOLS_LABEL,
        outcome:
          error instanceof McpTimeoutError ? McpCallOutcome.TIMEOUT : McpCallOutcome.UNAVAILABLE,
        durationMs: this.deps.clock.nowMs() - startedMs,
      });
      return undefined;
    }
  }
}
