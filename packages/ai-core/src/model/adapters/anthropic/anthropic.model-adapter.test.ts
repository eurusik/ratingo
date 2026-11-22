import { z } from 'zod';
import { zodToJsonSchema } from '../../../schema/zod-json-schema';
import { ModelError, ModelErrorCategory } from '../../model.errors';
import type { ModelRequest } from '../../model.types';
import { ContentPartType, MessageRole, StopReason, textMessage } from '../../model.types';
import { createAnthropicModelAdapter } from './anthropic.model-adapter';
import type { AnthropicModelAdapter } from './anthropic.model-adapter';

const usage = {
  input_tokens: 120,
  output_tokens: 40,
  cache_read_input_tokens: 30,
  cache_creation_input_tokens: 10,
};

const message = (overrides: Record<string, unknown> = {}) => ({
  id: 'msg_01',
  type: 'message',
  role: 'assistant',
  model: 'claude-haiku-5-5',
  content: [{ type: 'text', text: 'All systems normal.' }],
  stop_reason: 'end_turn',
  stop_sequence: null,
  usage,
  ...overrides,
});

const errorBody = (type: string) => ({
  type: 'error',
  error: { type, message: `${type} happened` },
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

interface Recorded {
  bodies: Record<string, unknown>[];
  fetchMock: jest.Mock<Promise<Response>, [unknown, RequestInit?]>;
}

function adapterReturning(
  responder: (call: number) => Response | Promise<Response>,
  maxRetries = 0,
): { adapter: AnthropicModelAdapter } & Recorded {
  const bodies: Recorded['bodies'] = [];
  let call = 0;
  const fetchMock = jest.fn((_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    call += 1;
    return Promise.resolve(responder(call));
  });
  const adapter = createAnthropicModelAdapter({
    apiKey: 'test-key',
    fetch: fetchMock as unknown as typeof fetch,
    maxRetries,
  });
  return { adapter, bodies, fetchMock };
}

const request = (overrides: Partial<ModelRequest> = {}): ModelRequest => ({
  model: 'claude-haiku-5-5',
  system: 'You write digests.',
  messages: [textMessage(MessageRole.USER, 'Summarise today.')],
  tools: [],
  maxTokens: 512,
  timeoutMs: 5_000,
  ...overrides,
});

describe('AnthropicModelAdapter', () => {
  describe('responses', () => {
    it('maps text, stop reason and usage', async () => {
      const { adapter } = adapterReturning(() => jsonResponse(message()));

      const response = await adapter.generate(request());

      expect(response).toEqual({
        model: 'anthropic:claude-haiku-5-5',
        content: [{ type: ContentPartType.TEXT, text: 'All systems normal.' }],
        stopReason: StopReason.END,
        usage: {
          inputTokens: 120,
          outputTokens: 40,
          cacheReadTokens: 30,
          cacheWriteTokens: 10,
          reasoningTokens: 0,
        },
      });
    });

    it('maps tool_use blocks to neutral tool calls', async () => {
      const { adapter } = adapterReturning(() =>
        jsonResponse(
          message({
            content: [
              { type: 'text', text: 'Checking.' },
              {
                type: 'tool_use',
                id: 'toolu_01',
                name: 'queue_state',
                input: { queue: 'ingestion' },
              },
            ],
            stop_reason: 'tool_use',
          }),
        ),
      );

      const response = await adapter.generate(request());

      expect(response.stopReason).toBe(StopReason.TOOL_USE);
      expect(response.content[1]).toEqual({
        type: ContentPartType.TOOL_CALL,
        call: { id: 'toolu_01', name: 'queue_state', input: { queue: 'ingestion' } },
      });
    });

    it('separates reasoning tokens from visible output tokens', async () => {
      const { adapter } = adapterReturning(() =>
        jsonResponse(
          message({
            usage: { ...usage, output_tokens: 100, output_tokens_details: { thinking_tokens: 70 } },
          }),
        ),
      );

      const response = await adapter.generate(request());

      expect(response.usage).toMatchObject({ outputTokens: 30, reasoningTokens: 70 });
    });

    it.each([
      ['end_turn', StopReason.END],
      ['stop_sequence', StopReason.END],
      ['max_tokens', StopReason.MAX_TOKENS],
      ['model_context_window_exceeded', StopReason.MAX_TOKENS],
      ['refusal', StopReason.REFUSAL],
      ['pause_turn', StopReason.PAUSED],
    ])('maps stop reason %s', async (anthropicReason, expected) => {
      const { adapter } = adapterReturning(() =>
        jsonResponse(message({ stop_reason: anthropicReason })),
      );

      const response = await adapter.generate(request());

      expect(response.stopReason).toBe(expected);
    });

    it('fails with a protocol error on a stop reason it does not know', async () => {
      const { adapter } = adapterReturning(() =>
        jsonResponse(message({ stop_reason: 'brand_new' })),
      );

      await expect(adapter.generate(request())).rejects.toMatchObject({
        category: ModelErrorCategory.PROTOCOL,
      });
    });

    it('fails with a protocol error when there is no stop reason', async () => {
      const { adapter } = adapterReturning(() => jsonResponse(message({ stop_reason: null })));

      await expect(adapter.generate(request())).rejects.toMatchObject({
        category: ModelErrorCategory.PROTOCOL,
      });
    });

    it('keeps thinking blocks opaque and sends them back unchanged', async () => {
      const thinking = { type: 'thinking', thinking: '', signature: 'sig-abc' };
      const { adapter, bodies } = adapterReturning((call) =>
        jsonResponse(
          call === 1
            ? message({
                content: [
                  thinking,
                  { type: 'tool_use', id: 'toolu_01', name: 'lookup', input: {} },
                ],
                stop_reason: 'tool_use',
              })
            : message(),
        ),
      );

      const first = await adapter.generate(request());
      expect(first.content[0]).toEqual({
        type: ContentPartType.PROVIDER_BLOCK,
        provider: 'anthropic',
        payload: thinking,
      });

      await adapter.generate(
        request({
          messages: [
            textMessage(MessageRole.USER, 'go'),
            { role: MessageRole.ASSISTANT, content: first.content },
            {
              role: MessageRole.USER,
              content: [
                {
                  type: ContentPartType.TOOL_RESULT,
                  result: { callId: 'toolu_01', content: 'done', isError: false },
                },
              ],
            },
          ],
        }),
      );

      const sentMessages = bodies[1]?.messages as { role: string; content: unknown[] }[];
      expect(sentMessages[1]?.content[0]).toEqual(thinking);
      expect(sentMessages[2]?.content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'toolu_01',
        content: 'done',
        is_error: false,
      });
    });
  });

  describe('requests', () => {
    it('sends explicit max_tokens, system, model and caching', async () => {
      const { adapter, bodies } = adapterReturning(() => jsonResponse(message()));

      await adapter.generate(request());

      expect(bodies[0]).toMatchObject({
        model: 'claude-haiku-5-5',
        max_tokens: 512,
        system: [
          { type: 'text', text: 'You write digests.', cache_control: { type: 'ephemeral' } },
        ],
        cache_control: { type: 'ephemeral' },
      });
      expect(bodies[0]).not.toHaveProperty('temperature');
      expect(bodies[0]).not.toHaveProperty('tool_choice');
      expect(bodies[0]).not.toHaveProperty('stream');
    });

    it('omits an empty system prompt and empty text blocks', async () => {
      const { adapter, bodies } = adapterReturning(() => jsonResponse(message()));

      await adapter.generate(
        request({
          system: '',
          messages: [
            {
              role: MessageRole.USER,
              content: [
                { type: ContentPartType.TEXT, text: '' },
                { type: ContentPartType.TEXT, text: 'hi' },
              ],
            },
          ],
        }),
      );

      expect(bodies[0]).not.toHaveProperty('system');
      expect((bodies[0]?.messages as { content: unknown[] }[])[0]?.content).toEqual([
        { type: 'text', text: 'hi' },
      ]);
    });

    it('drops messages that end up with no content blocks', async () => {
      const { adapter, bodies } = adapterReturning(() => jsonResponse(message()));

      await adapter.generate(
        request({
          messages: [
            textMessage(MessageRole.USER, 'hi'),
            { role: MessageRole.ASSISTANT, content: [{ type: ContentPartType.TEXT, text: '' }] },
          ],
        }),
      );

      expect(bodies[0]?.messages as unknown[]).toHaveLength(1);
    });

    it('maps tool definitions to input_schema', async () => {
      const { adapter, bodies } = adapterReturning(() => jsonResponse(message()));

      await adapter.generate(
        request({
          tools: [
            {
              name: 'queue_state',
              description: 'Queue depth',
              inputSchema: { properties: { queue: { type: 'string' } }, required: ['queue'] },
            },
          ],
        }),
      );

      expect(bodies[0]?.tools).toEqual([
        {
          name: 'queue_state',
          description: 'Queue depth',
          cache_control: { type: 'ephemeral' },
          input_schema: {
            type: 'object',
            properties: { queue: { type: 'string' } },
            required: ['queue'],
          },
        },
      ]);
    });

    it('requests structured output through output_config', async () => {
      const { adapter, bodies } = adapterReturning(() => jsonResponse(message()));

      await adapter.generate(
        request({
          responseSchema: { name: 'digest', jsonSchema: { type: 'object', properties: {} } },
        }),
      );

      expect(bodies[0]?.output_config).toEqual({
        format: { type: 'json_schema', schema: { type: 'object', properties: {} } },
      });
    });
  });

  describe('structured output schema', () => {
    it('sends no keyword Anthropic rejects for the digest reply schema', async () => {
      const { adapter, bodies } = adapterReturning(() => jsonResponse(message()));
      const digestReply = z.object({
        headline: z.string().min(1).max(80),
        actions: z.array(z.object({ id: z.string(), text: z.string().max(200) })).max(20),
      });

      await adapter.generate(
        request({
          responseSchema: { name: 'digest', jsonSchema: zodToJsonSchema(digestReply) },
        }),
      );

      const sent = JSON.stringify(bodies[0]?.output_config);
      expect(sent).not.toMatch(/maxItems|minItems|maxLength|minLength|minimum|maximum/);
      expect(sent).toContain('"actions"');
    });
  });

  describe('errors', () => {
    it.each([
      [429, 'rate_limit_error', ModelErrorCategory.RATE_LIMIT],
      [500, 'api_error', ModelErrorCategory.SERVER],
      [529, 'overloaded_error', ModelErrorCategory.SERVER],
      [400, 'invalid_request_error', ModelErrorCategory.CLIENT],
      [401, 'authentication_error', ModelErrorCategory.CLIENT],
    ])('maps HTTP %s to %s', async (status, type, category) => {
      const { adapter } = adapterReturning(() => jsonResponse(errorBody(type), status));

      const failure = await adapter.generate(request()).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ModelError);
      expect(failure).toMatchObject({ category, status });
    });

    it('maps a network failure to a transport error', async () => {
      const { adapter } = adapterReturning(() => {
        throw new TypeError('fetch failed');
      });

      await expect(adapter.generate(request())).rejects.toMatchObject({
        category: ModelErrorCategory.TRANSPORT,
      });
    });

    it('names the API key setting and keeps the key out of the 401 reason', async () => {
      const { adapter } = adapterReturning(() =>
        jsonResponse(errorBody('authentication_error'), 401),
      );

      const failure = (await adapter.generate(request()).catch((error: unknown) => error)) as Error;

      expect(failure.message).toContain('ANTHROPIC_API_KEY');
      expect(failure.message).not.toContain('test-key');
      expect(failure.message).not.toContain('Summarise today.');
    });

    it('does not retry a rejected request', async () => {
      const { adapter, fetchMock } = adapterReturning(
        () => jsonResponse(errorBody('invalid_request_error'), 400),
        2,
      );

      await expect(adapter.generate(request())).rejects.toMatchObject({
        category: ModelErrorCategory.CLIENT,
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('recovers from a 429 on retry', async () => {
      const { adapter, fetchMock } = adapterReturning(
        (call) =>
          call === 1
            ? new Response(JSON.stringify(errorBody('rate_limit_error')), {
                status: 429,
                headers: { 'content-type': 'application/json', 'retry-after': '0' },
              })
            : jsonResponse(message()),
        1,
      );

      await expect(adapter.generate(request())).resolves.toMatchObject({
        stopReason: StopReason.END,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries a bounded number of times before failing', async () => {
      const { adapter, fetchMock } = adapterReturning(
        () => jsonResponse(errorBody('api_error'), 500),
        1,
      );

      await expect(adapter.generate(request())).rejects.toMatchObject({
        category: ModelErrorCategory.SERVER,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('recovers when the retry succeeds', async () => {
      const { adapter, fetchMock } = adapterReturning(
        (call) =>
          call === 1 ? jsonResponse(errorBody('api_error'), 500) : jsonResponse(message()),
        1,
      );

      await expect(adapter.generate(request())).resolves.toMatchObject({
        stopReason: StopReason.END,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
