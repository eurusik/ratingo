import {
  FakePublishedChecks,
  buildFakeCodeHost,
  buildPullRequest,
  type FakeCodeHost,
} from '../src/modules/review/infrastructure/testing/fake-code-host.testing';
import { FindingKind } from '../src/modules/review/domain/constants/finding-classification.constants';
import {
  FindingCategory,
  Severity,
} from '../src/modules/review/domain/constants/severity.constants';
import {
  CommitRelation,
  FileStatus,
  type ChangedFile,
  type CommitComparison,
} from '../src/modules/review/domain/entities/pull-request';
import {
  ReviewStatus,
  type ReviewOutcome,
} from '../src/modules/review/domain/entities/review-outcome';
import type { ReviewResultSnapshot } from '../src/modules/review/domain/entities/review-result';
import { FullReviewReason, ReviewMode } from '../src/modules/review/domain/entities/review-scope';
import {
  FindingStatus,
  type TrackedFinding,
} from '../src/modules/review/domain/entities/tracked-finding';
import type { PublishedCheck } from '../src/modules/review/domain/ports/published-check.port';

const INCREMENTAL_HEAD_SHA = 'evalhead';
const INCREMENTAL_BASE_SHA = 'evalbase';
const INCREMENTAL_REVIEWED_SHA = 'evalreviewed';
const MIN_LINES_TO_REVIEW = 30;
const LINE_TOLERANCE = 2;

interface PreviousEvalFinding {
  fingerprint: string;
  file: string;
  line: number;
  severity: Severity;
  category: FindingCategory;
  message: string;
  excerpt: string;
}

interface NewCommitEdit {
  path: string;
  fromLine: number;
  toLine: number;
}

interface IncrementalExpectation {
  mode: ReviewMode;
  reason?: FullReviewReason;
  statuses: Readonly<Record<string, FindingStatus | 'any'>>;
  newFindingAtLine?: { path: string; line: number };
}

export interface IncrementalEvalCase {
  id: string;
  title: string;
  headFiles: Readonly<Record<string, readonly string[]>>;
  previous: readonly PreviousEvalFinding[];
  relation: CommitRelation;
  newCommit: readonly NewCommitEdit[];
  expectation: IncrementalExpectation;
}

export interface IncrementalScore {
  caseId: string;
  modeMatches: boolean;
  reasonMatches: boolean;
  statusMismatches: string[];
  droppedFindings: string[];
  newFindingFound: boolean | null;
}

const toTracked = (finding: PreviousEvalFinding): TrackedFinding => ({
  ...finding,
  kind: FindingKind.FINDING,
  status: FindingStatus.NEW,
});

const previousCheckFor = (testCase: IncrementalEvalCase): PublishedCheck => {
  const findings = testCase.previous.map(toTracked);
  const snapshot: ReviewResultSnapshot = {
    status: ReviewStatus.REVIEWED,
    title: 'previous',
    summary: 'previous review',
    skipReason: null,
    counts: { critical: 0, major: findings.length, minor: 0, nit: 0 },
    questions: [],
    coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
    tracking: {
      reviewedSha: INCREMENTAL_REVIEWED_SHA,
      scope: {
        mode: ReviewMode.FULL,
        baseSha: null,
        reason: FullReviewReason.NO_PREVIOUS,
        files: Object.keys(testCase.headFiles).length,
      },
      counts: { new: findings.length, stillOpen: 0, resolved: 0, needsRecheck: 0 },
      findings,
    },
  };
  return {
    headSha: INCREMENTAL_REVIEWED_SHA,
    title: 'previous',
    snapshot,
    url: null,
    trusted: true,
  };
};

const patchFor = (lines: readonly string[], edit: NewCommitEdit): string => {
  const added = lines.slice(edit.fromLine - 1, edit.toLine);
  return [
    `@@ -${edit.fromLine},0 +${edit.fromLine},${added.length} @@`,
    ...added.map((line) => `+${line}`),
  ].join('\n');
};

