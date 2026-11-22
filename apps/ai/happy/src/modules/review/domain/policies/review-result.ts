import {
  MAX_RESULT_MARKER_CHARS,
  MAX_RESULT_QUESTIONS,
  MAX_RESULT_QUESTION_CHARS,
  MAX_RESULT_SUMMARY_CHARS,
  MAX_RESULT_TITLE_CHARS,
  RESULT_MARKER_VERSION,
} from '../constants/review-limits.constants';
import { SEVERITY_ORDER, type Severity } from '../constants/severity.constants';
import type { ReviewOutcome } from '../entities/review-outcome';
import { ReviewMode, type ReviewScope } from '../entities/review-scope';
import type { TrackedFinding } from '../entities/tracked-finding';
import { ReviewStatus } from '../entities/review-outcome';
import type {
  ResultCoverage,
  ResultScope,
  ResultTracking,
  ReviewResultSnapshot,
} from '../entities/review-result';

import { toBase64Url } from './base64url';
import { checkVoiceLine } from './check-voice';
import { countStatuses, openFindings, openQuestions } from './finding-tracking';
import { sanitizeModelText } from './output-sanitizer';

export const RESULT_MARKER_PREFIX = '<!-- happy:result:v';

const clip = (text: string, limit: number): string => text.slice(0, limit);

const emptyCounts = (): Record<Severity, number> =>
  Object.fromEntries(SEVERITY_ORDER.map((severity) => [severity, 0])) as Record<Severity, number>;

const countBySeverity = (
  findings: readonly Pick<TrackedFinding, 'severity'>[],
): Record<Severity, number> => {
  const counts = emptyCounts();
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
};

const FULL_COVERAGE: ResultCoverage = { complete: true, unreviewedFiles: 0, gaps: [] };

const toQuestion = (question: TrackedFinding) => ({
  file: question.file,
  line: question.line,
  text: clip(sanitizeModelText(question.message), MAX_RESULT_QUESTION_CHARS),
});

const toResultScope = (scope: ReviewScope, files: number): ResultScope =>
  scope.mode === ReviewMode.INCREMENTAL
    ? { mode: scope.mode, baseSha: scope.baseSha, reason: null, files }
    : { mode: scope.mode, baseSha: null, reason: scope.reason, files };

const trackingSnapshot = (
  outcome: Extract<ReviewOutcome, { status: 'reviewed' | 'incomplete' }>,
): ResultTracking => ({
  reviewedSha: outcome.headSha,
  scope: toResultScope(outcome.tracking.scope, outcome.tracking.reviewedFileCount),
  counts: countStatuses(outcome.tracking.findings),
  findings: outcome.tracking.findings,
});

const completedSnapshot = (
  outcome: Extract<ReviewOutcome, { status: 'reviewed' | 'incomplete' }>,
): ReviewResultSnapshot => ({
  status: outcome.status,
  title: clip(checkVoiceLine(outcome), MAX_RESULT_TITLE_CHARS),
  summary: clip(sanitizeModelText(outcome.summary), MAX_RESULT_SUMMARY_CHARS),
  skipReason: null,
  counts: countBySeverity(openFindings(outcome.tracking.findings)),
  questions: openQuestions(outcome.tracking.findings)
    .slice(0, MAX_RESULT_QUESTIONS)
    .map(toQuestion),
  coverage: {
    complete: outcome.coverage.gaps.length === 0 && outcome.coverage.unreviewedFiles.length === 0,
    unreviewedFiles: outcome.coverage.unreviewedFiles.length,
    gaps: outcome.coverage.gaps,
  },
  tracking: trackingSnapshot(outcome),
});

export const buildResultSnapshot = (outcome: ReviewOutcome): ReviewResultSnapshot => {
  if (outcome.status === ReviewStatus.REVIEWED || outcome.status === ReviewStatus.INCOMPLETE) {
    return completedSnapshot(outcome);
  }
  return {
    status: outcome.status,
    title: clip(checkVoiceLine(outcome), MAX_RESULT_TITLE_CHARS),
    summary: '',
    skipReason: outcome.status === ReviewStatus.SKIPPED ? outcome.reason : null,
    counts: emptyCounts(),
    questions: [],
    coverage: FULL_COVERAGE,
    tracking: null,
  };
};

const encodeMarker = (snapshot: ReviewResultSnapshot): string =>
  `${RESULT_MARKER_PREFIX}${RESULT_MARKER_VERSION} ${toBase64Url(JSON.stringify(snapshot))} -->`;

export const renderResultMarker = (snapshot: ReviewResultSnapshot): string => {
  const marker = encodeMarker(snapshot);
  if (marker.length <= MAX_RESULT_MARKER_CHARS) return marker;
  const withoutTracking = encodeMarker({ ...snapshot, tracking: null });
  return withoutTracking.length <= MAX_RESULT_MARKER_CHARS ? withoutTracking : '';
};
