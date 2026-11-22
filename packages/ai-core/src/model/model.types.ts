export const StopReason = {
  END: 'end',
  TOOL_USE: 'tool_use',
  MAX_TOKENS: 'max_tokens',
  REFUSAL: 'refusal',
  PAUSED: 'paused',
} as const;
export type StopReason = (typeof StopReason)[keyof typeof StopReason];

export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const ContentPartType = {
  TEXT: 'text',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
  PROVIDER_BLOCK: 'provider_block',
} as const;
export type ContentPartType = (typeof ContentPartType)[keyof typeof ContentPartType];

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResult {
  callId: string;
  content: string;
  isError: boolean;
}

export type JsonSchema = Record<string, unknown>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

export type ContentPart =
  | { type: typeof ContentPartType.TEXT; text: string }
  | { type: typeof ContentPartType.TOOL_CALL; call: ToolCall }
  | { type: typeof ContentPartType.TOOL_RESULT; result: ToolResult }
  | { type: typeof ContentPartType.PROVIDER_BLOCK; provider: string; payload: unknown };

export interface ChatMessage {
  role: MessageRole;
  content: ContentPart[];
}

export interface ResponseSchema {
  name: string;
  jsonSchema: JsonSchema;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
}

export interface ModelCapabilities {
  promptCaching: boolean;
  thinking: boolean;
  images: boolean;
  structuredOutput: boolean;
}

export interface ModelRequest {
  model: string;
  system: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  maxTokens: number;
  timeoutMs: number;
  responseSchema?: ResponseSchema;
}

export interface ModelResponse {
  model: string;
  content: ContentPart[];
  stopReason: StopReason;
  usage: ModelUsage;
}

export const EMPTY_USAGE: Readonly<ModelUsage> = Object.freeze({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
});

export function addUsage(left: Readonly<ModelUsage>, right: Readonly<ModelUsage>): ModelUsage {
  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    cacheReadTokens: left.cacheReadTokens + right.cacheReadTokens,
    cacheWriteTokens: left.cacheWriteTokens + right.cacheWriteTokens,
    reasoningTokens: left.reasoningTokens + right.reasoningTokens,
  };
}

export function textMessage(role: MessageRole, text: string): ChatMessage {
  return { role, content: [{ type: ContentPartType.TEXT, text }] };
}

export function textOf(content: readonly ContentPart[]): string {
  return content
    .flatMap((part) => (part.type === ContentPartType.TEXT ? [part.text] : []))
    .join('');
}

export function toolCallsOf(content: readonly ContentPart[]): ToolCall[] {
  return content.flatMap((part) => (part.type === ContentPartType.TOOL_CALL ? [part.call] : []));
}