const pullRequestFilesFor = (testCase: IncrementalEvalCase): ChangedFile[] =>
  Object.entries(testCase.headFiles).map(([path, lines]) => ({
    path,
    status: FileStatus.MODIFIED,
    additions: Math.max(lines.length, MIN_LINES_TO_REVIEW),
    deletions: 0,
    patch: patchFor(lines, { path, fromLine: 1, toLine: lines.length }),
  }));

const comparisonFor = (testCase: IncrementalEvalCase): CommitComparison => ({
  relation: testCase.relation,
  truncated: false,
  files: testCase.newCommit.map((edit) => {
    const lines = testCase.headFiles[edit.path] ?? [];
    return {
      path: edit.path,
      status: FileStatus.MODIFIED,
      additions: edit.toLine - edit.fromLine + 1,
      deletions: 0,
      patch: patchFor(lines, edit),
    };
  }),
});

const contentsFor = (testCase: IncrementalEvalCase): Record<string, string> =>
  Object.fromEntries(
    Object.entries(testCase.headFiles).map(([path, lines]) => [
      `${INCREMENTAL_HEAD_SHA}:${path}`,
      lines.join('\n'),
    ]),
  );

export const scoreIncrementalCase = (
  testCase: IncrementalEvalCase,
  outcome: ReviewOutcome,
): IncrementalScore => {
  const completed =
    outcome.status === ReviewStatus.REVIEWED || outcome.status === ReviewStatus.INCOMPLETE;
  const tracked = completed ? outcome.tracking.findings : [];
  const scope = completed ? outcome.tracking.scope : null;
  const expected = testCase.expectation;
  const statusMismatches = Object.entries(expected.statuses).flatMap(([fingerprint, status]) => {
    const actual = tracked.find((finding) => finding.fingerprint === fingerprint)?.status;
    return status === 'any' || actual === status
      ? []
      : [`${fingerprint}: ${actual ?? 'missing'} (expected ${status})`];
  });
  const target = expected.newFindingAtLine;
  return {
    caseId: testCase.id,
    modeMatches: scope?.mode === expected.mode,
    reasonMatches:
      expected.reason === undefined ||
      (scope?.mode === ReviewMode.FULL && scope.reason === expected.reason),
    statusMismatches,
    droppedFindings: testCase.previous
      .map((finding) => finding.fingerprint)
      .filter((fingerprint) => !tracked.some((finding) => finding.fingerprint === fingerprint)),
    newFindingFound:
      target === undefined
        ? null
        : tracked.some(
            (finding) =>
              finding.status === FindingStatus.NEW &&
              finding.file === target.path &&
              Math.abs(finding.line - target.line) <= LINE_TOLERANCE,
          ),
  };
};

export const isDeterministicPass = (score: IncrementalScore): boolean =>
  score.modeMatches &&
  score.reasonMatches &&
  score.statusMismatches.length === 0 &&
  score.droppedFindings.length === 0;

export const buildIncrementalHost = (testCase: IncrementalEvalCase): FakeCodeHost =>
  buildFakeCodeHost({
    pr: buildPullRequest({
      ref: { owner: 'eval', repo: 'cases', number: 1 },
      headSha: INCREMENTAL_HEAD_SHA,
      baseSha: INCREMENTAL_BASE_SHA,
      headRepository: 'eval/cases',
      title: `Update ${Object.keys(testCase.headFiles).join(', ')}`,
      body: '',
    }),
    files: pullRequestFilesFor(testCase),
    contents: contentsFor(testCase),
    comparison: comparisonFor(testCase),
  });

export const buildIncrementalChecks = (testCase: IncrementalEvalCase): FakePublishedChecks =>
  new FakePublishedChecks(new Map([[INCREMENTAL_REVIEWED_SHA, previousCheckFor(testCase)]]), [
    INCREMENTAL_HEAD_SHA,
    INCREMENTAL_REVIEWED_SHA,
  ]);
