import { ModelError, ModelErrorCategory } from '../../model.errors';
import { formatModelRef } from '../../model-ref';
import type { ModelRequest, ModelResponse, ModelUsage } from '../../model.types';
import { ContentPartType, MessageRole, StopReason, ToolChoice } from '../../model.types';

export const StubScenario = {
  NORMAL: 'normal',
  RUNAWAY: 'runaway',
  TOOL_ERROR: 'tool-error',
  REFUSAL: 'refusal',
  BUDGET_EXCEEDED: 'budget-exceeded',
  TRANSPORT_FAILURE: 'transport-failure',
} as const;
export type StubScenario = (typeof StubScenario)[keyof typeof StubScenario];

export interface StubScript {
  respond(request: ModelRequest, callIndex: number): ModelResponse;
}

export interface StubScenarioOptions {
  toolName?: string;
  finalText?: string;
  usage?: ModelUsage;
}

interface ResolvedOptions {
  toolName: string;
  finalText: string;
  usage: ModelUsage;
}

const STUB_PROVIDER = 'stub';
const DEFAULT_TOOL_NAME = 'lookup';
const STUB_CALL_ID_PREFIX = 'stub-call-';
const STUB_TOOL_INPUT = { query: 'status' };
export const DEFAULT_STUB_FINAL_TEXT = 'All checks passed.';
export const TOOL_ERROR_FINAL_TEXT = 'The tool failed, so this is a partial answer.';
export const STUB_TRANSPORT_FAILURE_MESSAGE = 'stub transport failure';

export const DEFAULT_STUB_USAGE: ModelUsage = {
  inputTokens: 100,
  outputTokens: 50,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
};

export const EXPENSIVE_STUB_USAGE: ModelUsage = {
  inputTokens: 1_000_000,
  outputTokens: 100_000,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
};

function respondWith(
  request: ModelRequest,
  stopReason: ModelResponse['stopReason'],
  content: ModelResponse['content'],
  usage: ModelUsage,
): ModelResponse {
  return {
    model: formatModelRef({ provider: STUB_PROVIDER, model: request.model }),
    content,
    stopReason,
    usage,
  };
}

function toolCallResponse(
  request: ModelRequest,
  options: ResolvedOptions,
  callIndex: number,
): ModelResponse {
  return respondWith(
    request,
    StopReason.TOOL_USE,
    [
      {
        type: ContentPartType.TOOL_CALL,
        call: {
          id: `${STUB_CALL_ID_PREFIX}${callIndex}`,
          name: options.toolName,
          input: STUB_TOOL_INPUT,
        },
      },
    ],
    options.usage,
  );
}

function textResponse(request: ModelRequest, text: string, usage: ModelUsage): ModelResponse {
  return respondWith(request, StopReason.END, [{ type: ContentPartType.TEXT, text }], usage);
}

function lastToolResultFailed(request: ModelRequest): boolean {
  const lastUserMessage = [...request.messages]
    .reverse()
    .find((message) => message.role === MessageRole.USER);
  return (
    lastUserMessage?.content.some(
      (part) => part.type === ContentPartType.TOOL_RESULT && part.result.isError,
    ) ?? false
  );
}

function normalScript(options: ResolvedOptions): StubScript {
  return {
    respond: (request, callIndex) =>
      callIndex === 0
        ? toolCallResponse(request, options, callIndex)
        : textResponse(request, options.finalText, options.usage),
  };
}

function runawayScript(options: ResolvedOptions): StubScript {
  return { respond: (request, callIndex) => toolCallResponse(request, options, callIndex) };
}

function toolErrorScript(options: ResolvedOptions): StubScript {
  return {
    respond: (request, callIndex) => {
      if (callIndex === 0) {
        return toolCallResponse(request, options, callIndex);
      }
      const text = lastToolResultFailed(request) ? TOOL_ERROR_FINAL_TEXT : options.finalText;
      return textResponse(request, text, options.usage);
    },
  };
}

function refusalScript(options: ResolvedOptions): StubScript {
  return { respond: (request) => respondWith(request, StopReason.REFUSAL, [], options.usage) };
}

function transportFailureScript(): StubScript {
  return {
    respond: () => {
      throw new ModelError(ModelErrorCategory.TRANSPORT, STUB_TRANSPORT_FAILURE_MESSAGE);
    },
  };
}

export function createStubScript(
  scenario: StubScenario,
  options: StubScenarioOptions = {},
): StubScript {
  const defaultUsage =
    scenario === StubScenario.BUDGET_EXCEEDED ? EXPENSIVE_STUB_USAGE : DEFAULT_STUB_USAGE;
  const resolved: ResolvedOptions = {
    toolName: options.toolName ?? DEFAULT_TOOL_NAME,
    finalText: options.finalText ?? DEFAULT_STUB_FINAL_TEXT,
    usage: options.usage ?? defaultUsage,
  };

  const inner = scriptFor(scenario, resolved);
  return {
    respond: (request, callIndex) =>
      request.toolChoice === ToolChoice.NONE &&
      scenario !== StubScenario.REFUSAL &&
      scenario !== StubScenario.TRANSPORT_FAILURE
        ? textResponse(request, resolved.finalText, resolved.usage)
        : inner.respond(request, callIndex),
  };
}

function scriptFor(scenario: StubScenario, resolved: ResolvedOptions): StubScript {
  switch (scenario) {
    case StubScenario.NORMAL:
      return normalScript(resolved);
    case StubScenario.RUNAWAY:
    case StubScenario.BUDGET_EXCEEDED:
      return runawayScript(resolved);
    case StubScenario.TOOL_ERROR:
      return toolErrorScript(resolved);
    case StubScenario.REFUSAL:
      return refusalScript(resolved);
    case StubScenario.TRANSPORT_FAILURE:
      return transportFailureScript();
  }
}
