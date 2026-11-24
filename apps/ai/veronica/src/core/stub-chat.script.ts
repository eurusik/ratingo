import type { StubScript, ToolDefinition } from '@ratingo/ai-core';
import { ContentPartType, MessageRole, StopReason, formatModelRef } from '@ratingo/ai-core';

import { STUB_PROVIDER } from '../config/models.config';

const STUB_ANSWER =
  'Це відповідь заглушки без моделі: знімок отримано, але пояснити його я не можу.';

const STUB_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
};

const hasToolResult = (
  messages: readonly { role: string; content: readonly { type: string }[] }[],
) =>
  messages.some(
    (message) =>
      message.role === MessageRole.USER &&
      message.content.some((part) => part.type === ContentPartType.TOOL_RESULT),
  );

const takesNoInput = (tool: ToolDefinition): boolean => {
  const required = (tool.inputSchema as { required?: unknown }).required;
  return !Array.isArray(required) || required.length === 0;
};

export const createChatStubScript = (): StubScript => ({
  respond: (request) => {
    const model = formatModelRef({ provider: STUB_PROVIDER, model: request.model });
    if (hasToolResult(request.messages)) {
      return {
        model,
        content: [{ type: ContentPartType.TEXT, text: STUB_ANSWER }],
        stopReason: StopReason.END,
        usage: STUB_USAGE,
      };
    }
    const tool = request.tools.find(takesNoInput) ?? request.tools[0];
    return {
      model,
      content: [
        { type: ContentPartType.TOOL_CALL, call: { id: 'stub-call', name: tool.name, input: {} } },
      ],
      stopReason: StopReason.TOOL_USE,
      usage: STUB_USAGE,
    };
  },
});
