import { FindingKind, FindingTopic } from '../constants/finding-classification.constants';
import { FindingCategory, Severity } from '../constants/severity.constants';
import { CheckConclusion } from '../entities/check-report';
import type { ValidatedFinding } from '../entities/finding';
import { FileStatus, type ChangedFile } from '../entities/pull-request';
import { CoverageGap, ReviewStatus, type CompletedReview } from '../entities/review-outcome';

import { buildCheckReport } from './check-report';
import { buildReleaseChecklist, isReleasePullRequest } from './release-checklist';
import { renderReleaseChecklist } from './release-checklist-renderer';
import { renderCompletedReview } from './review-renderer';
import { RULE_CARD_IDS, cardsForPaths, renderRuleCard, selectRuleCards } from './rule-cards';

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
  message: 'Помилка',
  evidence: { path: 'src/a.ts', line: 4, excerpt: 'const value = 1;' },
  fingerprint: 'f',
  ...overrides,
});

const review = (
  overrides: Partial<Omit<CompletedReview, 'markdown'>> = {},
): Omit<CompletedReview, 'markdown'> => ({
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

describe('rule cards', () => {
  it('selects only the cards triage chose and ignores unknown ids', () => {
    expect(selectRuleCards(['migrations', 'nope']).map((card) => card.id)).toEqual(['migrations']);
    expect(selectRuleCards([])).toEqual([]);
    expect(RULE_CARD_IDS.length).toBeGreaterThanOrEqual(5);
  });

  it('matches cards by path and renders the four parts', () => {
    const ids = cardsForPaths(['apps/api/src/modules/media/domain/clock.ts']).map(
      (card) => card.id,
    );
    expect(ids).toContain('domain-purity');
    const text = renderRuleCard(selectRuleCards(['domain-purity'])[0]!);
    expect(text).toContain('Violation:');
    expect(text).toContain('Already protected, do not report:');
    expect(text).toContain('Unclear, ask as a question:');
    expect(text).toContain('Never report:');
  });
});
