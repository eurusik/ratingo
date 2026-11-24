import * as path from 'node:path';

import {
  ContentPartType,
  FixedClock,
  InMemoryRunRepository,
  StopReason,
  StubModelAdapter,
  loadAgentFolder,
  type ModelRequest,
  type StubScript,
} from '@ratingo/ai-core';
import { RunTrigger } from '@ratingo/ai-core';

import type { ReviewConfig } from '../../../../config/config.constants';
import {
  MODEL_ALIAS_NAMES,
  STUB_PROVIDER,
  STUB_REVIEW_MODEL,
  STUB_TRIAGE_MODEL,
} from '../../../../config/models.config';
import { AgentRunner } from '../../../../core/agent-runner.service';
import { FindingKind } from '../../domain/constants/finding-classification.constants';
import { FindingCategory, Severity } from '../../domain/constants/severity.constants';
import {
  CommitRelation,
  FileStatus,
  type ChangedFile,
  type CommitComparison,
} from '../../domain/entities/pull-request';
import { ReviewStatus, type CompletedReview } from '../../domain/entities/review-outcome';
import type { ReviewResultSnapshot } from '../../domain/entities/review-result';
import { FullReviewReason, RequestedMode, ReviewMode } from '../../domain/entities/review-scope';
import { FindingStatus, type TrackedFinding } from '../../domain/entities/tracked-finding';
import type { PublishedCheck } from '../../domain/ports/published-check.port';
import { FolderCheckSourceAdapter } from '../../infrastructure/adapters/folder.check-source-adapter';
import {
  FakePublishedChecks,
  TEST_REF,
  buildChangedFile,
  buildFakeCodeHost,
  buildPullRequest,
  type FakeCodeHost,
} from '../../infrastructure/testing/fake-code-host.testing';
import { RecordingCheckMetrics } from '../../infrastructure/testing/recording-check-metrics.testing';

import { CarryOverService } from './carry-over.service';
import { DeepReviewService } from './deep-review.service';
import { ReviewScopeService } from './review-scope.service';
import { ReviewService } from './review.service';
import { TriageService } from './triage.service';

const AGENT_PATH = path.resolve(__dirname, '../../../../../agent');
const CHECKS_PATH = path.join(AGENT_PATH, 'checks');
const USAGE = {
  inputTokens: 1000,
  outputTokens: 200,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
};

const config: ReviewConfig = {
  allowedRepositories: ['acme/shop'],
  allowedAuthors: [],
  mentionHandle: 'happy-on-duty',
};

const OLD_SHA = 'old1111';
const HEAD_SHA = 'head222';
const CART = 'src/cart.ts';
const OTHER = 'src/other.ts';

const CART_BEFORE = ['const price = 10;', 'const total = price * qty;', 'export { total };'];
const CART_FIXED = [
  'const price = 10;',
  'const total = Math.round(price * qty);',
  'export { total };',
];
const OTHER_BODY = ['const a = 1;', 'const b = a + undefinedValue;', 'export { b };'];

const previousFinding = (overrides: Partial<TrackedFinding> = {}): TrackedFinding => ({
  fingerprint: 'fp-cart',
  file: CART,
  line: 2,
  severity: Severity.MAJOR,
  category: FindingCategory.CORRECTNESS,
  kind: FindingKind.FINDING,
  message: 'Сума не округлюється',
  excerpt: 'const total = price * qty;',
  status: FindingStatus.NEW,
  ...overrides,
});

const previousCheck = (
  findings: TrackedFinding[],
  overrides: { trusted?: boolean; complete?: boolean; withState?: boolean } = {},
): PublishedCheck => {
  const snapshot: ReviewResultSnapshot = {
    kind: 'review',
    status: ReviewStatus.REVIEWED,
    title: 't',
    summary: 's',
    skipReason: null,
    counts: { critical: 0, major: findings.length, minor: 0, nit: 0 },
    questions: [],
    coverage: { complete: overrides.complete ?? true, unreviewedFiles: 0, gaps: [] },
    tracking:
      overrides.withState === false
        ? null
        : {
            reviewedSha: OLD_SHA,
            scope: {
              mode: ReviewMode.FULL,
              baseSha: null,
              reason: FullReviewReason.NO_PREVIOUS,
              files: 2,
            },
            counts: { new: findings.length, stillOpen: 0, resolved: 0, needsRecheck: 0 },
            findings,
          },
  };
  return { headSha: OLD_SHA, title: 't', snapshot, url: null, trusted: overrides.trusted ?? true };
};

