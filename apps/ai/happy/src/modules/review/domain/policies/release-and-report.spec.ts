import { trackingOf } from '../../infrastructure/testing/outcome.testing';
import { CheckVoice } from '../constants/check-voice.constants';
import { FindingKind, FindingTopic } from '../constants/finding-classification.constants';
import { FindingCategory, Severity } from '../constants/severity.constants';
import { SkipReason } from '../constants/skip-patterns.constants';
import { CheckConclusion } from '../entities/check-report';
import type { ValidatedFinding } from '../entities/finding';
import { FileStatus, type ChangedFile } from '../entities/pull-request';
import { CoverageGap, ReviewStatus, type CompletedReview } from '../entities/review-outcome';

import { buildCheckReport } from './check-report';
import { buildReleaseChecklist, checklistDigest, isReleasePullRequest } from './release-checklist';
import { renderReleaseChecklist } from './release-checklist-renderer';
import { renderCompletedReview } from './review-renderer';

const file = (
  path: string,
  patch: string | null,
  status: ChangedFile['status'] = FileStatus.MODIFIED,
): ChangedFile => ({
  path,
  status,
  additions: 1,
  deletions: 0,
  patch,
});

describe('release checklist', () => {
  it('recognises only development into main', () => {
    expect(isReleasePullRequest({ baseRef: 'main', headRef: 'development' })).toBe(true);
    expect(isReleasePullRequest({ baseRef: 'development', headRef: 'feat/x' })).toBe(false);
    expect(isReleasePullRequest({ baseRef: 'main', headRef: 'hotfix/x' })).toBe(false);
  });

  it('lists migrations with risks, new env names, services and dependency changes', () => {
    const checklist = buildReleaseChecklist([
      file(
        'apps/api/drizzle_v2/0042_add.sql',
        '@@ -0,0 +1,3 @@\n+CREATE INDEX idx_a ON movies (title);\n+ALTER TABLE movies ADD COLUMN flag boolean NOT NULL;\n+DROP TABLE old_things;',
        FileStatus.ADDED,
      ),
      file(
        'apps/ai/happy/src/config/env.schema.ts',
        '@@ -1,2 +1,3 @@\n+  GITHUB_APP_ID: z.string(),\n+  const x = process.env.NEW_FLAG;\n-  OLD_NAME: z.string(),\n+  OLD_NAME: z.string().min(1),',
      ),
      file(
        'apps/ai/happy/package.json',
        '@@ -1,3 +1,4 @@\n+    "bullmq": "^5.65.1",\n-    "zod": "^4.0.0",\n+    "zod": "^4.2.1",\n-    "old-lib": "1.0.0",',
      ),
      file('package-lock.json', null),
      file('apps/storefront/src/a.ts', null),
    ]);
    expect(checklist.migrations[0]?.risks).toEqual(
      expect.arrayContaining([
        'CREATE INDEX без CONCURRENTLY і без IF NOT EXISTS',
        'ADD COLUMN ... NOT NULL',
        'DROP TABLE або DROP COLUMN',
      ]),
    );
    expect(checklist.envVars).toEqual(['GITHUB_APP_ID', 'NEW_FLAG']);
    expect(
      buildReleaseChecklist([
        file('apps/api/src/a.spec.ts', '@@ -0,0 +1 @@\n+process.env.ONLY_IN_TEST'),
      ]).envVars,
    ).toEqual([]);
    expect(checklist.services).toEqual([
      'apps/ai/happy',
      'apps/api',
      'apps/storefront',
      'корінь репозиторію',
    ]);
    expect(checklist.dependencies[0]?.changes).toEqual([
      { name: 'bullmq', change: 'added' },
      { name: 'old-lib', change: 'removed' },
      { name: 'zod', change: 'changed' },
    ]);
    expect(checklist.lockfileChanged).toBe(true);
    const markdown = renderReleaseChecklist(
      { owner: 'a', repo: 'b', number: 9 },
      'abcdef1234',
      checklist,
      false,
    );
    expect(markdown).toContain('0042_add.sql');
    expect(markdown).toContain('вартість $0.0000');
  });

  it('says there is nothing when the diff has no risks', () => {
    const markdown = renderReleaseChecklist(
      { owner: 'a', repo: 'b', number: 1 },
      'abcdef1234',
      buildReleaseChecklist([file('apps/web-client/src/a.ts', '@@ -1 +1 @@\n+x')]),
      true,
    );
    expect(markdown).toContain('немає');
    expect(markdown).toContain('неповний');
  });
});

