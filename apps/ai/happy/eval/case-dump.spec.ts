import {
  FindingKind,
  FindingTopic,
} from '../src/modules/review/domain/constants/finding-classification.constants';
import {
  FindingCategory,
  Severity,
} from '../src/modules/review/domain/constants/severity.constants';
import {
  FindingDropReason,
  type ValidatedFinding,
} from '../src/modules/review/domain/entities/finding';
import {
  ReviewStatus,
  type ReviewOutcome,
} from '../src/modules/review/domain/entities/review-outcome';

import { trackingOf } from '../src/modules/review/infrastructure/testing/outcome.testing';
import { buildCaseDump } from './case-dump';
import { EvalKind, type EvalCase } from './eval-case';

const CASE: EvalCase = {
  id: 'c',
  kind: EvalKind.PROTECTED_NEGATIVE,
  title: 't',
  path: 'a.ts',
  lines: ['x'],
  checkId: 'race',
};

const finding: ValidatedFinding = {
  file: 'a.ts',
  line: 3,
  severity: Severity.MAJOR,
  category: FindingCategory.CORRECTNESS,
  topic: FindingTopic.LOGIC,
  kind: FindingKind.FINDING,
  checkId: 'race',
  failureScenario: 'two requests pass the check',
  impact: 'duplicate rows',
  message: 'Гонка',
  evidence: { path: 'a.ts', line: 3, excerpt: 'const a = 1;' },
  fingerprint: 'f',
};

const reviewedQuestion = { ...finding, kind: FindingKind.QUESTION, checkId: null };

const reviewed: ReviewOutcome = {
  status: ReviewStatus.REVIEWED,
  ref: { owner: 'eval', repo: 'cases', number: 1 },
  headSha: 'h',
  summary: 's',
  findings: [finding],
  questions: [reviewedQuestion],
  tracking: trackingOf([finding], [reviewedQuestion]),
  dropped: [{ finding, reason: FindingDropReason.NOT_A_BUG, precedent: 'env-vars-trusted' }],
  reviewedFiles: ['a.ts'],
  coverage: { unreviewedFiles: [], gaps: [] },
  stopReason: 'end',
  budgetExhausted: false,
  costUsd: 0.02,
  markdown: 'm',
};

describe('buildCaseDump', () => {
  it('keeps what the model said per finding with snake_case keys and sorted check ids', () => {
    const dump = buildCaseDump(CASE, reviewed, ['upsert', 'race']);
    expect(dump).toMatchObject({
      case_id: 'c',
      expected_check_id: 'race',
      selected_check_ids: ['race', 'upsert'],
      stop_reason: 'end',
      findings: [
        {
          check_id: 'race',
          failure_scenario: 'two requests pass the check',
          impact: 'duplicate rows',
          line: 3,
        },
      ],
      questions: [{ check_id: null, kind: 'question' }],
      dropped: [{ reason: 'not_a_bug', precedent: 'env-vars-trusted', check_id: 'race' }],
    });
  });

  it('is empty for a skipped review and never carries markdown or environment values', () => {
    const skipped: ReviewOutcome = {
      status: ReviewStatus.SKIPPED,
      ref: reviewed.ref,
      headSha: 'h',
      reason: 'trivial',
      costUsd: 0,
      markdown: 'secret-looking text',
    };
    const dump = buildCaseDump(CASE, skipped, []);
    expect(dump.findings).toEqual([]);
    expect(JSON.stringify(dump)).not.toContain('secret-looking text');
    expect(JSON.stringify(buildCaseDump(CASE, reviewed, []))).not.toContain('"m"');
  });
});
