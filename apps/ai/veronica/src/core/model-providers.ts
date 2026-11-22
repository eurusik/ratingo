import {
  createAnthropicModelAdapter,
  resolveModelChain,
  type ModelAliases,
  type ModelPort,
} from '@ratingo/ai-core';

import { ANTHROPIC_PROVIDER, STUB_PROVIDER } from '../config/models.config';

export type RegisteredProviders = Readonly<Record<string, ModelPort>>;

export class UnregisteredModelProviderError extends Error {
  constructor(alias: string, provider: string, registered: readonly string[]) {
    const hint =
      provider === ANTHROPIC_PROVIDER ? ' Set ANTHROPIC_API_KEY or change the model.' : '';
    super(
      `Model alias "${alias}" uses provider "${provider}", which is not registered ` +
        `(registered: ${registered.join(', ')}).${hint}`,
    );
    this.name = 'UnregisteredModelProviderError';
  }
}

export const buildModelProviders = (
  stub: ModelPort,
  anthropicApiKey: string | undefined,
): RegisteredProviders => {
  const apiKey = anthropicApiKey?.trim();
  return {
    [STUB_PROVIDER]: stub,
    ...(apiKey ? { [ANTHROPIC_PROVIDER]: createAnthropicModelAdapter({ apiKey }) } : {}),
  };
};

export const assertAliasProvidersRegistered = (
  aliases: ModelAliases,
  providers: RegisteredProviders,
): void => {
  const registered = Object.keys(providers);
  for (const alias of Object.keys(aliases)) {
    for (const ref of resolveModelChain(alias, aliases)) {
      if (!Object.hasOwn(providers, ref.provider)) {
        throw new UnregisteredModelProviderError(alias, ref.provider, registered);
      }
    }
  }
};
