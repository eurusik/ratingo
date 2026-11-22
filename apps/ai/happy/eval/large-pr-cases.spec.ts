import {
  MAX_FOCUS_FILES,
  MAX_INLINE_DIFF_CHANGED_LINES,
  MAX_REVIEWABLE_CHANGED_LINES,
} from '../src/modules/review/domain/constants/review-limits.constants';
import { FileTier } from '../src/modules/review/domain/constants/file-priority.constants';
import type { ChangedFile } from '../src/modules/review/domain/entities/pull-request';
import { rankFiles, selectFocusFiles } from '../src/modules/review/domain/policies/file-priority';
import { reviewableFiles } from '../src/modules/review/domain/policies/skip-policy';

import { EvalKind, renderPatch, siblingChangedFiles, type EvalCase } from './eval-case';
import { LARGE_PR_EVAL_CASES } from './large-pr-cases';
import { scoreCase, summarize } from './scorer';

const EXPECTED_FILE_COUNTS: Record<string, number> = {
  'large-pr-landing-cache-policy': 21,
  'large-pr-command-parser-policy': 66,
};

const changedFilesOf = (testCase: EvalCase): ChangedFile[] => [
  {
    path: testCase.path,
    status: 'modified',
    additions: 3,
    deletions: 0,
    patch: renderPatch(testCase),
  },
  ...siblingChangedFiles(testCase),
];

const limits = { maxFiles: MAX_FOCUS_FILES, maxInlineChangedLines: MAX_INLINE_DIFF_CHANGED_LINES };

describe('large pull request eval cases', () => {
  it.each(LARGE_PR_EVAL_CASES.map((testCase) => [testCase.id, testCase] as const))(
    '%s has the size and shape of the pull request it models',
    (id, testCase) => {
      const files = changedFilesOf(testCase);
      expect(files).toHaveLength(EXPECTED_FILE_COUNTS[id] ?? -1);
      expect(new Set(files.map((file) => file.path)).size).toBe(files.length);
      expect(testCase.kind).toBe(EvalKind.POSITIVE);
      const reviewable = reviewableFiles(files);
      const lines = reviewable.reduce((sum, file) => sum + file.additions + file.deletions, 0);
      expect(lines).toBeLessThanOrEqual(MAX_REVIEWABLE_CHANGED_LINES);
      expect(lines).toBeGreaterThan(MAX_INLINE_DIFF_CHANGED_LINES);
      const tiers = new Set(rankFiles(reviewable, []).map(({ tier }) => tier));
      expect(tiers).toContain(FileTier.DOMAIN);
      expect(tiers).toContain(FileTier.TEST);
      expect(tiers).toContain(FileTier.CONFIG);
    },
  );

  it.each(LARGE_PR_EVAL_CASES.map((testCase) => [testCase.id, testCase] as const))(
    '%s lists the defect file among its core files, all of them changed',
    (_id, testCase) => {
      const paths = new Set(changedFilesOf(testCase).map((file) => file.path));
      expect(testCase.coreFiles).toContain(testCase.path);
      for (const core of testCase.coreFiles ?? []) {
        expect(paths.has(core)).toBe(true);
      }
    },
  );

  it.each(LARGE_PR_EVAL_CASES.map((testCase) => [testCase.id, testCase] as const))(
    '%s keeps every core file in the careful set even when triage names only noise',
    (_id, testCase) => {
      const ranked = rankFiles(reviewableFiles(changedFilesOf(testCase)), []);
      const noise = ranked
        .filter(({ tier }) => tier === FileTier.TEST || tier === FileTier.PERIPHERAL)
        .map(({ file }) => file.path);
      const careful = selectFocusFiles(ranked, noise, limits);
      expect(careful.length).toBeLessThanOrEqual(MAX_FOCUS_FILES);
      for (const core of testCase.coreFiles ?? []) {
        expect(careful).toContain(core);
      }
    },
  );

  it.each(LARGE_PR_EVAL_CASES.map((testCase) => [testCase.id, testCase] as const))(
    '%s scores core files covered from the careful set',
    (_id, testCase) => {
      const ranked = rankFiles(reviewableFiles(changedFilesOf(testCase)), []);
      const careful = selectFocusFiles(ranked, [], limits);
      const covered = scoreCase(testCase, {
        caseId: testCase.id,
        kind: testCase.kind,
        selectedCheckIds: [],
        findings: [],
        questions: [],
        reviewedFiles: careful,
      });
      expect(covered.coreFilesTotal).toBe(testCase.coreFiles?.length);
      expect(summarize([covered]).coreFilesCoverage).toBe(1);
      const missed = scoreCase(testCase, {
        caseId: testCase.id,
        kind: testCase.kind,
        selectedCheckIds: [],
        findings: [],
        questions: [],
        reviewedFiles: [],
      });
      expect(summarize([missed]).coreFilesCoverage).toBe(0);
    },
  );
});
