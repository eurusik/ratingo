import type { HappyLookup, HappyReviewRequest } from '../entities/happy';

export const HAPPY_CLIENT = Symbol('HAPPY_CLIENT');

export interface HappyClientPort {
  requestReview(pullNumber: number): Promise<HappyReviewRequest>;
  latestResult(pullNumber: number): Promise<HappyLookup>;
}

export class HappyUnavailableError extends Error {
  constructor(reason: string) {
    super(`Happy is unavailable: ${reason}`);
    this.name = 'HappyUnavailableError';
  }
}
