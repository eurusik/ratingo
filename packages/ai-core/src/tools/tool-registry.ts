import type { ToolCall, ToolDefinition, ToolResult } from '../model/model.types';
import { describeError } from '../shared/describe-error';
import { ToolInputError, type Tool, type ToolContext } from './define-tool';
import { redactSecrets } from './redact';
import { RepeatGuard, RepeatReason, callKey, repeatNote } from './repeat-guard';
import type { ToolSource } from './tool-source.port';

export const TRUNCATION_MARKER = '\n[output truncated]';

export interface ToolRegistryOptions {
  allowWriteTools?: boolean;
  optionalTools?: readonly string[];
  guardRepeatedCalls?: boolean;
}

export class DuplicateToolError extends Error {
  constructor(name: string) {
    super(`Tool "${name}" is provided by more than one source`);
    this.name = 'DuplicateToolError';
  }
}

export class UnknownToolError extends Error {
  constructor(name: string) {
    super(`Allowlisted tool "${name}" is not provided by any source`);
    this.name = 'UnknownToolError';
  }
}

export class WriteToolNotAllowedError extends Error {
  constructor(name: string) {
    super(`Allowlisted tool "${name}" can write and this registry is read-only`);
    this.name = 'WriteToolNotAllowedError';
  }
}

async function collectProvidedTools(sources: readonly ToolSource[]): Promise<Map<string, Tool>> {
  const provided = new Map<string, Tool>();
  for (const source of sources) {
    for (const tool of await source.listTools()) {
      if (provided.has(tool.name)) {
        throw new DuplicateToolError(tool.name);
      }
      provided.set(tool.name, tool);
    }
  }
  return provided;
}

const REDACTION_INPUT_CAP_FACTOR = 4;

function sanitizeOutput(tool: Tool, text: string): string {
  const bounded = text.slice(0, tool.maxOutputChars * REDACTION_INPUT_CAP_FACTOR);
  const redacted = redactSecrets(bounded);
  return redacted.length > tool.maxOutputChars
    ? `${redacted.slice(0, tool.maxOutputChars)}${TRUNCATION_MARKER}`
    : redacted;
}

export class ToolRegistry {
  private constructor(
    private readonly allowed: ReadonlyMap<string, Tool>,
    private readonly absent: readonly string[],
    private readonly repeatGuard: RepeatGuard | undefined,
  ) {}

  static async create(
    sources: readonly ToolSource[],
    allowlist: readonly string[],
    options: ToolRegistryOptions = {},
  ): Promise<ToolRegistry> {
    const provided = await collectProvidedTools(sources);
    const allowed = new Map<string, Tool>();
    const absent: string[] = [];
    const optional = new Set(options.optionalTools ?? []);
    for (const name of allowlist) {
      const tool = provided.get(name);
      if (tool === undefined && optional.has(name)) {
        absent.push(name);
        continue;
      }
      if (tool === undefined) {
        throw new UnknownToolError(name);
      }
      if (!tool.readOnly && options.allowWriteTools !== true) {
        throw new WriteToolNotAllowedError(name);
      }
      allowed.set(name, tool);
    }
    return new ToolRegistry(
      allowed,
      absent,
      options.guardRepeatedCalls === true ? new RepeatGuard() : undefined,
    );
  }

  unavailableTools(): readonly string[] {
    return this.absent;
  }

  definitions(): ToolDefinition[] {
    return [...this.allowed.values()].map((tool) => tool.definition);
  }

  forget(runId: string): void {
    this.repeatGuard?.forget(runId);
  }

  async execute(call: ToolCall, context: ToolContext): Promise<ToolResult> {
    const tool = this.allowed.get(call.name);
    if (tool === undefined) {
      return { callId: call.id, content: `Tool "${call.name}" is not allowed`, isError: true };
    }
    const guard = tool.readOnly ? this.repeatGuard : undefined;
    const key = callKey(call.name, call.input);
    const earlier = guard?.recall(context.runId, key);
    if (earlier !== undefined) {
      return {
        callId: call.id,
        content: `${repeatNote(earlier.reason)}\n${earlier.content}`,
        isError: earlier.reason === RepeatReason.FAILED,
      };
    }
    let empty = false;
    const attempt = await this.runTool(tool, call, {
      ...context,
      markEmpty: () => {
        empty = true;
      },
    });
    if (attempt.deterministicFailure || (!attempt.result.isError && empty)) {
      guard?.remember(context.runId, key, {
        reason: attempt.result.isError ? RepeatReason.FAILED : RepeatReason.EMPTY,
        content: attempt.result.content,
      });
    }
    return attempt.result;
  }

  private async runTool(
    tool: Tool,
    call: ToolCall,
    context: ToolContext,
  ): Promise<{ result: ToolResult; deterministicFailure: boolean }> {
    try {
      const output = await tool.run(call.input, context);
      const result = { callId: call.id, content: sanitizeOutput(tool, output), isError: false };
      return { result, deterministicFailure: false };
    } catch (error) {
      const result = {
        callId: call.id,
        content: sanitizeOutput(tool, describeError(error)),
        isError: true,
      };
      return { result, deterministicFailure: error instanceof ToolInputError };
    }
  }
}