const validated = (overrides: Partial<ValidatedFinding> = {}): ValidatedFinding => ({
  file: 'src/a.ts',
  line: 4,
  severity: Severity.MAJOR,
  category: FindingCategory.CORRECTNESS,
  topic: FindingTopic.LOGIC,
  kind: FindingKind.FINDING,
  checkId: null,
  failureScenario: 'Конкретний вхід і хибний результат',
  impact: 'Хто або що страждає від цього',
  message: 'Помилка',
  evidence: { path: 'src/a.ts', line: 4, excerpt: 'const value = 1;' },
  fingerprint: 'f',
  ...overrides,
});

const review = (
  overrides: Partial<Omit<CompletedReview, 'markdown'>> = {},
): Omit<CompletedReview, 'markdown'> => {
  const merged = reviewBase(overrides);
  return {
    ...merged,
    tracking: overrides.tracking ?? trackingOf(merged.findings, merged.questions),
  };
};

const reviewBase = (
  overrides: Partial<Omit<CompletedReview, 'markdown'>>,
): Omit<CompletedReview, 'markdown' | 'tracking'> => ({
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
  ...overrides,
});

describe('review rendering and check report', () => {
  it('says there are no findings only when coverage is complete', () => {
    expect(renderCompletedReview(review())).toContain('Зауважень немає.');
    const partial = renderCompletedReview(
      review({ coverage: { unreviewedFiles: ['src/b.ts'], gaps: [CoverageGap.TOOL_FAILED] } }),
    );
    expect(partial).not.toContain('Зауважень немає.');
    expect(partial).toContain('покриття неповне');
    expect(partial).toContain('src/b.ts');
  });

  it('renders questions in their own section', () => {
    const markdown = renderCompletedReview(
      review({
        questions: [validated({ kind: FindingKind.QUESTION, message: 'Чи це навмисно?' })],
      }),
    );
    expect(markdown).toContain('### Питання до автора (1)');
    expect(markdown).toContain('Чи це навмисно?');
  });

  it('builds a neutral report with annotations capped at 50 and questions as notices', () => {
    const findings = Array.from({ length: 40 }, (_, line) => validated({ line: line + 1 }));
    const questions = Array.from({ length: 20 }, (_, line) =>
      validated({ line: line + 1, kind: FindingKind.QUESTION }),
    );
    const base = review({ findings, questions });
    const report = buildCheckReport({ ...base, markdown: renderCompletedReview(base) });
    expect(report.conclusion).toBe(CheckConclusion.NEUTRAL);
    expect(report.annotations).toHaveLength(50);
    expect(report.annotations[0]?.level).toBe('warning');
    expect(report.annotations[45]?.level).toBe('notice');
    expect(report.summary.length).toBeLessThanOrEqual(60_000);
  });
});

