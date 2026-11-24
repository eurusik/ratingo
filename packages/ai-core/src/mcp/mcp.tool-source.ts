import type { Tool } from '../tools/define-tool';
import type { ToolSource } from '../tools/tool-source.port';
import { BridgedMcpTool } from './mcp-tool-bridge';
import { hiddenRequiredArguments, undeclaredPolicyArguments } from './mcp-tool-policy';
import type { McpToolRule } from './mcp-tool-policy.types';
import type { McpBridgeDependencies } from './mcp-tool-bridge';
import type { McpSession } from './mcp-session';
import { McpCallOutcome, McpServerEvent } from './mcp-telemetry.port';
import type { McpServerEventRecord } from './mcp-telemetry.port';
import { McpTimeoutError } from './mcp-transport.port';
import type { McpRemoteTool } from './mcp-transport.port';

const LIST_TOOLS_LABEL = 'tools/list';

const isReadOnly = (remote: McpRemoteTool): boolean =>
  remote.readOnlyHint !== false && remote.destructiveHint !== true;

function mismatchesOf(
  server: string,
  toolName: string,
  rule: McpToolRule,
  found: McpRemoteTool | undefined,
): McpServerEventRecord[] {
  if (found === undefined) {
    return [{ server, event: McpServerEvent.TOOL_MISSING, detail: toolName }];
  }
  if (!isReadOnly(found)) {
    return [{ server, event: McpServerEvent.TOOL_NOT_READ_ONLY, detail: toolName }];
  }
  const record = (event: McpServerEvent) => (argument: string) => ({
    server,
    event,
    detail: `${toolName}.${argument}`,
  });
  return [
    ...undeclaredPolicyArguments(rule, found.inputSchema).map(
      record(McpServerEvent.POLICY_ARGUMENT_UNDECLARED),
    ),
    ...hiddenRequiredArguments(rule, found.inputSchema).map(
      record(McpServerEvent.REQUIRED_ARGUMENT_HIDDEN),
    ),
  ];
}

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
      mismatches.push(...mismatchesOf(session.name, toolName, rule, found));
      return found === undefined || !isReadOnly(found)
        ? []
        : [new BridgedMcpTool(session, found, rule, this.deps)];
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
