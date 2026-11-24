import { isFallbackEligible } from './model.errors';
import type { ModelRef } from './model-ref';
import type { ModelPort } from './model.port';
import type { ModelCapabilities, ModelRequest, ModelResponse } from './model.types';
import { MessageRole } from './model.types';

export interface FallbackCandidate {
  ref: ModelRef;
  port: ModelPort;
}

export class EmptyFallbackChainError extends Error {
  constructor() {
    super('A fallback chain needs at least one model');
    this.name = 'EmptyFallbackChainError';
  }
}

class FallbackChainExhaustedError extends Error {
  constructor() {
    super('Every model in the fallback chain was tried');
    this.name = 'FallbackChainExhaustedError';
  }
}

export class FallbackModelPort implements ModelPort {
  readonly capabilities: ModelCapabilities;
  private activeIndex = 0;
  private committed = false;

  constructor(private readonly chain: readonly FallbackCandidate[]) {
    const primary = chain[0];
    if (primary === undefined) {
      throw new EmptyFallbackChainError();
    }
    this.capabilities = primary.port.capabilities;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    for (;;) {
      const candidate = this.activeCandidate();
      try {
        const response = await candidate.port.generate({ ...request, model: candidate.ref.model });
        this.committed = true;
        return response;
      } catch (error) {
        if (!this.canFallBack(request, error)) {
          throw error;
        }
        this.activeIndex += 1;
      }
    }
  }

  private activeCandidate(): FallbackCandidate {
    const candidate = this.chain[this.activeIndex];
    if (candidate === undefined) {
      throw new FallbackChainExhaustedError();
    }
    return candidate;
  }

  private canFallBack(request: ModelRequest, error: unknown): boolean {
    const isFirstTurn =
      !this.committed && request.messages.every((message) => message.role === MessageRole.USER);
    return isFirstTurn && isFallbackEligible(error) && this.activeIndex + 1 < this.chain.length;
  }
}
