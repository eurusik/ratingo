import { AnthropicModelAdapter } from '../model/adapters/anthropic/anthropic.model-adapter';
import { StubModelAdapter } from '../model/adapters/stub/stub.model-adapter';
import { StubScenario, createStubScript } from '../model/adapters/stub/stub.scenarios';
import { createModelProviders } from './model-providers';

const stub = new StubModelAdapter(createStubScript(StubScenario.NORMAL));

describe('createModelProviders', () => {
  it.each([undefined, '', '   '])(
    'serves the anthropic provider from the stub when the key is %p',
    (key) => {
      const providers = createModelProviders({ stub, anthropicApiKey: key });

      expect(providers['anthropic']).toBe(stub);
      expect(providers['stub']).toBe(stub);
    },
  );

  it('serves the anthropic provider from the real adapter when a key is set', () => {
    const providers = createModelProviders({ stub, anthropicApiKey: 'sk-test' });

    expect(providers['anthropic']).toBeInstanceOf(AnthropicModelAdapter);
    expect(providers['stub']).toBe(stub);
  });
});
