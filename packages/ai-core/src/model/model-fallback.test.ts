import { ModelError, ModelErrorCategory } from './model.errors';
import { EmptyFallbackChainError, FallbackModelPort } from './model-fallback';
import type { FallbackCandidate } from './model-fallback';
import type { ModelPort } from './model.port';
import type { ModelRequest } from './model.types';
import { MessageRole, StopReason, textMessage } from './model.types';
import { StubModelAdapter } from './adapters/stub/stub.model-adapter';
import { StubScenario, createStubScript } from './adapters/stub/stub.scenarios';

const request = (overrides: Partial<ModelRequest> = {}): ModelRequest => ({
  model: 'primary-model',
  system: '',
  messages: [textMessage(MessageRole.USER, 'hello')],
  tools: [],
  maxTokens: 100,
  timeoutMs: 1000,
  ...overrides,
});

const working = (): StubModelAdapter => new StubModelAdapter(createStubScript(StubScenario.NORMAL));
const CAPABILITIES = working().capabilities;

const failing = (category: ModelErrorCategory, status?: number): ModelPort => ({
  capabilities: CAPABILITIES,
  generate: () => Promise.reject(new ModelError(category, 'boom', status)),
});

const succeedingOnce = (calls: string[]): { port: ModelPort; breakIt: () => void } => {
  const healthy = working();
  let broken = false;
  const port: ModelPort = {
    capabilities: CAPABILITIES,
    generate: (modelRequest) => {
      calls.push(modelRequest.model);
      return broken
        ? Promise.reject(new ModelError(ModelErrorCategory.SERVER, 'down', 500))
        : healthy.generate(modelRequest);
    },
  };
  return { port, breakIt: () => (broken = true) };
};

const chain = (...ports: ModelPort[]): FallbackCandidate[] =>
  ports.map((port, index) => ({ ref: { provider: 'stub', model: `model-${index}` }, port }));

describe('FallbackModelPort', () => {
  it.each([
    [ModelErrorCategory.TRANSPORT, undefined],
    [ModelErrorCategory.SERVER, 503],
    [ModelErrorCategory.RATE_LIMIT, 429],
  ])('falls back on %s errors before the first turn', async (category, status) => {
    const secondary = working();
    const port = new FallbackModelPort(chain(failing(category, status), secondary));

    const response = await port.generate(request());

    expect(response.stopReason).toBe(StopReason.TOOL_USE);
    expect(secondary.requests[0]?.model).toBe('model-1');
  });

  it.each([ModelErrorCategory.CLIENT, ModelErrorCategory.PROTOCOL])(
    'does not fall back on %s errors',
    async (category) => {
      const secondary = working();
      const port = new FallbackModelPort(chain(failing(category, 400), secondary));

      await expect(port.generate(request())).rejects.toBeInstanceOf(ModelError);
      expect(secondary.requests).toHaveLength(0);
    },
  );

  it('treats a refusal as a stop reason and never tries another model', async () => {
    const primary = new StubModelAdapter(createStubScript(StubScenario.REFUSAL));
    const secondary = working();
    const port = new FallbackModelPort(chain(primary, secondary));

    const response = await port.generate(request());

    expect(response.stopReason).toBe(StopReason.REFUSAL);
    expect(secondary.requests).toHaveLength(0);
  });

  it('stays on the model that answered the first turn', async () => {
    const calls: string[] = [];
    const { port: primary, breakIt } = succeedingOnce(calls);
    const secondary = working();
    const port = new FallbackModelPort(chain(primary, secondary));

    await port.generate(request());
    breakIt();
    await expect(port.generate(request())).rejects.toBeInstanceOf(ModelError);

    expect(secondary.requests).toHaveLength(0);
    expect(calls).toEqual(['model-0', 'model-0']);
  });

  it('stays on the fallback once it answered', async () => {
    const secondary = working();
    const port = new FallbackModelPort(chain(failing(ModelErrorCategory.TRANSPORT), secondary));

    await port.generate(request());
    await port.generate(request());

    expect(secondary.requests).toHaveLength(2);
  });

  it('does not fall back once the transcript has an assistant turn', async () => {
    const secondary = working();
    const port = new FallbackModelPort(chain(failing(ModelErrorCategory.TRANSPORT), secondary));

    await expect(
      port.generate(
        request({
          messages: [
            textMessage(MessageRole.USER, 'hello'),
            textMessage(MessageRole.ASSISTANT, 'partial'),
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(ModelError);
    expect(secondary.requests).toHaveLength(0);
  });

  it('throws the last error when the whole chain is exhausted', async () => {
    const port = new FallbackModelPort(
      chain(failing(ModelErrorCategory.TRANSPORT), failing(ModelErrorCategory.SERVER, 500)),
    );

    await expect(port.generate(request())).rejects.toMatchObject({
      category: ModelErrorCategory.SERVER,
    });
  });

  it('rejects an empty chain', () => {
    expect(() => new FallbackModelPort([])).toThrow(EmptyFallbackChainError);
  });
});
