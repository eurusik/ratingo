import { ANTHROPIC_PROVIDER } from '../model/adapters/anthropic/anthropic.mapper';
import { createAnthropicModelAdapter } from '../model/adapters/anthropic/anthropic.model-adapter';
import type { ModelPort } from '../model/model.port';
import type { ModelAliases } from '../model/model-ref';
import { resolveModelChain } from '../model/model-ref';

const STUB_PROVIDER = 'stub';

export type RegisteredProviders = Readonly<Record<string, ModelPort>>;

export interface ModelProvidersConfig {
  stub: ModelPort;
  anthropicApiKey?: string;
  anthropicMaxRetries?: number;
}

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

export function createModelProviders(config: ModelProvidersConfig): RegisteredProviders {
  const apiKey = config.anthropicApiKey?.trim();
  return {
    [STUB_PROVIDER]: config.stub,
    ...(apiKey
      ? {
          [ANTHROPIC_PROVIDER]: createAnthropicModelAdapter({
            apiKey,
            ...(config.anthropicMaxRetries === undefined
              ? {}
              : { maxRetries: config.anthropicMaxRetries }),
          }),
        }
      : {}),
  };
}

export function assertAliasProvidersRegistered(
  aliases: ModelAliases,
  providers: RegisteredProviders,
): void {
  const registered = Object.keys(providers);
  for (const alias of Object.keys(aliases)) {
    for (const ref of resolveModelChain(alias, aliases)) {
      if (!Object.hasOwn(providers, ref.provider)) {
        throw new UnregisteredModelProviderError(alias, ref.provider, registered);
      }
    }
  }
}