const patch = (added: readonly string[], startLine: number): string =>
  `@@ -${startLine},0 +${startLine},${added.length} @@\n${added.map((line) => `+${line}`).join('\n')}`;

const compareFile = (filePath: string, lines: readonly string[], startLine = 2): ChangedFile =>
  buildChangedFile({
    path: filePath,
    status: FileStatus.MODIFIED,
    patch: patch(lines, startLine),
    additions: lines.length,
    deletions: 0,
  });

const text = (value: unknown) => [{ type: ContentPartType.TEXT, text: JSON.stringify(value) }];

const scriptReturning = (value: unknown): StubScript => ({
  respond: (request) => ({
    model: `${STUB_PROVIDER}:${request.model}`,
    content: text(value),
    stopReason: StopReason.END,
    usage: USAGE,
  }),
});

interface Options {
  previous?: PublishedCheck | null;
  comparison?: CommitComparison | Error;
  contents?: Record<string, string>;
  review?: unknown;
}

const setup = async (options: Options = {}) => {
  const host: FakeCodeHost = buildFakeCodeHost({
    pr: buildPullRequest({ headSha: HEAD_SHA }),
    files: [
      buildChangedFile({ path: CART, additions: 20 }),
      buildChangedFile({ path: OTHER, additions: 20 }),
      buildChangedFile({ path: 'yarn.lock', additions: 20 }),
    ],
    contents: options.contents ?? {},
    comparison: options.comparison ?? {
      relation: CommitRelation.AHEAD,
      files: [],
      truncated: false,
    },
  });
  const checks = new FakePublishedChecks(
    new Map(
      options.previous === null || options.previous === undefined
        ? []
        : [[OLD_SHA, options.previous]],
    ),
    [HEAD_SHA, OLD_SHA],
  );
  const folder = await loadAgentFolder(AGENT_PATH, { knownModelAliases: MODEL_ALIAS_NAMES });
  const triage = scriptReturning({ risk: 'medium', focusFiles: [CART, OTHER], ruleTopics: [] });
  const review = scriptReturning(
    options.review ?? { summary: 'Огляд нових комітів', findings: [] },
  );
  const model = new StubModelAdapter({
    respond: (request: ModelRequest, callIndex: number) =>
      (request.model === STUB_TRIAGE_MODEL ? triage : review).respond(request, callIndex),
  });
  const runner = new AgentRunner(
    folder,
    { [STUB_PROVIDER]: model },
    {
      fast: [`${STUB_PROVIDER}:${STUB_TRIAGE_MODEL}`],
      review: [`${STUB_PROVIDER}:${STUB_REVIEW_MODEL}`],
    },
    new InMemoryRunRepository(),
    new FixedClock(1_800_000_000_000),
  );
  const service = new ReviewService(
    host,
    config,
    new TriageService(folder, runner),
    new DeepReviewService(folder, runner),
    await FolderCheckSourceAdapter.load(CHECKS_PATH),
    new RecordingCheckMetrics(),
    new ReviewScopeService(host, checks),
    new CarryOverService(host),
  );
  const reviewRequest = (): string =>
    JSON.stringify(
      model.requests.filter((request) => request.model === STUB_REVIEW_MODEL)[0]?.messages,
    );
  return { service, model, reviewRequest };
};

const completed = (outcome: Awaited<ReturnType<ReviewService['review']>>): CompletedReview => {
  if (outcome.status !== ReviewStatus.REVIEWED && outcome.status !== ReviewStatus.INCOMPLETE) {
    throw new Error(`unexpected ${outcome.status}`);
  }
  return outcome;
};

const statuses = (outcome: CompletedReview): Record<string, FindingStatus> =>
  Object.fromEntries(
    outcome.tracking.findings.map((finding) => [finding.fingerprint, finding.status]),
  );

const base = {
  contents: {
    [`${HEAD_SHA}:${CART}`]: CART_FIXED.join('\n'),
    [`${HEAD_SHA}:${OTHER}`]: OTHER_BODY.join('\n'),
  },
};

