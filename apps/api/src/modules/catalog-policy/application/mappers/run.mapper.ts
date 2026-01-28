/**
 * Run Mapper
 *
 * Maps evaluation run domain entities to presentation DTOs.
 * Centralizes mapping logic for RunController.
 */

import { type DiffReport, type DiffSample } from '../../domain/types/diff.types';
import { type RunStatus, type RunListItem } from '../services/policy-activation.service';

/**
 * Progress stats DTO structure.
 */
export interface ProgressStatsDto {
  processed: number;
  total: number;
  eligible: number;
  ineligible: number;
  errors: number;
}

/**
 * Evaluation run list item DTO.
 */
export interface EvaluationRunListDto {
  id: string;
  policyId: string;
  policyName: string;
  policyVersion: number;
  status: string;
  progress: ProgressStatsDto;
  startedAt: Date;
  finishedAt?: Date;
  readyToPromote: boolean;
}

/**
 * Error sample DTO structure.
 */
export interface ErrorSampleDto {
  mediaItemId: string;
  error: string;
  stack?: string;
  timestamp: string;
}

/**
 * Run status DTO structure.
 */
export interface RunStatusDto {
  id: string;
  targetPolicyId: string;
  targetPolicyVersion: number;
  status: string;
  progress: ProgressStatsDto;
  startedAt: Date;
  finishedAt?: Date;
  promotedAt?: Date;
  promotedBy?: string;
  readyToPromote: boolean;
  blockingReasons: string[];
  coverage: number;
  errorSample: ErrorSampleDto[];
}

/**
 * Diff sample DTO structure.
 */
export interface DiffSampleDto {
  mediaItemId: string;
  title: string;
  reason: string;
}

/**
 * Diff counts DTO structure.
 */
export interface DiffCountsDto {
  regressions: number;
  improvements: number;
  netChange: number;
}

/**
 * Diff report DTO structure.
 */
export interface DiffReportDto {
  runId: string;
  targetPolicyVersion: number;
  currentPolicyVersion?: number;
  counts: DiffCountsDto;
  topRegressions: DiffSampleDto[];
  topImprovements: DiffSampleDto[];
  reasonBreakdown?: {
    regressionReasons: Record<string, number>;
    improvementReasons: Record<string, number>;
  };
}

const UNKNOWN_TITLE = 'Unknown';

/**
 * Maps evaluation run entities to presentation DTOs.
 */
export const RunMapper = {
  /**
   * Maps run list item to DTO.
   */
  toListDto(run: RunListItem): EvaluationRunListDto {
    return {
      id: run.id,
      policyId: run.policyId,
      policyName: run.policyName,
      policyVersion: run.policyVersion,
      status: run.status,
      progress: run.progress,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      readyToPromote: run.readyToPromote,
    };
  },

  /**
   * Maps multiple run list items to DTOs.
   */
  toListDtos(runs: RunListItem[]): EvaluationRunListDto[] {
    return runs.map(RunMapper.toListDto);
  },

  /**
   * Maps run status to DTO.
   */
  toStatusDto(status: RunStatus): RunStatusDto {
    return {
      id: status.id,
      targetPolicyId: status.targetPolicyId,
      targetPolicyVersion: status.targetPolicyVersion,
      status: status.status,
      progress: {
        processed: status.processed,
        total: status.totalReadySnapshot,
        eligible: status.eligible,
        ineligible: status.ineligible,
        errors: status.errors,
      },
      startedAt: status.startedAt,
      ...(status.finishedAt && { finishedAt: status.finishedAt }),
      ...(status.promotedAt && { promotedAt: status.promotedAt }),
      ...(status.promotedBy && { promotedBy: status.promotedBy }),
      readyToPromote: status.readyToPromote,
      blockingReasons: status.blockingReasons,
      coverage: status.coverage,
      errorSample: [] as ErrorSampleDto[], // Not yet exposed via RunStatus interface
    };
  },

  /**
   * Maps diff report to DTO.
   */
  toDiffReportDto(report: DiffReport): DiffReportDto {
    return {
      runId: report.runId,
      targetPolicyVersion: report.targetPolicyVersion,
      ...(report.currentPolicyVersion !== null && {
        currentPolicyVersion: report.currentPolicyVersion,
      }),
      counts: {
        regressions: report.counts.regressions,
        improvements: report.counts.improvements,
        netChange: RunMapper.calculateNetChange(
          report.counts.improvements,
          report.counts.regressions,
        ),
      },
      topRegressions: report.topRegressions.map(RunMapper.toDiffSampleDto),
      topImprovements: report.topImprovements.map(RunMapper.toDiffSampleDto),
      ...(report.reasonBreakdown && { reasonBreakdown: report.reasonBreakdown }),
    };
  },

  /**
   * Maps diff sample to DTO.
   */
  toDiffSampleDto(sample: DiffSample): DiffSampleDto {
    return {
      mediaItemId: sample.mediaItemId,
      title: sample.title ?? UNKNOWN_TITLE,
      reason: RunMapper.formatStatusChangeReason(sample.oldStatus, sample.newStatus),
    };
  },

  /**
   * Calculates net change from improvements and regressions.
   */
  calculateNetChange(improvements: number, regressions: number): number {
    return improvements - regressions;
  },

  /**
   * Formats status change as human-readable reason.
   */
  formatStatusChangeReason(oldStatus: string, newStatus: string): string {
    return `Status change: ${oldStatus} → ${newStatus}`;
  },
};
