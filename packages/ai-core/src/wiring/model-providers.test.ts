import { AnthropicModelAdapter } from '../model/adapters/anthropic/anthropic.model-adapter';
import { StubModelAdapter } from '../model/adapters/stub/stub.model-adapter';
import { StubScenario, createStubScript } from '../model/adapters/stub/stub.scenarios';
import {
  UnregisteredModelProviderError,
  assertAliasProvidersRegistered,
  createModelProviders,
} from './model-providers';

const SECRET = 'sk-ant-test-secret';
const stub = new StubModelAdapter(createStubScript(StubScenario.NORMAL));

describe('createModelProviders', () => {
  it.each([undefined, '', '   '])('registers only the stub when the key is %p', (key) => {
    const providers = createModelProviders({ stub, anthropicApiKey: key });

    expect(Object.keys(providers)).toEqual(['stub']);
    expect(providers['stub']).toBe(stub);
  });

  it('registers the stub and the real Anthropic adapter when a key is set', () => {
    const providers = createModelProviders({ stub, anthropicApiKey: SECRET });

    expect(Object.keys(providers).sort()).toEqual(['anthropic', 'stub']);
    expect(providers['anthropic']).toBeInstanceOf(AnthropicModelAdapter);
    expect(providers['stub']).toBe(stub);
  });
});

describe('assertAliasProvidersRegistered', () => {
  it('accepts aliases whose providers are registered', () => {
    expect(() =>
      assertAliasProvidersRegistered(
        { fast: ['anthropic:claude-haiku-5-5', 'stub:digest'] },
        createModelProviders({ stub, anthropicApiKey: SECRET }),
      ),
    ).not.toThrow();
    expect(() =>
      assertAliasProvidersRegistered({ fast: ['stub:digest'] }, createModelProviders({ stub })),
    ).not.toThrow();
  });

  it('rejects an Anthropic model without a key and never leaks a secret', () => {
    const providers = createModelProviders({ stub });
    const act = () =>
      assertAliasProvidersRegistered({ fast: ['anthropic:claude-haiku-5-5'] }, providers);

    expect(act).toThrow(UnregisteredModelProviderError);
    expect(act).toThrow(/ANTHROPIC_API_KEY/);
    expect(act).not.toThrow(new RegExp(SECRET));
  });

  it('rejects an unknown provider in any position of the chain', () => {
    expect(() =>
      assertAliasProvidersRegistered(
        { fast: ['stub:digest', 'openai:gpt'] },
        createModelProviders({ stub, anthropicApiKey: SECRET }),
      ),
    ).toThrow(/provider "openai"/);
  });

  it('checks every alias, not only the first', () => {
    expect(() =>
      assertAliasProvidersRegistered(
        { fast: ['stub:a'], review: ['anthropic:claude-sonnet-5-5'] },
        createModelProviders({ stub }),
      ),
    ).toThrow(/alias "review"/);
  });
});
