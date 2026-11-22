import Anthropic from '@anthropic-ai/sdk';
import { ModelError, ModelErrorCategory } from '../../model.errors';
import { formatModelRef } from '../../model-ref';
import type {
  ChatMessage,
  ContentPart,
  ModelRequest,
  ModelResponse,
  ModelUsage,
  ToolDefinition,
} from '../../model.types';
import { ContentPartType, StopReason } from '../../model.types';

export const ANTHROPIC_PROVIDER = 'anthropic';

const SERVER_ERROR_MIN_STATUS = 500;
const RATE_LIMIT_STATUS = 429;
const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const CACHE_CONTROL: Anthropic.CacheControlEphemeral = { type: 'ephemeral' };
const TOOL_SCHEMA_TYPE = 'object';
const JSON_SCHEMA_FORMAT = 'json_schema';

const AnthropicBlockType = {
  TEXT: 'text',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
} as const;

function toAnthropicTool(tool: ToolDefinition): Anthropic.Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: { ...tool.inputSchema, type: TOOL_SCHEMA_TYPE },
  };
}

function toAnthropicBlock(part: ContentPart): Anthropic.ContentBlockParam[] {
  switch (part.type) {
    case ContentPartType.TEXT:
      return part.text === '' ? [] : [{ type: AnthropicBlockType.TEXT, text: part.text }];
    case ContentPartType.TOOL_CALL:
      return [
        {
          type: AnthropicBlockType.TOOL_USE,
          id: part.call.id,
          name: part.call.name,
          input: part.call.input,
        },
      ];
    case ContentPartType.TOOL_RESULT:
      return [
        {
          type: AnthropicBlockType.TOOL_RESULT,
          tool_use_id: part.result.callId,
          content: part.result.content,
          is_error: part.result.isError,
        },
      ];
    case ContentPartType.PROVIDER_BLOCK:
      return part.provider === ANTHROPIC_PROVIDER
        ? [part.payload as Anthropic.ContentBlockParam]
        : [];
  }
}

function toAnthropicMessage(message: ChatMessage): Anthropic.MessageParam {
  return { role: message.role, content: message.content.flatMap(toAnthropicBlock) };
}

function systemParam(request: ModelRequest): Pick<Anthropic.MessageCreateParams, 'system'> {
  return request.system === ''
    ? {}
    : {
        system: [
          { type: AnthropicBlockType.TEXT, text: request.system, cache_control: CACHE_CONTROL },
        ],
      };
}

function toolsParam(request: ModelRequest): Pick<Anthropic.MessageCreateParams, 'tools'> {
  const tools = request.tools.map(toAnthropicTool);
  const last = tools.length - 1;
  return last < 0
    ? {}
    : { tools: tools.map((tool, index) => (index === last ? withCacheBreakpoint(tool) : tool)) };
}

function withCacheBreakpoint(tool: Anthropic.Tool): Anthropic.Tool {
  return { ...tool, cache_control: CACHE_CONTROL };
}

function outputConfigParam(
  request: ModelRequest,
): Pick<Anthropic.MessageCreateParams, 'output_config'> {
  return request.responseSchema === undefined
    ? {}
    : {
        output_config: {
          format: { type: JSON_SCHEMA_FORMAT, schema: request.responseSchema.jsonSchema },
        },
      };
}

export function toAnthropicRequest(
  request: ModelRequest,
): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: request.model,
    max_tokens: request.maxTokens,
    cache_control: CACHE_CONTROL,
    messages: request.messages
      .map(toAnthropicMessage)
      .filter((message) => message.content.length > 0),
    ...systemParam(request),
    ...toolsParam(request),
    ...outputConfigParam(request),
  };
}

function fromAnthropicBlock(block: Anthropic.ContentBlock): ContentPart {
  if (block.type === AnthropicBlockType.TEXT) {
    return { type: ContentPartType.TEXT, text: block.text };
  }
  if (block.type === AnthropicBlockType.TOOL_USE) {
    return {
      type: ContentPartType.TOOL_CALL,
      call: { id: block.id, name: block.name, input: block.input },
    };
  }
  return { type: ContentPartType.PROVIDER_BLOCK, provider: ANTHROPIC_PROVIDER, payload: block };
}

function fromAnthropicStopReason(stopReason: Anthropic.StopReason | null): StopReason {
  switch (stopReason) {
    case 'end_turn':
    case 'stop_sequence':
      return StopReason.END;
    case 'tool_use':
      return StopReason.TOOL_USE;
    case 'max_tokens':
    case 'model_context_window_exceeded':
      return StopReason.MAX_TOKENS;
    case 'refusal':
      return StopReason.REFUSAL;
    case 'pause_turn':
      return StopReason.PAUSED;
    case null:
    default:
      throw new ModelError(
        ModelErrorCategory.PROTOCOL,
        `Anthropic returned an unusable stop reason: ${String(stopReason)}`,
      );
  }
}

function splitReasoningTokens(usage: Anthropic.Usage): { reasoning: number; visible: number } {
  const reasoning = Math.min(
    usage.output_tokens_details?.thinking_tokens ?? 0,
    usage.output_tokens,
  );
  return { reasoning, visible: usage.output_tokens - reasoning };
}

function fromAnthropicUsage(usage: Anthropic.Usage): ModelUsage {
  const { reasoning, visible } = splitReasoningTokens(usage);
  return {
    inputTokens: usage.input_tokens,
    outputTokens: visible,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    reasoningTokens: reasoning,
  };
}

export function fromAnthropicMessage(
  message: Anthropic.Message,
  requestedModel: string,
): ModelResponse {
  return {
    model: formatModelRef({ provider: ANTHROPIC_PROVIDER, model: requestedModel }),
    content: message.content.map(fromAnthropicBlock),
    stopReason: fromAnthropicStopReason(message.stop_reason),
    usage: fromAnthropicUsage(message.usage),
  };
}

function clientErrorMessage(providerMessage: string, status: number | undefined): string {
  if (status === UNAUTHORIZED_STATUS || status === FORBIDDEN_STATUS) {
    return `Anthropic rejected the API key (HTTP ${status}): check ANTHROPIC_API_KEY and its spend limit`;
  }
  return `Anthropic rejected the request (HTTP ${String(status)}): ${providerMessage}`;
}

export function translateProviderError(error: unknown): unknown {
  if (error instanceof Anthropic.APIConnectionError) {
    return new ModelError(ModelErrorCategory.TRANSPORT, error.message);
  }
  if (error instanceof Anthropic.APIError) {
    const status = error.status as number | undefined;
    if (status === RATE_LIMIT_STATUS) {
      return new ModelError(ModelErrorCategory.RATE_LIMIT, error.message, status);
    }
    if (status !== undefined && status >= SERVER_ERROR_MIN_STATUS) {
      return new ModelError(ModelErrorCategory.SERVER, error.message, status);
    }
    return new ModelError(
      ModelErrorCategory.CLIENT,
      clientErrorMessage(error.message, status),
      status,
    );
  }
  return error;
}