describe('ReviewService incremental mode', () => {
  it('reviews only the new commits and marks a fixed finding as resolved', async () => {
    const { service, reviewRequest } = await setup({
      ...base,
      previous: previousCheck([previousFinding()]),
      comparison: {
        relation: CommitRelation.AHEAD,
        files: [compareFile(CART, [CART_FIXED[1] ?? ''])],
        truncated: false,
      },
    });
    const outcome = completed(await service.review(TEST_REF, RunTrigger.MANUAL));
    expect(outcome.tracking.scope).toEqual({ mode: ReviewMode.INCREMENTAL, baseSha: OLD_SHA });
    expect(outcome.tracking.reviewedFileCount).toBe(1);
    expect(statuses(outcome)).toEqual({ 'fp-cart': FindingStatus.RESOLVED });
    expect(outcome.markdown).toContain(`Переглянув нові коміти ${OLD_SHA}..${HEAD_SHA} (1 файл)`);
    expect(outcome.markdown).toContain('✅ виправлено: 1 · ⚠️ лишилось: 0 · 🆕 нових: 0');
    expect(reviewRequest()).toContain('incremental review');
    expect(reviewRequest()).not.toContain(`### ${OTHER}`);
  });

  it('keeps findings open when the new commits touch other files', async () => {
    const { service } = await setup({
      contents: {
        [`${HEAD_SHA}:${CART}`]: CART_BEFORE.join('\n'),
        [`${HEAD_SHA}:${OTHER}`]: OTHER_BODY.join('\n'),
      },
      previous: previousCheck([previousFinding()]),
      comparison: {
        relation: CommitRelation.AHEAD,
        files: [compareFile(OTHER, ['const c = 3;'])],
        truncated: false,
      },
    });
    const outcome = completed(await service.review(TEST_REF, RunTrigger.MANUAL));
    expect(statuses(outcome)).toEqual({ 'fp-cart': FindingStatus.STILL_OPEN });
    expect(outcome.markdown).toContain('⚠️');
  });

  it('adds a new finding found in the new commits', async () => {
    const { service } = await setup({
      ...base,
      contents: { ...base.contents, [`${HEAD_SHA}:${CART}`]: CART_BEFORE.join('\n') },
      previous: previousCheck([previousFinding()]),
      comparison: {
        relation: CommitRelation.AHEAD,
        files: [compareFile(OTHER, [OTHER_BODY[1] ?? ''])],
        truncated: false,
      },
      review: {
        summary: 'Нова помилка',
        findings: [
          {
            file: OTHER,
            line: 2,
            severity: 'major',
            category: 'correctness',
            topic: 'logic',
            kind: 'finding',
            checkId: null,
            failureScenario: 'Виклик падає з ReferenceError на першому ж запиті',
            impact: 'Усі користувачі цього маршруту бачать помилку сервера',
            message: 'Змінна undefinedValue не оголошена',
            evidence: { path: OTHER, line: 2, excerpt: 'const b = a + undefinedValue;' },
          },
        ],
      },
    });
    const outcome = completed(await service.review(TEST_REF, RunTrigger.MANUAL));
    const counts = Object.values(statuses(outcome));
    expect(counts.sort()).toEqual([FindingStatus.NEW, FindingStatus.STILL_OPEN].sort());
    expect(outcome.markdown).toContain('🆕 нових: 1');
  });

  it('asks the model about a touched area and applies its verdict', async () => {
    const touched = {
      ...base,
      contents: { ...base.contents, [`${HEAD_SHA}:${CART}`]: CART_BEFORE.join('\n') },
      previous: previousCheck([previousFinding()]),
      comparison: {
        relation: CommitRelation.AHEAD,
        files: [compareFile(CART, ['const unrelated = 1;'], 3)],
        truncated: false,
      },
    };
    const withVerdict = await setup({
      ...touched,
      review: {
        summary: 's',
        findings: [],
        recheck: [{ fingerprint: 'fp-cart', verdict: 'resolved' }],
      },
    });
    const resolved = completed(await withVerdict.service.review(TEST_REF, RunTrigger.MANUAL));
    expect(statuses(resolved)).toEqual({ 'fp-cart': FindingStatus.RESOLVED });
    expect(withVerdict.reviewRequest()).toContain('fp-cart');

    const silent = await setup(touched);
    const unclear = completed(await silent.service.review(TEST_REF, RunTrigger.MANUAL));
    expect(statuses(unclear)).toEqual({ 'fp-cart': FindingStatus.NEEDS_RECHECK });
  });

  it('skips the model entirely when the new commits only touch ignored files', async () => {
    const { service, model } = await setup({
      ...base,
      previous: previousCheck([previousFinding()]),
      comparison: {
        relation: CommitRelation.AHEAD,
        files: [compareFile('yarn.lock', ['x'])],
        truncated: false,
      },
      contents: { ...base.contents, [`${HEAD_SHA}:${CART}`]: CART_BEFORE.join('\n') },
    });
    const outcome = completed(await service.review(TEST_REF, RunTrigger.MANUAL));
    expect(model.requests).toHaveLength(0);
    expect(outcome.costUsd).toBe(0);
    expect(statuses(outcome)).toEqual({ 'fp-cart': FindingStatus.STILL_OPEN });
  });
});

