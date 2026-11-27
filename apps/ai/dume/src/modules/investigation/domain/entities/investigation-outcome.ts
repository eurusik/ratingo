import type { SnapshotFailure } from '../errors/investigation.errors';
import type { VerifiedAnswer } from './investigation-answer';

export const InvestigationStatus = {
  ANSWERED: 'answered',
  UNANSWERED: 'unanswered',
  SNAPSHOT_UNAVAILABLE: 'snapshot_unavailable',
} as const;
export type InvestigationStatus = (typeof InvestigationStatus)[keyof typeof InvestigationStatus];

export interface InvestigationOutcome {
  status: InvestigationStatus;
  ref: string;
  commit: string | null;
  answer: VerifiedAnswer | null;
  runId: string | null;
  stopReason: string | null;
  stopDetail: string | null;
  turns: number;
  costUsd: number;
  toolCalls: Readonly<Record<string, number>>;
  pathsRead: readonly string[];
  snapshotFailure: SnapshotFailure | null;
}
