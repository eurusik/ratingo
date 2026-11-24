import type { ClockPort } from '../clock/clock.port';
import { describeError } from '../shared/describe-error';
import type { McpServerDefinition } from './mcp-server.definition';
import type { ConfiguredMcpServer } from './mcp-server.registry';
import { McpServerEvent } from './mcp-telemetry.port';
import type { McpTelemetry } from './mcp-telemetry.port';
import { McpServerUnavailableError, McpUnavailableReason } from './mcp-call.errors';
import { McpConnectionClosedError } from './mcp-transport.port';
import type {
  McpConnection,
  McpRemoteTool,
  McpToolOutput,
  McpTransport,
} from './mcp-transport.port';

export interface McpSessionDependencies {
  transport: McpTransport;
  clock: ClockPort;
  telemetry: McpTelemetry;
}

interface LiveConnection {
  connection: McpConnection;
  tools?: Promise<McpRemoteTool[]>;
}

export class McpSession {
  private live: LiveConnection | undefined;
  private connecting: Promise<LiveConnection> | undefined;
  private inFlight = 0;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;
  private coolingDownUntilMs = 0;
  private crashed = false;
  private shutDown = false;

  constructor(
    private readonly server: ConfiguredMcpServer,
    private readonly deps: McpSessionDependencies,
  ) {}

  get name(): string {
    return this.server.definition.name;
  }

  get definition(): McpServerDefinition {
    return this.server.definition;
  }

  async tools(): Promise<McpRemoteTool[]> {
    return this.withConnection(async (live) => {
      live.tools ??= live.connection.listTools({
        timeoutMs: this.server.definition.timeouts.callMs,
      });
      return live.tools.catch((error: unknown) => {
        live.tools = undefined;
        throw error;
      });
    });
  }

  async call(tool: string, args: Record<string, unknown>): Promise<McpToolOutput> {
    const options = { timeoutMs: this.server.definition.timeouts.callMs };
    try {
      return await this.withConnection((live) => live.connection.callTool(tool, args, options));
    } catch (error) {
      if (!(error instanceof McpConnectionClosedError) || this.shutDown) {
        throw error;
      }
      this.noteCrash();
      return this.retryAfterCrash(() =>
        this.withConnection((live) => live.connection.callTool(tool, args, options)),
      );
    }
  }

  async close(): Promise<void> {
    this.shutDown = true;
    this.clearIdleTimer();
    const live = this.live;
    this.live = undefined;
    await Promise.all([live?.connection.close(), this.connecting?.catch(() => undefined)]);
  }

  private async retryAfterCrash<T>(attempt: () => Promise<T>): Promise<T> {
    try {
      return await attempt();
    } catch (error) {
      if (error instanceof McpConnectionClosedError) {
        this.coolDown();
        throw new McpServerUnavailableError(this.name, McpUnavailableReason.CRASHED);
      }
      throw error;
    }
  }

  private async withConnection<T>(work: (live: LiveConnection) => Promise<T>): Promise<T> {
    this.inFlight += 1;
    this.clearIdleTimer();
    try {
      return await work(await this.ensureConnection());
    } finally {
      this.inFlight -= 1;
      this.scheduleIdleStop();
    }
  }

  private ensureConnection(): Promise<LiveConnection> {
    if (this.shutDown) {
      return Promise.reject(
        new McpServerUnavailableError(this.name, McpUnavailableReason.SHUT_DOWN),
      );
    }
    if (this.live?.connection.isOpen === true) {
      return Promise.resolve(this.live);
    }
    if (this.deps.clock.nowMs() < this.coolingDownUntilMs) {
      return Promise.reject(
        new McpServerUnavailableError(this.name, McpUnavailableReason.COOLING_DOWN),
      );
    }
    this.connecting ??= this.start().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }

  private async start(): Promise<LiveConnection> {
    const { definition, env } = this.server;
    let connection: McpConnection;
    try {
      connection = await this.deps.transport.connect({
        server: definition.name,
        command: definition.launch.command,
        args: definition.launch.args,
        env,
        startTimeoutMs: definition.timeouts.startMs,
      });
    } catch (error) {
      this.coolDown();
      this.event(McpServerEvent.START_FAILED, describeError(error));
      throw new McpServerUnavailableError(this.name, McpUnavailableReason.START_FAILED);
    }
    const live: LiveConnection = { connection };
    connection.onClose(() => this.handleClosed(live));
    if (this.shutDown) {
      await connection.close();
      throw new McpServerUnavailableError(this.name, McpUnavailableReason.SHUT_DOWN);
    }
    this.event(this.crashed ? McpServerEvent.RESTARTED : McpServerEvent.STARTED);
    this.crashed = false;
    this.live = live;
    return live;
  }

  private handleClosed(live: LiveConnection): void {
    if (this.live !== live) {
      return;
    }
    this.live = undefined;
    if (!this.shutDown) {
      this.crashed = true;
      this.event(McpServerEvent.CRASHED);
    }
  }

  private noteCrash(): void {
    if (this.live !== undefined && !this.live.connection.isOpen) {
      this.handleClosed(this.live);
    }
  }

  private coolDown(): void {
    this.coolingDownUntilMs =
      this.deps.clock.nowMs() + this.server.definition.timeouts.restartCooldownMs;
  }

  private scheduleIdleStop(): void {
    if (this.inFlight > 0 || this.live === undefined || this.shutDown) {
      return;
    }
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      void this.stopIdle();
    }, this.server.definition.timeouts.idleTtlMs);
    this.idleTimer.unref();
  }

  private async stopIdle(): Promise<void> {
    const live = this.live;
    if (this.inFlight > 0 || live === undefined) {
      return;
    }
    this.live = undefined;
    this.event(McpServerEvent.IDLE_STOPPED);
    await live.connection.close().catch(() => undefined);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== undefined) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  private event(event: McpServerEvent, detail?: string): void {
    this.deps.telemetry.serverEvent({ server: this.name, event, detail });
  }
}
