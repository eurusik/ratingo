import {
  AnswerSupport,
  InvestigationStatus,
  type InvestigationOutcome,
} from '../../investigation/public';
import { RECORD_VERSION, RequestState } from '../domain/constants/request.constants';
import type { InvestigationRecord } from '../domain/entities/investigation-record';
import type { DayLimitsPort } from '../domain/ports/day-limits.port';
import type {
  InvestigationQueuePort,
  QueuedInvestigation,
} from '../domain/ports/investigation-queue.port';
import {
  CreateOutcome,
  FinishOutcome,
  type RequestStorePort,
} from '../domain/ports/request-store.port';

export const NOW_MS = Date.UTC(2026, 10, 27, 12, 0, 0);

export class InMemoryRequestStore implements RequestStorePort {
  readonly records = new Map<string, InvestigationRecord>();

  async create(record: InvestigationRecord): Promise<CreateOutcome> {
    if (this.records.has(record.requestId)) return CreateOutcome.EXISTS;
    this.records.set(record.requestId, record);
    return CreateOutcome.CREATED;
  }

  async find(requestId: string): Promise<InvestigationRecord | null> {
    return this.records.get(requestId) ?? null;
  }

  async seed(record: InvestigationRecord): Promise<void> {
    this.records.set(record.requestId, record);
  }

  async transition(record: InvestigationRecord, from: readonly RequestState[]): Promise<boolean> {
    const current = this.records.get(record.requestId);
    if (current === undefined || !from.includes(current.state)) return false;
    this.records.set(record.requestId, record);
    return true;
  }

  async finish(record: InvestigationRecord): Promise<FinishOutcome> {
    if (this.records.get(record.requestId)?.state === RequestState.ANSWERED) {
      return FinishOutcome.KEPT_ANSWER;
    }
    this.records.set(record.requestId, record);
    return FinishOutcome.WRITTEN;
  }
}

export class RecordingQueue implements InvestigationQueuePort {
  readonly jobs: QueuedInvestigation[] = [];
  waiting = 0;
  failWith: Error | null = null;

  async enqueue(job: QueuedInvestigation): Promise<void> {
    if (this.failWith !== null) throw this.failWith;
    if (this.jobs.some((queued) => queued.requestId === job.requestId)) return;
    this.jobs.push(job);
  }

  async waitingCount(): Promise<number> {
    return this.waiting;
  }
}

export class FakeDayLimits implements DayLimitsPort {
  spent = 0;
  accepted = 0;
  budget = 1.5;
  max = 10;

  async spentTodayUsd(): Promise<number> {
    return this.spent;
  }

  dayBudgetUsd(): number {
    return this.budget;
  }

  async acceptedToday(): Promise<number> {
    return this.accepted;
  }

  async countAccepted(): Promise<void> {
    this.accepted += 1;
  }

  maxPerDay(): number {
    return this.max;
  }
}

export const queuedRecord = (
  overrides: Partial<InvestigationRecord> = {},
): InvestigationRecord => ({
  version: RECORD_VERSION,
  requestId: 'tg1000001',
  question: 'Why does sync-show time out?',
  ref: 'main',
  state: RequestState.QUEUED,
  createdAtMs: NOW_MS,
  ...overrides,
});

export const answeredOutcome = (
  overrides: Partial<InvestigationOutcome> = {},
): InvestigationOutcome => ({
  status: InvestigationStatus.ANSWERED,
  ref: 'main',
  commit: 'a'.repeat(40),
  answer: {
    answer: 'The timeout is set in the TMDB client.',
    facts: [
      {
        text: 'The client sets a 10 second timeout.',
        citations: [{ path: 'apps/api/src/tmdb.ts', startLine: 10, endLine: 12 }],
        evidence: [],
      },
    ],
    assumptions: [],
    unknowns: [],
    support: AnswerSupport.SUPPORTED,
  },
  runId: 'run-1',
  stopReason: 'end',
  stopDetail: null,
  turns: 7,
  costUsd: 0.08,
  toolCalls: {},
  pathsRead: [],
  snapshotFailure: null,
  ...overrides,
});
