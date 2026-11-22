import { StubModelAdapter, type ModelPort } from '@ratingo/ai-core';

import {
  UnregisteredModelProviderError,
  assertAliasProvidersRegistered,
  buildModelProviders,
} from './model-providers';
import { createDigestStubScript } from './stub-digest.script';

const SECRET = 'sk-ant-test-secret';

describe('model providers', () => {
  const stub: ModelPort = new StubModelAdapter(createDigestStubScript());

  it('registers only the stub without an Anthropic key', () => {
    expect(Object.keys(buildModelProviders(stub, undefined))).toEqual(['stub']);
    expect(Object.keys(buildModelProviders(stub, '  '))).toEqual(['stub']);
  });

  it('registers the stub and Anthropic with a key', () => {
    const providers = buildModelProviders(stub, SECRET);
    expect(Object.keys(providers).sort()).toEqual(['anthropic', 'stub']);
    expect(providers.stub).toBe(stub);
  });

  it('accepts aliases whose providers are registered', () => {
    expect(() =>
      assertAliasProvidersRegistered(
        { fast: ['anthropic:claude-haiku-5-5', 'stub:digest'] },
        buildModelProviders(stub, SECRET),
      ),
    ).not.toThrow();
    expect(() =>
      assertAliasProvidersRegistered(
        { fast: ['stub:digest'] },
        buildModelProviders(stub, undefined),
      ),
    ).not.toThrow();
  });

  it('rejects an Anthropic model without a key and never leaks a secret', () => {
    const providers = buildModelProviders(stub, undefined);
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
        buildModelProviders(stub, SECRET),
      ),
    ).toThrow(/provider "openai"/);
  });
});
