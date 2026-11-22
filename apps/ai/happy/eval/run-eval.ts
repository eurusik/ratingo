import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { RunTrigger } from '@ratingo/ai-core';

import { REVIEW_CONFIG, type ReviewConfig } from '../src/config/config.constants';
import { ConfigModule } from '../src/config/config.module';
import { AiCoreModule } from '../src/core/ai-core.module';
import { FileStatus } from '../src/modules/review/domain/entities/pull-request';
import { ReviewStatus } from '../src/modules/review/domain/entities/review-outcome';
import {
  buildChangedFile,
  buildFakeCodeHost,
  buildPullRequest,
} from '../src/modules/review/infrastructure/testing/fake-code-host.testing';
import {
  DeepReviewService,
  ReviewModule,
  ReviewService,
  TriageService,
} from '../src/modules/review/public';

import { FolderCheckSourceAdapter } from '../src/modules/review/infrastructure/adapters/folder.check-source-adapter';
import { RecordingCheckMetrics } from '../src/modules/review/infrastructure/testing/recording-check-metrics.testing';

import { CheckOutcome } from '../src/modules/review/domain/entities/check';

import { buildCaseDump, type CaseDump } from './case-dump';
import { EVAL_CASES } from './cases';
import {
  EVAL_RULES,
  baseLinesOf,
  changedLinesOf,
  renderPatch,
  siblingChangedFiles,
  type EvalCase,
} from './eval-case';
import { scoreCase, summarize, type CaseResult, type CaseScore } from './scorer';

const CHECKS_PATH = path.resolve(__dirname, '../agent/checks');
const EVAL_REPOSITORY = 'eval/cases';
const MIN_LINES_TO_REVIEW = 25;
const HEAD_SHA = 'evalhead';
const BASE_SHA = 'evalbase';
const PERCENT = 100;
const PERCENT_DECIMALS = 0;
const COST_DECIMALS = 4;
const KIND_COLUMN_WIDTH = 19;
const ID_COLUMN_WIDTH = 30;

const contentsOf = (testCase: EvalCase): Record<string, string> => {
  const base = baseLinesOf(testCase);
  const extra = Object.entries(testCase.extraFiles ?? {}).flatMap(([filePath, lines]) => [
    [`${HEAD_SHA}:${filePath}`, lines.join('\n')],
    [`${BASE_SHA}:${filePath}`, lines.join('\n')],
  ]);
  const siblings = (testCase.siblingFiles ?? []).map((sibling) => [
    `${HEAD_SHA}:${sibling.path}`,
    sibling.lines.join('\n'),
  ]);
  return Object.fromEntries([
    ...siblings,
    [`${HEAD_SHA}:${testCase.path}`, testCase.lines.join('\n')],
    ...(base === null ? [] : [[`${BASE_SHA}:${testCase.path}`, base.join('\n')]]),
    ...extra,
  ]);
};

const hostFor = (testCase: EvalCase) =>
  buildFakeCodeHost({
    pr: buildPullRequest({
      ref: { owner: 'eval', repo: 'cases', number: 1 },
      headSha: HEAD_SHA,
      baseSha: BASE_SHA,
      headRepository: EVAL_REPOSITORY,
      title: `Update ${path.basename(testCase.path)}`,
      body: '',
    }),
    files: [
      buildChangedFile({
        path: testCase.path,
        status: testCase.changed === undefined ? FileStatus.ADDED : FileStatus.MODIFIED,
        additions: Math.max(changedLinesOf(testCase).length, MIN_LINES_TO_REVIEW),
        deletions: 0,
        patch: renderPatch(testCase),
      }),
      ...siblingChangedFiles(testCase),
    ],
    contents: contentsOf(testCase),
    rules: [...EVAL_RULES],
  });

const percent = (value: number | null): string =>
  value === null ? 'n/a' : `${(value * PERCENT).toFixed(PERCENT_DECIMALS)}%`;

