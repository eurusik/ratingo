import type { ModelRequest, ModelResponse, ModelUsage, StubScript } from '@ratingo/ai-core';
import { ContentPartType, StopReason, formatModelRef } from '@ratingo/ai-core';

const CHEAP_USAGE: ModelUsage = {
  inputTokens: 100,
  outputTokens: 50,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
};

export const EXPENSIVE_USAGE: ModelUsage = {
  inputTokens: 10_000_000,
  outputTokens: 1_000_000,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
};

export type ScriptedStep =
  | { kind: 'call'; tool: string; input: unknown; usage?: ModelUsage }
  | { kind: 'answer'; text: string; usage?: ModelUsage };

export const callStep = (tool: string, input: unknown = {}, usage?: ModelUsage): ScriptedStep => ({
  kind: 'call',
  tool,
  input,
  ...(usage === undefined ? {} : { usage }),
});

export const answerStep = (text: string, usage?: ModelUsage): ScriptedStep => ({
  kind: 'answer',
  text,
  ...(usage === undefined ? {} : { usage }),
});

const respond = (
  request: ModelRequest,
  step: ScriptedStep,
  index: number,
  provider: string,
): ModelResponse => {
  const model = formatModelRef({ provider, model: request.model });
  if (step.kind === 'call') {
    return {
      model,
      content: [
        {
          type: ContentPartType.TOOL_CALL,
          call: { id: `scripted-${index}`, name: step.tool, input: step.input },
        },
      ],
      stopReason: StopReason.TOOL_USE,
      usage: step.usage ?? CHEAP_USAGE,
    };
  }
  return {
    model,
    content: [{ type: ContentPartType.TEXT, text: step.text }],
    stopReason: StopReason.END,
    usage: step.usage ?? CHEAP_USAGE,
  };
};

export const scriptedModel = (
  steps: readonly ScriptedStep[],
  provider = 'stub',
): StubScript & { requests: ModelRequest[] } => {
  const requests: ModelRequest[] = [];
  return {
    requests,
    respond: (request, callIndex) => {
      requests.push(request);
      const step = steps[Math.min(callIndex, steps.length - 1)];
      return respond(request, step, callIndex, provider);
    },
  };
};
