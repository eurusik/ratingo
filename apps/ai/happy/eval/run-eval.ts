import 'reflect-metadata';

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

import { EVAL_CASES } from './cases';
import { EVAL_RULES, renderPatch, type EvalCase } from './eval-case';
import { scoreCase, summarize, type CaseResult, type CaseScore } from './scorer';

const EVAL_REPOSITORY = 'eval/cases';
const MIN_LINES_TO_REVIEW = 25;
const HEAD_SHA = 'evalhead';
const PERCENT = 100;
const PERCENT_DECIMALS = 0;
const COST_DECIMALS = 4;
const KIND_COLUMN_WIDTH = 19;
const ID_COLUMN_WIDTH = 30;

const hostFor = (testCase: EvalCase) =>
  buildFakeCodeHost({
    pr: buildPullRequest({
      ref: { owner: 'eval', repo: 'cases', number: 1 },
      headSha: HEAD_SHA,
      headRepository: EVAL_REPOSITORY,
    }),
    files: [
      buildChangedFile({
        path: testCase.path,
        status: FileStatus.ADDED,
        additions: Math.max(testCase.lines.length, MIN_LINES_TO_REVIEW),
        deletions: 0,
        patch: renderPatch(testCase.lines),
      }),
    ],
    contents: { [`${HEAD_SHA}:${testCase.path}`]: testCase.lines.join('\n') },
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
    const config = app.get<ReviewConfig>(REVIEW_CONFIG, { strict: false });
    const scores: CaseScore[] = [];
    let costUsd = 0;
    for (const testCase of EVAL_CASES) {
      const service = new ReviewService(hostFor(testCase), config, triage, deepReview);
      const outcome = await service.review(
        { owner: 'eval', repo: 'cases', number: 1 },
        RunTrigger.MANUAL,
      );
      costUsd += outcome.costUsd;
      const completed =
        outcome.status === ReviewStatus.REVIEWED || outcome.status === ReviewStatus.INCOMPLETE;
      const result: CaseResult = {
        caseId: testCase.id,
        kind: testCase.kind,
        findings: completed ? outcome.findings : [],
        questions: completed ? outcome.questions : [],
      };
      scores.push(scoreCase(testCase, result));
      process.stdout.write(
        `${testCase.kind.padEnd(KIND_COLUMN_WIDTH)} ${testCase.id.padEnd(ID_COLUMN_WIDTH)} status=${outcome.status} findings=${result.findings.length} questions=${result.questions.length}\n`,
      );
    }
    const metrics = summarize(scores);
    process.stdout.write(
      [
        '',
        `cases: ${metrics.cases}`,
        `precision: ${percent(metrics.precision)}`,
        `recall: ${percent(metrics.recall)}`,
        `false positives: ${metrics.falsePositives}`,
        `false positives on protected negatives: ${metrics.protectedFalsePositives}`,
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
