import type { DumeLookup, DumeSubmission, DumeSubmitResult } from '../entities/dume';

export const DUME_CLIENT = Symbol('DUME_CLIENT');

export interface DumeClientPort {
  submit(submission: DumeSubmission): Promise<DumeSubmitResult>;
  find(requestId: string): Promise<DumeLookup>;
}

export class DumeUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(`DUM-E is unavailable: ${reason}`);
    this.name = 'DumeUnavailableError';
  }
}
