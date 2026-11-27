export interface QueuedInvestigation {
  requestId: string;
}

export interface InvestigationQueuePort {
  enqueue(job: QueuedInvestigation): Promise<void>;
  waitingCount(): Promise<number>;
}

export const INVESTIGATION_QUEUE = Symbol('INVESTIGATION_QUEUE');
