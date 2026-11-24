import type Anthropic from '@anthropic-ai/sdk';
import * as fc from 'fast-check';
import { ModelError, ModelErrorCategory } from '../../model.errors';
import type { ChatMessage, ContentPart, ModelRequest } from '../../model.types';
import { ContentPartType, MessageRole, StopReason } from '../../model.types';
import { fromAnthropicMessage, toAnthropicRequest } from './anthropic.mapper';

const KNOWN_STOP_REASONS: Record<string, StopReason> = {
  end_turn: StopReason.END,
  stop_sequence: StopReason.END,
  tool_use: StopReason.TOOL_USE,
  max_tokens: StopReason.MAX_TOKENS,
  model_context_window_exceeded: StopReason.MAX_TOKENS,
  refusal: StopReason.REFUSAL,
  pause_turn: StopReason.PAUSED,
};

const NEUTRAL_STOP_REASONS: readonly string[] = Object.values(StopReason);

const jsonValue = fc.jsonValue() as fc.Arbitrary<unknown>;

const textPart = fc
  .string({ minLength: 1 })
  .map((text): ContentPart => ({ type: ContentPartType.TEXT, text }));

const toolCallPart = fc
  .record({ id: fc.string({ minLength: 1 }), name: fc.string({ minLength: 1 }), input: jsonValue })
  .map((call): ContentPart => ({ type: ContentPartType.TOOL_CALL, call }));

const providerPart = fc
  .record({ thinking: fc.string(), signature: fc.string() })
  .map((payload): ContentPart => ({
    type: ContentPartType.PROVIDER_BLOCK,
    provider: 'anthropic',
    payload: { type: 'thinking', ...payload },
  }));

const assistantParts = fc.array(fc.oneof(textPart, toolCallPart, providerPart), {
  minLength: 1,
  maxLength: 6,
});

const toolResultPart = fc
  .record({ callId: fc.string({ minLength: 1 }), content: fc.string(), isError: fc.boolean() })
  .map((result): ContentPart => ({ type: ContentPartType.TOOL_RESULT, result }));

const requestWith = (messages: ChatMessage[]): ModelRequest => ({
  model: 'claude-haiku-5-5',
  system: '',
  messages,
  tools: [],
  maxTokens: 256,
  timeoutMs: 1_000,
});

const anthropicMessage = (content: unknown[], stopReason: string | null): Anthropic.Message =>
  ({
    id: 'msg_01',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-5-5',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 0, output_tokens: 0 },
  }) as unknown as Anthropic.Message;

describe('anthropic mapper', () => {
  it('round-trips assistant content through the wire format', () => {
    fc.assert(
      fc.property(assistantParts, (parts) => {
        const wire = toAnthropicRequest(
          requestWith([{ role: MessageRole.ASSISTANT, content: parts }]),
        );
        const sent = wire.messages[0]?.content as unknown[];

        const restored = fromAnthropicMessage(
          anthropicMessage(sent, 'end_turn'),
          'claude-haiku-5-5',
        );

        expect(restored.content).toEqual(parts);
      }),
    );
  });

  it('sends tool results as tool_result blocks that keep the call id and error flag', () => {
    fc.assert(
      fc.property(fc.array(toolResultPart, { minLength: 1, maxLength: 4 }), (parts) => {
        const wire = toAnthropicRequest(requestWith([{ role: MessageRole.USER, content: parts }]));

        const blocks = wire.messages[0]?.content as {
          type: string;
          tool_use_id: string;
          content: string;
          is_error: boolean;
        }[];

        expect(blocks).toEqual(
          parts.map((part) =>
            part.type === ContentPartType.TOOL_RESULT
              ? {
                  type: 'tool_result',
                  tool_use_id: part.result.callId,
                  content: part.result.content,
                  is_error: part.result.isError,
                }
              : undefined,
          ),
        );
      }),
    );
  });

  it('never forwards provider blocks that belong to another provider', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((provider) => provider !== 'anthropic'),
        jsonValue,
        (provider, payload) => {
          const wire = toAnthropicRequest(
            requestWith([
              textMessage('hi'),
              {
                role: MessageRole.ASSISTANT,
                content: [{ type: ContentPartType.PROVIDER_BLOCK, provider, payload }],
              },
            ]),
          );

          expect(wire.messages).toHaveLength(1);
        },
      ),
    );
  });

  it('maps every stop reason to a neutral one or fails with a protocol error', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(...Object.keys(KNOWN_STOP_REASONS)),
          fc.string(),
          fc.constant(null),
        ),
        (reason) => {
          const outcome = (() => {
            try {
              return fromAnthropicMessage(anthropicMessage([], reason), 'claude-haiku-5-5')
                .stopReason;
            } catch (error) {
              return error;
            }
          })();

          if (reason !== null && Object.hasOwn(KNOWN_STOP_REASONS, reason)) {
            expect(outcome).toBe(KNOWN_STOP_REASONS[reason]);
          } else {
            expect(outcome).toBeInstanceOf(ModelError);
            expect((outcome as ModelError).category).toBe(ModelErrorCategory.PROTOCOL);
          }
          if (typeof outcome === 'string') {
            expect(NEUTRAL_STOP_REASONS).toContain(outcome);
          }
        },
      ),
    );
  });

  it('keeps usage non-negative and splits reasoning tokens out of the output total', () => {
    fc.assert(
      fc.property(
        fc.record({
          input: fc.nat(1_000_000),
          output: fc.nat(1_000_000),
          thinking: fc.nat(2_000_000),
          cacheRead: fc.nat(1_000_000),
          cacheWrite: fc.nat(1_000_000),
        }),
        (tokens) => {
          const message = anthropicMessage([], 'end_turn');
          Object.assign(message.usage, {
            input_tokens: tokens.input,
            output_tokens: tokens.output,
            cache_read_input_tokens: tokens.cacheRead,
            cache_creation_input_tokens: tokens.cacheWrite,
            output_tokens_details: { thinking_tokens: tokens.thinking },
          });

          const { usage } = fromAnthropicMessage(message, 'claude-haiku-5-5');

          expect(usage.outputTokens).toBeGreaterThanOrEqual(0);
          expect(usage.reasoningTokens).toBeGreaterThanOrEqual(0);
          expect(usage.outputTokens + usage.reasoningTokens).toBe(tokens.output);
          expect(usage.cacheReadTokens).toBe(tokens.cacheRead);
          expect(usage.cacheWriteTokens).toBe(tokens.cacheWrite);
        },
      ),
    );
  });

  it('puts a cache breakpoint on the system prompt and on the last tool only', () => {
    const wire = toAnthropicRequest({
      ...requestWith([textMessage('hi')]),
      system: 'rules',
      tools: [
        { name: 'a', description: 'a', inputSchema: {} },
        { name: 'b', description: 'b', inputSchema: {} },
      ],
    });

    const tools = wire.tools as { cache_control?: unknown }[];
    expect(tools[0]?.cache_control).toBeUndefined();
    expect(tools[1]?.cache_control).toEqual({ type: 'ephemeral' });
    expect(wire.system).toEqual([
      { type: 'text', text: 'rules', cache_control: { type: 'ephemeral' } },
    ]);
  });
});

function textMessage(text: string): ChatMessage {
  return { role: MessageRole.USER, content: [{ type: ContentPartType.TEXT, text }] };
}
