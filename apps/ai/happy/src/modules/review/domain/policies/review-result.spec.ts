import { trackingOf } from '../../infrastructure/testing/outcome.testing';
import * as fc from 'fast-check';

import { CheckVoice } from '../constants/check-voice.constants';
import { FindingKind, FindingTopic } from '../constants/finding-classification.constants';
import {
  MAX_CHECK_SUMMARY_CHARS,
  MAX_RESULT_QUESTIONS,
} from '../constants/review-limits.constants';
import { FindingCategory, SEVERITY_ORDER, Severity } from '../constants/severity.constants';
import { SkipReason } from '../constants/skip-patterns.constants';
import type { ValidatedFinding } from '../entities/finding';
import { CoverageGap, ReviewStatus, type CompletedReview } from '../entities/review-outcome';

import { buildCheckReport } from './check-report';
import { RESULT_MARKER_PREFIX, buildResultSnapshot, renderResultMarker } from './review-result';

const finding = (
  severity: Severity,
  kind: FindingKind = FindingKind.FINDING,
): ValidatedFinding => ({
  file: 'src/a.ts',
  line: 4,
  severity,
  category: FindingCategory.CORRECTNESS,
  topic: FindingTopic.LOGIC,
  kind,
  checkId: null,
  failureScenario: 's',
  impact: 'i',
  message: 'Повідомлення з [посиланням](https://evil.example) та @happy',
  evidence: { path: 'src/a.ts', line: 4, excerpt: 'const value = 1;' },
  fingerprint: 'f',
});

const completed = (overrides: Partial<CompletedReview> = {}): CompletedReview => {
  const merged = completedBase(overrides);
  return {
    ...merged,
    tracking: overrides.tracking ?? trackingOf(merged.findings, merged.questions),
  };
};

const completedBase = (overrides: Partial<CompletedReview>): Omit<CompletedReview, 'tracking'> => ({
  status: ReviewStatus.REVIEWED,
  ref: { owner: 'a', repo: 'b', number: 3 },
  headSha: 'abcdef1234',
  summary: 'Підсумок',
  findings: [],
  questions: [],
  dropped: [],
  reviewedFiles: ['src/a.ts'],
  coverage: { unreviewedFiles: [], gaps: [] },
  stopReason: 'end',
  budgetExhausted: false,
  costUsd: 0.01,
  markdown: '## ok',
  ...overrides,
});

describe('buildResultSnapshot', () => {
  it('counts findings per severity exactly', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...SEVERITY_ORDER), { maxLength: 30 }), (severities) => {
        const snapshot = buildResultSnapshot(
          completed({ findings: severities.map((s) => finding(s)) }),
        );
        return SEVERITY_ORDER.every(
          (severity) =>
            snapshot.counts[severity] === severities.filter((s) => s === severity).length,
        );
      }),
    );
  });

  it('caps and cleans questions', () => {
    const questions = Array.from({ length: 9 }, () =>
      finding(Severity.MINOR, FindingKind.QUESTION),
    );
    const snapshot = buildResultSnapshot(completed({ questions }));
    expect(snapshot.questions).toHaveLength(MAX_RESULT_QUESTIONS);
    expect(snapshot.questions[0]?.text).not.toContain('evil.example');
  });

  it('reports incomplete coverage with the gap count', () => {
    const snapshot = buildResultSnapshot(
      completed({ coverage: { unreviewedFiles: ['a', 'b'], gaps: [CoverageGap.TOOL_FAILED] } }),
    );
    expect(snapshot.coverage).toEqual({
      complete: false,
      unreviewedFiles: 2,
      gaps: [CoverageGap.TOOL_FAILED],
    });
  });

  it('keeps the skip reason and the voice line of a skipped review', () => {
    const snapshot = buildResultSnapshot({
      status: ReviewStatus.SKIPPED,
      ref: { owner: 'a', repo: 'b', number: 3 },
      headSha: 'abc',
      reason: SkipReason.TRIVIAL,
      costUsd: 0,
      markdown: '',
    });
    expect(snapshot).toMatchObject({
      status: 'skipped',
      skipReason: 'trivial',
      title: CheckVoice.TRIVIAL,
    });
  });
});

describe('check report with the result marker', () => {
  it('keeps the voice line first and the marker last, within the size limit', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }),
        fc.integer({ min: 0, max: 80_000 }),
        (summary, size) => {
          const report = buildCheckReport(
            completed({ summary, markdown: 'x'.repeat(size), findings: [finding(Severity.MAJOR)] }),
          );
          return (
            report.summary.startsWith(CheckVoice.MAJOR) &&
            report.summary.length <= MAX_CHECK_SUMMARY_CHARS &&
            report.summary.trimEnd().endsWith('-->') &&
            report.summary.includes(RESULT_MARKER_PREFIX)
          );
        },
      ),
    );
  });

  it('renders no marker when the snapshot would be too large', () => {
    const huge = { ...buildResultSnapshot(completed()), title: 'я'.repeat(20_000) };
    expect(renderResultMarker(huge)).toBe('');
  });
});
