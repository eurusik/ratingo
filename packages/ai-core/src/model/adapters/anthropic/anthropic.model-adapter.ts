import Anthropic from '@anthropic-ai/sdk';
import type { ModelPort } from '../../model.port';
import type { ModelCapabilities, ModelRequest, ModelResponse } from '../../model.types';
import {
  fromAnthropicMessage,
  toAnthropicRequest,
  translateProviderError,
} from './anthropic.mapper';

const ANTHROPIC_MAX_RETRIES = 0;
const SDK_RETRIES_DISABLED = 0;

export interface AnthropicAdapterConfig {
  apiKey: string;
  maxRetries?: number;
  fetch?: typeof fetch;
}

const ANTHROPIC_CAPABILITIES: ModelCapabilities = {
  promptCaching: true,
  thinking: true,
  images: true,
  structuredOutput: true,
};

export class AnthropicModelAdapter implements ModelPort {
  readonly capabilities = ANTHROPIC_CAPABILITIES;

  constructor(
    private readonly client: Anthropic,
    private readonly maxRetries: number = ANTHROPIC_MAX_RETRIES,
  ) {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    try {
      const message = await this.client.messages.create(toAnthropicRequest(request), {
        timeout: request.timeoutMs,
        maxRetries: this.maxRetries,
      });
      return fromAnthropicMessage(message, request.model);
    } catch (error) {
      throw translateProviderError(error);
    }
  }
}

export function createAnthropicModelAdapter(config: AnthropicAdapterConfig): AnthropicModelAdapter {
  const client = new Anthropic({
    apiKey: config.apiKey,
    maxRetries: SDK_RETRIES_DISABLED,
    ...(config.fetch === undefined ? {} : { fetch: config.fetch }),
  });
  return new AnthropicModelAdapter(client, config.maxRetries);
}