describe('ReviewService full mode and its reasons', () => {
  const previous = previousCheck([previousFinding()]);

  it('does a full review with a reason after a force-push (diverged history)', async () => {
    const { service, reviewRequest } = await setup({
      ...base,
      previous,
      comparison: { relation: CommitRelation.DIVERGED, files: [], truncated: false },
    });
    const outcome = completed(await service.review(TEST_REF, RunTrigger.MANUAL));
    expect(outcome.tracking.scope).toEqual({
      mode: ReviewMode.FULL,
      reason: FullReviewReason.HISTORY_REWRITTEN,
    });
    expect(outcome.markdown).toContain('Повне рев’ю:');
    expect(statuses(outcome)).toEqual({ 'fp-cart': FindingStatus.NEEDS_RECHECK });
    expect(reviewRequest()).toContain('fp-cart');
    expect(outcome.tracking.reviewedFileCount).toBe(3);
  });

  it('falls back to a full review when the compare fails', async () => {
    const { service } = await setup({ ...base, previous, comparison: new Error('404') });
    const outcome = completed(await service.review(TEST_REF, RunTrigger.MANUAL));
    expect(outcome.tracking.scope).toEqual({
      mode: ReviewMode.FULL,
      reason: FullReviewReason.COMPARE_FAILED,
    });
  });

  it('does a full review when asked, even though an incremental one is possible', async () => {
    const { service } = await setup({ ...base, previous });
    const outcome = completed(
      await service.review(TEST_REF, RunTrigger.MANUAL, { mode: RequestedMode.FULL }),
    );
    expect(outcome.tracking.scope).toEqual({
      mode: ReviewMode.FULL,
      reason: FullReviewReason.REQUESTED,
    });
  });

  it.each([
    ['there is no previous review', { previous: null }, FullReviewReason.NO_PREVIOUS],
    [
      'the previous marker is from another author',
      { previous: previousCheck([previousFinding()], { trusted: false }) },
      FullReviewReason.PREVIOUS_UNREADABLE,
    ],
    [
      'the previous marker has no tracked state',
      { previous: previousCheck([], { withState: false }) },
      FullReviewReason.PREVIOUS_UNREADABLE,
    ],
    [
      'the previous review left gaps',
      { previous: previousCheck([previousFinding()], { complete: false }) },
      FullReviewReason.PREVIOUS_INCOMPLETE,
    ],
  ])('records the reason when %s', async (_name, options, reason) => {
    const { service } = await setup({ ...base, ...options });
    const outcome = completed(await service.review(TEST_REF, RunTrigger.MANUAL));
    expect(outcome.tracking.scope).toEqual({ mode: ReviewMode.FULL, reason });
    expect(outcome.tracking.hadPrevious).toBe(reason === FullReviewReason.PREVIOUS_INCOMPLETE);
  });

  it('never carries state from an untrusted marker into the review', async () => {
    const { service } = await setup({
      ...base,
      previous: previousCheck([previousFinding()], { trusted: false }),
    });
    const outcome = completed(await service.review(TEST_REF, RunTrigger.MANUAL));
    expect(outcome.tracking.findings).toEqual([]);
  });
});
