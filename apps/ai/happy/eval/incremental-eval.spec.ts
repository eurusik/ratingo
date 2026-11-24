import * as path from 'node:path';

import {
  FixedClock,
  InMemoryRunRepository,
  RunTrigger,
  StubModelAdapter,
  loadAgentFolder,
} from '@ratingo/ai-core';

import type { ReviewConfig } from '../src/config/config.constants';
import {
  MODEL_ALIAS_NAMES,
  STUB_PROVIDER,
  STUB_REVIEW_MODEL,
  STUB_TRIAGE_MODEL,
} from '../src/config/models.config';
import { AgentRunner } from '../src/core/agent-runner.service';
import { createReviewStubScript } from '../src/core/stub-review.script';
import { CarryOverService } from '../src/modules/review/application/services/carry-over.service';
import { DeepReviewService } from '../src/modules/review/application/services/deep-review.service';
import { ReviewScopeService } from '../src/modules/review/application/services/review-scope.service';
import { ReviewService } from '../src/modules/review/application/services/review.service';
import { TriageService } from '../src/modules/review/application/services/triage.service';
import { FolderCheckSourceAdapter } from '../src/modules/review/infrastructure/adapters/folder.check-source-adapter';
import { RecordingCheckMetrics } from '../src/modules/review/infrastructure/testing/recording-check-metrics.testing';

import { INCREMENTAL_EVAL_CASES } from './incremental-cases';
import {
  buildIncrementalChecks,
  buildIncrementalHost,
  isDeterministicPass,
  scoreIncrementalCase,
  type IncrementalEvalCase,
} from './incremental-eval';

const AGENT_PATH = path.resolve(__dirname, '../agent');
const config: ReviewConfig = {
  allowedRepositories: ['eval/cases'],
  allowedAuthors: [],
  mentionHandle: 'happy-on-duty',
};

const runCase = async (testCase: IncrementalEvalCase) => {
  const folder = await loadAgentFolder(AGENT_PATH, { knownModelAliases: MODEL_ALIAS_NAMES });
  const runner = new AgentRunner(
    folder,
    { [STUB_PROVIDER]: new StubModelAdapter(createReviewStubScript()) },
    {
      fast: [`${STUB_PROVIDER}:${STUB_TRIAGE_MODEL}`],
      review: [`${STUB_PROVIDER}:${STUB_REVIEW_MODEL}`],
    },
    new InMemoryRunRepository(),
    new FixedClock(1_800_000_000_000),
  );
  const host = buildIncrementalHost(testCase);
  const service = new ReviewService(
    host,
    config,
    new TriageService(folder, runner),
    new DeepReviewService(folder, runner),
    await FolderCheckSourceAdapter.load(path.join(AGENT_PATH, 'checks')),
    new RecordingCheckMetrics(),
    new ReviewScopeService(host, buildIncrementalChecks(testCase)),
    new CarryOverService(host),
  );
  return service.review({ owner: 'eval', repo: 'cases', number: 1 }, RunTrigger.MANUAL);
};

describe('incremental eval cases', () => {
  it('cover a fix, an unrelated commit, a new bug and a force-push', () => {
    expect(INCREMENTAL_EVAL_CASES.map((testCase) => testCase.id)).toEqual([
      'incremental-fix-resolves-finding',
      'incremental-unrelated-commit-keeps-open',
      'incremental-new-bug-in-new-commit',
      'incremental-force-push-falls-back-to-full',
    ]);
  });

  it.each(INCREMENTAL_EVAL_CASES.map((testCase) => [testCase.id, testCase] as const))(
    'meets its deterministic expectations with the stub: %s',
    async (_id, testCase) => {
      const score = scoreIncrementalCase(testCase, await runCase(testCase));
      expect(score).toMatchObject({ statusMismatches: [], droppedFindings: [] });
      expect(isDeterministicPass(score)).toBe(true);
    },
  );

  it('leaves the model-dependent new finding unfound under the stub', async () => {
    const testCase = INCREMENTAL_EVAL_CASES.find((entry) => entry.expectation.newFindingAtLine);
    const score = scoreIncrementalCase(
      testCase as IncrementalEvalCase,
      await runCase(testCase as IncrementalEvalCase),
    );
    expect(score.newFindingFound).toBe(false);
  });
});
