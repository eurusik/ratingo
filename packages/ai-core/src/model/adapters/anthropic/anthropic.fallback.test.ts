import { FallbackModelPort } from '../../model-fallback';
import { StubModelAdapter } from '../stub/stub.model-adapter';
import { StubScenario, createStubScript } from '../stub/stub.scenarios';
import { MessageRole, textMessage } from '../../model.types';
import type { ModelRequest } from '../../model.types';
import { createAnthropicModelAdapter } from './anthropic.model-adapter';

const request: ModelRequest = {
  model: 'claude-haiku-5-5',
  system: '',
  messages: [textMessage(MessageRole.USER, 'hi')],
  tools: [],
  maxTokens: 256,
  timeoutMs: 1_000,
};

const failing = (status: number, body: Record<string, unknown>) =>
  createAnthropicModelAdapter({
    apiKey: 'test-key',
    fetch: (() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      )) as unknown as typeof fetch,
  });

const chain = (status: number) => [
  {
    ref: { provider: 'anthropic', model: 'claude-haiku-5-5' },
    port: failing(status, { type: 'error', error: { type: 'x', message: 'boom' } }),
  },
  {
    ref: { provider: 'stub', model: 'stub-model' },
    port: new StubModelAdapter(createStubScript(StubScenario.NORMAL)),
  },
];

describe('anthropic adapter inside a fallback chain', () => {
  it('falls back to the next model on a 500 before the first turn', async () => {
    const response = await new FallbackModelPort(chain(500)).generate(request);

    expect(response.model).toContain('stub');
  });

  it('falls back on a 429 before the first turn', async () => {
    const response = await new FallbackModelPort(chain(429)).generate(request);

    expect(response.model).toContain('stub');
  });

  it('does not fall back on a 401', async () => {
    await expect(new FallbackModelPort(chain(401)).generate(request)).rejects.toMatchObject({
      status: 401,
    });
  });
});
