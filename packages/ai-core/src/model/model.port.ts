import type { ModelCapabilities, ModelRequest, ModelResponse } from './model.types';

export interface ModelPort {
  readonly capabilities: ModelCapabilities;
  generate(request: ModelRequest): Promise<ModelResponse>;
}

export const MODEL_PORT = Symbol('MODEL_PORT');
