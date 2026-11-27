import type { InvestigationRecord } from '../entities/investigation-record';

export const CreateOutcome = { CREATED: 'created', EXISTS: 'exists' } as const;
export type CreateOutcome = (typeof CreateOutcome)[keyof typeof CreateOutcome];

export const FinishOutcome = { WRITTEN: 'written', KEPT_ANSWER: 'kept_answer' } as const;
export type FinishOutcome = (typeof FinishOutcome)[keyof typeof FinishOutcome];

export interface RequestStorePort {
  create(record: InvestigationRecord): Promise<CreateOutcome>;
  find(requestId: string): Promise<InvestigationRecord | null>;
  save(record: InvestigationRecord): Promise<void>;
  finish(record: InvestigationRecord): Promise<FinishOutcome>;
}

export const REQUEST_STORE = Symbol('REQUEST_STORE');