describe('check voice', () => {
  const titleOf = (overrides: Partial<Omit<CompletedReview, 'markdown'>> = {}): string => {
    const base = review(overrides);
    return buildCheckReport({ ...base, markdown: renderCompletedReview(base) }).title;
  };

  it('is clean when there is nothing to say and the coverage is complete', () => {
    expect(titleOf()).toBe(CheckVoice.CLEAN);
  });

  it('puts the worst severity first', () => {
    expect(
      titleOf({
        findings: [
          validated({ severity: Severity.MINOR }),
          validated({ severity: Severity.CRITICAL }),
          validated({ severity: Severity.MAJOR }),
        ],
      }),
    ).toBe(CheckVoice.CRITICAL);
    expect(titleOf({ findings: [validated({ severity: Severity.MINOR }), validated()] })).toBe(
      CheckVoice.MAJOR,
    );
  });

  it.each([Severity.MINOR, Severity.NIT])(
    'records %s findings without stopping the line',
    (severity) => {
      expect(titleOf({ findings: [validated({ severity })] })).toBe(CheckVoice.MINOR);
    },
  );

  it('only asks when there are just questions', () => {
    expect(titleOf({ questions: [validated({ kind: FindingKind.QUESTION })] })).toBe(
      CheckVoice.QUESTIONS,
    );
  });

  it('admits a coverage gap instead of calling the perimeter clean', () => {
    const gap = { unreviewedFiles: ['src/b.ts'], gaps: [CoverageGap.TOOL_FAILED] };
    expect(titleOf({ coverage: gap })).toBe(CheckVoice.COVERAGE_GAP);
    expect(titleOf({ status: ReviewStatus.INCOMPLETE })).toBe(CheckVoice.COVERAGE_GAP);
    expect(titleOf({ coverage: gap, findings: [validated({ severity: Severity.MINOR })] })).toBe(
      CheckVoice.COVERAGE_GAP,
    );
  });

  it('closes the shift when the daily budget is gone', () => {
    expect(titleOf({ status: ReviewStatus.INCOMPLETE, budgetExhausted: true })).toBe(
      CheckVoice.BUDGET_EXHAUSTED,
    );
  });

  it('speaks for skipped pull requests and release checklists', () => {
    const skipped = (reason: SkipReason) =>
      buildCheckReport({
        status: ReviewStatus.SKIPPED,
        ref: { owner: 'a', repo: 'b', number: 3 },
        headSha: 'abc',
        reason,
        costUsd: 0,
        markdown: '## skipped',
      });
    expect(skipped(SkipReason.TRIVIAL).title).toBe(CheckVoice.TRIVIAL);
    expect(skipped(SkipReason.TOO_LARGE).title).toBe(CheckVoice.TOO_LARGE);
    expect(skipped(SkipReason.DOCS_ONLY).title).toBe('Пропущено: docs_only');
    expect(
      buildCheckReport({
        status: ReviewStatus.CHECKLIST,
        digest: {
          migrations: 0,
          riskyMigrations: 0,
          envVars: 0,
          services: 0,
          dependencyChanges: 0,
          lockfileChanged: false,
        },
        ref: { owner: 'a', repo: 'b', number: 3 },
        headSha: 'abc',
        costUsd: 0,
        markdown: '## checklist',
      }).title,
    ).toBe(CheckVoice.RELEASE_CHECKLIST);
  });

  it('repeats the voice line first in the summary and keeps findings factual', () => {
    const base = review({ findings: [validated({ severity: Severity.CRITICAL })] });
    const report = buildCheckReport({ ...base, markdown: renderCompletedReview(base) });
    const [first, second] = report.summary.split('\n');
    expect(first).toBe(CheckVoice.CRITICAL);
    expect(second).toBe('');
    expect(renderCompletedReview(base)).not.toContain(CheckVoice.CRITICAL);
  });

  it('never states there are no findings while the coverage has a gap', () => {
    const base = review({
      coverage: { unreviewedFiles: ['src/b.ts'], gaps: [CoverageGap.TOOL_FAILED] },
    });
    const report = buildCheckReport({ ...base, markdown: renderCompletedReview(base) });
    expect(report.summary).toContain('### Покриття неповне');
    expect(report.summary).not.toContain('Зауважень немає.');
  });

  it('keeps every voice line to one line without emoji', () => {
    for (const line of Object.values(CheckVoice)) {
      expect(line).not.toContain('\n');
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe('checklistDigest', () => {
  it('counts what the checklist lists', () => {
    const digest = checklistDigest({
      services: ['apps/api', 'apps/ai/happy'],
      migrations: [
        { path: 'a.sql', risks: [] },
        { path: 'b.sql', risks: ['DROP TABLE або DROP COLUMN'] },
      ],
      envVars: ['NEW_FLAG'],
      dependencies: [
        {
          path: 'package.json',
          changes: [
            { name: 'a', change: 'added' },
            { name: 'b', change: 'changed' },
          ],
        },
      ],
      lockfileChanged: true,
      fileCount: 9,
    });
    expect(digest).toEqual({
      migrations: 2,
      riskyMigrations: 1,
      envVars: 1,
      services: 2,
      dependencyChanges: 2,
      lockfileChanged: true,
    });
  });

  it('builds the digest from the files of a release and carries it into the result snapshot', () => {
    const files = [
      file('apps/api/drizzle_v2/0050_x.sql', '@@ -0,0 +1 @@\n+DROP TABLE t;', FileStatus.ADDED),
    ];
    const digest = checklistDigest(buildReleaseChecklist(files));
    expect(digest.migrations).toBe(1);
    expect(digest.riskyMigrations).toBe(1);
  });
});
