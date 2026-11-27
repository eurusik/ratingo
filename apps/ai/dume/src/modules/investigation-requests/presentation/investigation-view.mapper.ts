import type { InvestigationRecord } from '../domain/entities/investigation-record';

export interface RequestView {
  requestId: string;
  state: InvestigationRecord['state'];
  reason?: InvestigationRecord['reason'];
  createdAtMs: number;
  startedAtMs?: number;
  finishedAtMs?: number;
  result?: InvestigationRecord['result'];
}

export const toRequestView = (record: InvestigationRecord): RequestView => ({
  requestId: record.requestId,
  state: record.state,
  ...(record.reason === undefined ? {} : { reason: record.reason }),
  createdAtMs: record.createdAtMs,
  ...(record.startedAtMs === undefined ? {} : { startedAtMs: record.startedAtMs }),
  ...(record.finishedAtMs === undefined ? {} : { finishedAtMs: record.finishedAtMs }),
  ...(record.result === undefined ? {} : { result: record.result }),
});
