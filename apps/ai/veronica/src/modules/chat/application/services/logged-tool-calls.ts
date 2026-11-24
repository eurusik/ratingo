import { redactSecrets } from '@ratingo/ai-core';

import {
  TOOL_CALL_LOG_INPUT_MAX_CHARS,
  TOOL_CALL_LOG_MAX_CALLS,
} from '../../domain/constants/exchange.constants';
import type { LoggedToolCall } from '../../domain/entities/chat-exchange';
import { clip } from '../../domain/policies/answer-sanitizer.policy';
import type { RecordedCall } from '../tools/tool-recorder';

const inputText = (input: unknown): string => JSON.stringify(input ?? {}) ?? '{}';

export const loggedToolCalls = (calls: readonly RecordedCall[]): LoggedToolCall[] =>
  calls.slice(0, TOOL_CALL_LOG_MAX_CALLS).map((call) => ({
    tool: call.tool,
    input: clip(redactSecrets(inputText(call.input)), TOOL_CALL_LOG_INPUT_MAX_CHARS),
  }));
