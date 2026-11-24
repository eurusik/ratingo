import type { ClockPort } from '../clock/clock.port';
import type { ToolSource } from '../tools/tool-source.port';
import type { McpEnvValues, McpServerRegistry } from './mcp-server.registry';
import { McpSession } from './mcp-session';
import { toBridgedToolName } from './mcp-tool-name';
import { McpServerEvent } from './mcp-telemetry.port';
import type { McpTelemetry } from './mcp-telemetry.port';
import type { McpTransport } from './mcp-transport.port';
import { McpToolSource } from './mcp.tool-source';

export interface McpGatewayConfig {
  registry: McpServerRegistry;
  servers: readonly string[];
  env: McpEnvValues;
  transport: McpTransport;
  clock: ClockPort;
  telemetry: McpTelemetry;
}

export class McpGateway {
  private readonly sessions: readonly McpSession[];
  private readonly source: McpToolSource;
  private readonly expectedNames: readonly string[];

  constructor(config: McpGatewayConfig) {
    const resolved = config.registry.resolve(config.servers, config.env);
    for (const server of resolved.unconfigured) {
      config.telemetry.serverEvent({
        server: server.definition.name,
        event: McpServerEvent.UNCONFIGURED,
        detail: `missing: ${server.missingKeys.join(', ')}`,
      });
    }
    const deps = { transport: config.transport, clock: config.clock, telemetry: config.telemetry };
    this.sessions = resolved.configured.map((server) => new McpSession(server, deps));
    this.source = new McpToolSource(this.sessions, deps);
    this.expectedNames = [...resolved.configured, ...resolved.unconfigured].flatMap(
      ({ definition }) =>
        Object.keys(definition.policy.tools).map((tool) =>
          toBridgedToolName({ server: definition.name, tool }),
        ),
    );
  }

  expectedToolNames(): readonly string[] {
    return this.expectedNames;
  }

  get configuredServers(): string[] {
    return this.sessions.map((session) => session.name);
  }

  toolSource(): ToolSource {
    return this.source;
  }

  async close(): Promise<void> {
    await Promise.allSettled(this.sessions.map((session) => session.close()));
  }
}
