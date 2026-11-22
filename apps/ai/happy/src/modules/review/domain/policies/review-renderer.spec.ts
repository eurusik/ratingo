import { FindingKind, FindingTopic } from '../constants/finding-classification.constants';
import { FindingCategory, Severity } from '../constants/severity.constants';
import type { ValidatedFinding } from '../entities/finding';
import type { CompletedReview } from '../entities/review-outcome';
import { ReviewStatus } from '../entities/review-outcome';
import { FullReviewReason, ReviewMode } from '../entities/review-scope';
import { FindingStatus, type TrackedFinding } from '../entities/tracked-finding';

import { renderCompletedReview } from './review-renderer';

const validated: ValidatedFinding = {
  file: 'src/b.ts',
  line: 4,
  severity: Severity.MAJOR,
  category: FindingCategory.CORRECTNESS,
  topic: FindingTopic.LOGIC,
  kind: FindingKind.FINDING,
  checkId: null,
  failureScenario: 'Виклик без значення падає',
  impact: 'Користувач бачить помилку',
  message: 'Нова помилка',
  evidence: { path: 'src/b.ts', line: 4, excerpt: 'x' },
  fingerprint: 'fp-new',
};

const tracked = (status: FindingStatus, fingerprint: string, message: string): TrackedFinding => ({
  fingerprint,
  file: 'src/a.ts',
  line: 2,
  severity: Severity.MINOR,
  category: FindingCategory.TESTS,
  kind: FindingKind.FINDING,
  message,
  excerpt: 'x',
  status,
});

const review = (
  tracking: CompletedReview['tracking'],
  findings: ValidatedFinding[] = [],
): Omit<CompletedReview, 'markdown'> => ({
  status: ReviewStatus.REVIEWED,
  ref: { owner: 'a', repo: 'b', number: 3 },
  headSha: 'def4567890',
  summary: 'Підсумок',
  findings,
  questions: [],
  dropped: [],
  tracking,
  reviewedFiles: [],
  coverage: { unreviewedFiles: [], gaps: [] },
  stopReason: 'end',
  budgetExhausted: false,
  costUsd: 0,
});

describe('renderCompletedReview with tracked state', () => {
  const incremental = {
    scope: { mode: ReviewMode.INCREMENTAL, baseSha: 'abc1234567' },
    hadPrevious: true,
  } as const;

  it.each([
    [1, 'файл'],
    [3, 'файли'],
    [5, 'файлів'],
    [11, 'файлів'],
    [21, 'файл'],
    [22, 'файли'],
  ])('says what was reviewed for %i changed files', (count, word) => {
    const markdown = renderCompletedReview(
      review({ ...incremental, reviewedFileCount: count, findings: [] }),
    );
    expect(markdown).toContain(`Переглянув нові коміти abc1234..def4567 (${count} ${word})`);
  });

  it('shows the counts, the full current list with statuses and the resolved ones', () => {
    const markdown = renderCompletedReview(
      review(
        {
          ...incremental,
          reviewedFileCount: 2,
          findings: [
            tracked(FindingStatus.RESOLVED, 'a', 'Виправлена помилка'),
            tracked(FindingStatus.STILL_OPEN, 'b', 'Лишилась стара помилка'),
            { ...tracked(FindingStatus.NEW, 'fp-new', 'Нова помилка'), file: 'src/b.ts', line: 4 },
            tracked(FindingStatus.NEEDS_RECHECK, 'c', 'Незрозуміла помилка'),
          ],
        },
        [validated],
      ),
    );
    expect(markdown).toContain(
      '✅ виправлено: 1 · ⚠️ лишилось: 1 · 🆕 нових: 1 · ❓ не підтверджено: 1',
    );
    expect(markdown).toContain('⚠️ **minor**');
    expect(markdown).toContain('🆕 **major**');
    expect(markdown).toContain('Сценарій: Виклик без значення падає');
    expect(markdown).toContain('❓ **minor**');
    expect(markdown).toContain('### ✅ Виправлено (1)');
    expect(markdown).toContain('Виправлена помилка');
  });

  it('states the reason of a full review and keeps a first review free of status marks', () => {
    const markdown = renderCompletedReview(
      review(
        {
          scope: { mode: ReviewMode.FULL, reason: FullReviewReason.HISTORY_REWRITTEN },
          reviewedFileCount: 4,
          hadPrevious: false,
          findings: [{ ...tracked(FindingStatus.NEW, 'fp-new', 'Нова помилка'), file: 'src/b.ts' }],
        },
        [validated],
      ),
    );
    expect(markdown).toContain('Повне рев’ю: історію гілки переписано');
    expect(markdown).not.toContain('виправлено:');
    expect(markdown).not.toContain('🆕');
  });
});
