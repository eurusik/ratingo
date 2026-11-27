import type { DumeLookup, DumeSubmission, DumeSubmitResult } from '../entities/dume';

export const DUME_CLIENT = Symbol('DUME_CLIENT');

export interface DumeClientPort {
  submit(submission: DumeSubmission): Promise<DumeSubmitResult>;
  find(requestId: string): Promise<DumeLookup>;
}

export const StartCertainty = {
  NEVER_STARTED: 'never_started',
  MAYBE_STARTED: 'maybe_started',
} as const;
export type StartCertainty = (typeof StartCertainty)[keyof typeof StartCertainty];

export class DumeUnavailableError extends Error {
  constructor(
    readonly reason: string,
    readonly certainty: StartCertainty = StartCertainty.NEVER_STARTED,
  ) {
    super(`DUM-E is unavailable: ${reason}`);
    this.name = 'DumeUnavailableError';
  }
}
