import { ANTHROPIC_PROVIDER } from '../model/adapters/anthropic/anthropic.mapper';
import { createAnthropicModelAdapter } from '../model/adapters/anthropic/anthropic.model-adapter';
import type { ModelPort } from '../model/model.port';

const STUB_PROVIDER = 'stub';

export interface ModelProvidersConfig {
  stub: ModelPort;
  anthropicApiKey?: string;
  anthropicMaxRetries?: number;
}

export function createModelProviders(
  config: ModelProvidersConfig,
): Readonly<Record<string, ModelPort>> {
  const apiKey = config.anthropicApiKey?.trim();
  const anthropic = apiKey
    ? createAnthropicModelAdapter({
        apiKey,
        ...(config.anthropicMaxRetries === undefined
          ? {}
          : { maxRetries: config.anthropicMaxRetries }),
      })
    : config.stub;
  return { [STUB_PROVIDER]: config.stub, [ANTHROPIC_PROVIDER]: anthropic };
}
