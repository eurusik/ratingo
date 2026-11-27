import type { InvestigationRecord } from '../entities/investigation-record';

export const CreateOutcome = { CREATED: 'created', EXISTS: 'exists' } as const;
export type CreateOutcome = (typeof CreateOutcome)[keyof typeof CreateOutcome];

export interface RequestStorePort {
  create(record: InvestigationRecord): Promise<CreateOutcome>;
  find(requestId: string): Promise<InvestigationRecord | null>;
  save(record: InvestigationRecord): Promise<void>;
}

export const REQUEST_STORE = Symbol('REQUEST_STORE');
