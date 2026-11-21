import type { ModelPort } from '../../model.port';
import type { ModelCapabilities, ModelRequest, ModelResponse } from '../../model.types';
import type { StubScript } from './stub.scenarios';

const STUB_CAPABILITIES: ModelCapabilities = {
  promptCaching: false,
  thinking: false,
  images: false,
  structuredOutput: true,
};

export class StubModelAdapter implements ModelPort {
  readonly capabilities = STUB_CAPABILITIES;
  readonly requests: ModelRequest[] = [];

  constructor(private readonly script: StubScript) {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const callIndex = this.requests.length;
    this.requests.push(request);
    return this.script.respond(request, callIndex);
  }
}