async function main(): Promise<void> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN ?? 'not-used-by-eval',
  };
  const structureOnly = (env.AI_MODEL_REVIEW ?? 'stub:review').startsWith('stub:');

  @Module({ imports: [ConfigModule.forCli(env, EVAL_REPOSITORY), AiCoreModule, ReviewModule] })
  class EvalModule {}

  const app = await NestFactory.createApplicationContext(EvalModule, { logger: ['error'] });
  try {
    const triage = app.get(TriageService, { strict: false });
    const deepReview = app.get(DeepReviewService, { strict: false });
    const checkSource = await FolderCheckSourceAdapter.load(CHECKS_PATH);
    const config = app.get<ReviewConfig>(REVIEW_CONFIG, { strict: false });
    const scores: CaseScore[] = [];
    const dumps: CaseDump[] = [];
    let costUsd = 0;
    for (const testCase of EVAL_CASES) {
      const recorder = new RecordingCheckMetrics();
      const service = new ReviewService(
        hostFor(testCase),
        config,
        triage,
        deepReview,
        checkSource,
        recorder,
      );
      const outcome = await service.review(
        { owner: 'eval', repo: 'cases', number: 1 },
        RunTrigger.MANUAL,
      );
      costUsd += outcome.costUsd;
      const completed =
        outcome.status === ReviewStatus.REVIEWED || outcome.status === ReviewStatus.INCOMPLETE;
      const selectedCheckIds = recorder.events
        .filter((event) => event.outcome === CheckOutcome.SELECTED)
        .map((event) => event.checkId);
      const result: CaseResult = {
        caseId: testCase.id,
        kind: testCase.kind,
        selectedCheckIds,
        findings: completed ? outcome.findings : [],
        questions: completed ? outcome.questions : [],
        reviewedFiles: completed ? outcome.reviewedFiles : [],
      };
      scores.push(scoreCase(testCase, result));
      dumps.push(buildCaseDump(testCase, outcome, selectedCheckIds));
      process.stdout.write(
        `${testCase.kind.padEnd(KIND_COLUMN_WIDTH)} ${testCase.id.padEnd(ID_COLUMN_WIDTH)} status=${outcome.status} findings=${result.findings.length} questions=${result.questions.length}\n`,
      );
    }
    const metrics = summarize(scores);
    if (env.EVAL_DUMP !== undefined && env.EVAL_DUMP !== '') {
      await writeFile(
        env.EVAL_DUMP,
        `${JSON.stringify({ summary: metrics, cases: dumps }, null, 2)}\n`,
      );
    }
    process.stdout.write(
      [
        '',
        `cases: ${metrics.cases}`,
        `precision: ${percent(metrics.precision)}`,
        `recall: ${percent(metrics.recall)}`,
        `false positives: ${metrics.falsePositives}`,
        `false positives on protected negatives: ${metrics.protectedFalsePositives}`,
        `off target on the expected check: ${metrics.offTargetOnExpectedCheck}`,
        `off target on another selected check: ${metrics.offTargetOnOtherCheck}`,
        `off target outside any selected check: ${metrics.offTargetOutsideChecks}`,
        ...Object.entries(metrics.byCheck)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(
            ([checkId, entry]) =>
              `findings by check ${checkId}: ${entry.findings} (false positives ${entry.falsePositives})`,
          ),
        `core files covered by the careful review: ${percent(metrics.coreFilesCoverage)}`,
        `unknown cases answered with a question: ${percent(metrics.unknownAsQuestionRate)}`,
        `question noise on known cases: ${metrics.noiseQuestions}`,
        `cost: $${costUsd.toFixed(COST_DECIMALS)}`,
        structureOnly
          ? 'stub model: structure check only, the metrics above say nothing about quality'
          : 'real model: compare the metrics with the previous run',
        '',
      ].join('\n'),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Eval failed'}\n`);
  process.exit(1);
});
