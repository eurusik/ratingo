import type { ClockPort } from '../clock/clock.port';
import type { ToolSource } from '../tools/tool-source.port';
import type { McpEnvValues, McpServerRegistry } from './mcp-server.registry';
import { McpSession } from './mcp-session';
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

  constructor(config: McpGatewayConfig) {
    const resolved = config.registry.resolve(config.servers, config.env);
    for (const server of resolved.unconfigured) {
      config.telemetry.serverEvent({
        server: server.name,
        event: McpServerEvent.UNCONFIGURED,
        detail: `missing env: ${server.missingEnv.join(', ')}`,
      });
    }
    const deps = { transport: config.transport, clock: config.clock, telemetry: config.telemetry };
    this.sessions = resolved.configured.map((server) => new McpSession(server, deps));
    this.source = new McpToolSource(this.sessions, deps);
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
