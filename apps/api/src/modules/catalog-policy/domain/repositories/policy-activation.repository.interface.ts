/**
 * Policy Activation Repository Interface
 *
 * Specialized repository for policy activation operations.
 * Encapsulates transactional operations that span multiple tables.
 */

import { type RunStatusType } from '../constants/evaluation.constants';

export const POLICY_ACTIVATION_REPOSITORY = Symbol('POLICY_ACTIVATION_REPOSITORY');

export interface SnapshotData {
  baselinePolicyVersion: number | null;
  totalReadySnapshot: number;
  snapshotCutoff: Date;
}

export interface CreateRunWithSnapshotInput {
  targetPolicyId: string;
  targetPolicyVersion: number;
}

export interface CreateRunWithSnapshotResult {
  runId: string;
  baselinePolicyVersion: number | null;
  totalReadySnapshot: number;
  snapshotCutoff: Date;
}

export interface PromoteRunInput {
  runId: string;
  targetPolicyId: string;
  newStatus: RunStatusType;
  promotedBy: string;
}

export interface IPolicyActivationRepository {
  /**
   * Creates a run with snapshot data in a single transaction.
   * Captures baseline policy version and media item count atomically.
   */
  createRunWithSnapshot(input: CreateRunWithSnapshotInput): Promise<CreateRunWithSnapshotResult>;

  /**
   * Promotes a run by activating policy and marking run as promoted atomically.
   * Prevents race condition where policy activates but run update fails.
   */
  promoteRun(input: PromoteRunInput): Promise<void>;

  /**
   * Counts ready media items for snapshot.
   * Used for backfill operations where run is created separately.
   */
  countReadyMediaItems(cutoffDate: Date): Promise<number>;
}
