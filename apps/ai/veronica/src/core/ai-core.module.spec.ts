import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { InMemoryRunRepository, RUN_REPOSITORY, type ModelProviders } from '@ratingo/ai-core';

import { ANTHROPIC_CONFIG, MODEL_ALIASES } from '../config/config.constants';

import { AGENT_LOOP, AGENT_LOOP_FACTORY, MODEL_PROVIDERS } from './ai-core.constants';
import { AiCoreModule } from './ai-core.module';

const wiring = (anthropicApiKey: string | undefined, fast: string) => {
  @Global()
  @Module({
    providers: [
      { provide: ANTHROPIC_CONFIG, useValue: { apiKey: anthropicApiKey } },
      { provide: MODEL_ALIASES, useValue: { fast: [fast] } },
      { provide: RUN_REPOSITORY, useValue: new InMemoryRunRepository() },
    ],
    exports: [ANTHROPIC_CONFIG, MODEL_ALIASES, RUN_REPOSITORY],
  })
  class TestConfigModule {}
  return Test.createTestingModule({ imports: [TestConfigModule, AiCoreModule] }).compile();
};

const FIRST_LOAD_TIMEOUT_MS = 30_000;

describe('AiCoreModule model providers', () => {
  it(
    'registers anthropic for the fast alias when the key is set, for the digest and the chat alike',
    async () => {
      const app = await wiring('sk-test', 'anthropic:claude-haiku-5-5');
      const providers = app.get<ModelProviders>(MODEL_PROVIDERS);
      expect(Object.keys(providers).sort()).toEqual(['anthropic', 'stub']);
      expect(app.get(AGENT_LOOP)).toBeDefined();
      expect(app.get(AGENT_LOOP_FACTORY)).toBeInstanceOf(Function);
    },
    FIRST_LOAD_TIMEOUT_MS,
  );

  it('refuses to boot when the fast alias needs anthropic and no key is set', async () => {
    await expect(wiring(undefined, 'anthropic:claude-haiku-5-5')).rejects.toThrow(
      /ANTHROPIC_API_KEY/,
    );
    await expect(wiring('   ', 'anthropic:claude-haiku-5-5')).rejects.toThrow(/not registered/);
  });

  it('boots on the stub without a key', async () => {
    const app = await wiring(undefined, 'stub:digest');
    expect(Object.keys(app.get<ModelProviders>(MODEL_PROVIDERS))).toEqual(['stub']);
  });
});
