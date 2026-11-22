import type { ValidatedFinding } from '../src/modules/review/domain/entities/finding';
import {
  ReviewStatus,
  type ReviewOutcome,
} from '../src/modules/review/domain/entities/review-outcome';

import type { EvalCase } from './eval-case';

interface DumpedFinding {
  file: string;
  line: number;
  severity: string;
  category: string;
  topic: string;
  kind: string;
  check_id: string | null;
  message: string;
  failure_scenario: string;
  impact: string;
  evidence: { path: string; line: number; excerpt: string };
}

export interface CaseDump {
  case_id: string;
  kind: string;
  expected_check_id: string | null;
  status: string;
  stop_reason: string | null;
  cost_usd: number;
  selected_check_ids: string[];
  reviewed_files: string[];
  core_files: string[];
  findings: DumpedFinding[];
  questions: DumpedFinding[];
  dropped: {
    reason: string;
    precedent: string | null;
    file: string;
    line: number;
    check_id: string | null;
  }[];
  coverage_gaps: string[];
}

const dumpFinding = (finding: ValidatedFinding): DumpedFinding => ({
  file: finding.file,
  line: finding.line,
  severity: finding.severity,
  category: finding.category,
  topic: finding.topic,
  kind: finding.kind,
  check_id: finding.checkId,
  message: finding.message,
  failure_scenario: finding.failureScenario,
  impact: finding.impact,
  evidence: finding.evidence,
});

export const buildCaseDump = (
  testCase: EvalCase,
  outcome: ReviewOutcome,
  selectedCheckIds: readonly string[],
): CaseDump => {
  const base = {
    core_files: [...(testCase.coreFiles ?? [])],
    case_id: testCase.id,
    kind: testCase.kind,
    expected_check_id: testCase.checkId ?? null,
    status: outcome.status,
    cost_usd: outcome.costUsd,
    selected_check_ids: [...selectedCheckIds].sort(),
  };
  if (outcome.status !== ReviewStatus.REVIEWED && outcome.status !== ReviewStatus.INCOMPLETE) {
    return {
      ...base,
      stop_reason: null,
      reviewed_files: [],
      findings: [],
      questions: [],
      dropped: [],
      coverage_gaps: [],
    };
  }
  return {
    ...base,
    stop_reason: outcome.stopReason,
    reviewed_files: outcome.reviewedFiles,
    findings: outcome.findings.map(dumpFinding),
    questions: outcome.questions.map(dumpFinding),
    dropped: outcome.dropped.map(({ finding, reason, precedent }) => ({
      reason,
      precedent: precedent ?? null,
      file: finding.file,
      line: finding.line,
      check_id: finding.checkId,
    })),
    coverage_gaps: outcome.coverage.gaps,
  };
};
