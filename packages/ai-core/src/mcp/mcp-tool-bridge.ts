import type { ClockPort } from '../clock/clock.port';
import type { ToolDefinition } from '../model/model.types';
import type { Tool } from '../tools/define-tool';
import { TRUNCATION_MARKER } from '../tools/tool-registry';
import { wrapUntrusted } from '../tools/untrusted-content';
import {
  McpCallRefusedError,
  McpServerUnavailableError,
  McpToolFailedError,
  McpToolUnavailableError,
} from './mcp-call.errors';
import { epochDayOf } from './mcp-calendar';
import { outputCapFor } from './mcp-server.definition';
import type { McpSession } from './mcp-session';
import { McpCallOutcome } from './mcp-telemetry.port';
import type { McpTelemetry } from './mcp-telemetry.port';
import { toBridgedToolName } from './mcp-tool-name';
import { argumentNamesOf, decideMcpCall, exposedInputSchema } from './mcp-tool-policy';
import type { McpToolRule } from './mcp-tool-policy.types';
import { McpTimeoutError } from './mcp-transport.port';
import type { McpRemoteTool, McpToolOutput } from './mcp-transport.port';

const REDACTION_HEADROOM_FACTOR = 2;
const UNTRUSTED_LABEL_PREFIX = 'mcp';

export interface McpBridgeDependencies {
  clock: ClockPort;
  telemetry: McpTelemetry;
}

function capText(text: string, cap: number): string {
  return text.length > cap ? `${text.slice(0, cap)}${TRUNCATION_MARKER}` : text;
}

function outcomeOf(error: unknown): McpCallOutcome {
  return error instanceof McpTimeoutError ? McpCallOutcome.TIMEOUT : McpCallOutcome.UNAVAILABLE;
}

function unavailableReason(error: unknown): string {
  return error instanceof McpServerUnavailableError ? error.reason : outcomeOf(error);
}

export class BridgedMcpTool implements Tool {
  readonly name: string;
  readonly readOnly = true;
  readonly maxOutputChars: number;
  readonly definition: ToolDefinition;
  private readonly label: string;
  private readonly outputCap: number;
  private readonly knownArguments: readonly string[];

  constructor(
    private readonly session: McpSession,
    private readonly remote: McpRemoteTool,
    rule: McpToolRule,
    private readonly deps: McpBridgeDependencies,
  ) {
    this.name = toBridgedToolName({ server: session.name, tool: remote.name });
    this.label = `${UNTRUSTED_LABEL_PREFIX} ${this.name}`;
    this.outputCap = outputCapFor(session.definition, rule);
    this.knownArguments = argumentNamesOf(remote.inputSchema);
    const envelope = wrapUntrusted(this.label, TRUNCATION_MARKER).length;
    this.maxOutputChars = (this.outputCap + envelope) * REDACTION_HEADROOM_FACTOR;
    this.definition = {
      name: this.name,
      description: rule.description,
      inputSchema: exposedInputSchema(remote.inputSchema, rule),
    };
  }

  async run(rawInput: unknown): Promise<string> {
    const startedMs = this.deps.clock.nowMs();
    const decision = decideMcpCall(this.session.definition.policy, this.remote.name, rawInput, {
      todayEpochDay: epochDayOf(startedMs),
      knownArguments: this.knownArguments,
    });
    if (!decision.allowed) {
      this.record(McpCallOutcome.REFUSED, startedMs);
      throw new McpCallRefusedError(this.name, decision.refusal);
    }
    const output = await this.callRemote(decision.arguments, startedMs);
    const wrapped = wrapUntrusted(this.label, capText(output.text, this.outputCap));
    this.record(output.isError ? McpCallOutcome.TOOL_ERROR : McpCallOutcome.OK, startedMs);
    if (output.isError) {
      throw new McpToolFailedError(this.name, wrapped);
    }
    return wrapped;
  }

  private async callRemote(
    args: Record<string, unknown>,
    startedMs: number,
  ): Promise<McpToolOutput> {
    try {
      return await this.session.call(this.remote.name, args);
    } catch (error) {
      this.record(outcomeOf(error), startedMs);
      throw new McpToolUnavailableError(this.name, this.session.name, unavailableReason(error));
    }
  }

  private record(outcome: McpCallOutcome, startedMs: number): void {
    this.deps.telemetry.callFinished({
      server: this.session.name,
      tool: this.remote.name,
      outcome,
      durationMs: this.deps.clock.nowMs() - startedMs,
    });
  }
}
