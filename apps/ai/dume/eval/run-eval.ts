import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';

import { Logger } from '@nestjs/common';
import {
  StubModelAdapter,
  SystemClock,
  createModelProviders,
  parseModelRef,
  priceFor,
  type ModelPort,
} from '@ratingo/ai-core';

import { MODEL_PRICES } from '../src/config/models.config';
import { createInvestigationStubScript } from '../src/core/stub-investigation.script';
import { summarize, type CaseOutcome, type EvalSummary } from './aggregate';
import { buildBaseline, diffBaseline, type Baseline } from './baseline-diff';
import { readBaselineFile, writeBaselineFile } from './baseline-file';
import { EVAL_CASES } from './cases/cases';
import type { EvalCase } from './eval-case';
import { runEval, type EvalRun } from './eval-runner';
import { createEvalEnvironment, runCase, type EvalEnvironment } from './harness';
import { ModelJudge, ReferenceJudge, type JudgePort } from './judge';
import { parseEvalOptions, type EvalOptions } from './options';
import { renderCase, renderDiff, renderSummary } from './report';

Logger.overrideLogger(['error']);

const DEFAULT_MODEL = 'stub:review';
const ANTHROPIC_PROVIDER = 'anthropic';
const ANTHROPIC_MAX_RETRIES = 3;
const JSON_INDENT = 2;
const EXIT_REGRESSION = 1;
const EXIT_INCOMPLETE = 2;

const write = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

const selectCases = (only: readonly string[] | null): readonly EvalCase[] => {
  if (only === null) return EVAL_CASES;
  const unknown = only.filter((id) => !EVAL_CASES.some((testCase) => testCase.id === id));
  if (unknown.length > 0) throw new Error(`Unknown case id: ${unknown.join(', ')}`);
  return EVAL_CASES.filter((testCase) => only.includes(testCase.id));
};

const buildModelJudge = (options: EvalOptions, apiKey: string | undefined): JudgePort => {
  const ref = parseModelRef(options.judgeModel);
  if (ref.provider !== ANTHROPIC_PROVIDER)
    throw new Error(`The judge must be an Anthropic model, got "${options.judgeModel}"`);
  const providers = createModelProviders({
    stub: new StubModelAdapter(createInvestigationStubScript()),
    anthropicApiKey: apiKey,
    anthropicMaxRetries: ANTHROPIC_MAX_RETRIES,
  });
  const port: ModelPort | undefined = providers[ref.provider];
  if (port === undefined) throw new Error('The judge model needs ANTHROPIC_API_KEY');
  return new ModelJudge(port, ref.model, priceFor(MODEL_PRICES, options.judgeModel));
};

const execute = (
  environment: EvalEnvironment,
  options: EvalOptions,
  judge: JudgePort,
): Promise<EvalRun> =>
  runEval(
    selectCases(options.only),
    { runAgent: (testCase) => runCase(testCase, environment), judge },
    {
      repeat: { runs: options.runs, passAt: options.passAt },
      concurrency: options.concurrency,
      maxCostUsd: options.maxCostUsd,
      onCaseFinished: (outcome: CaseOutcome) => write(renderCase(outcome)),
    },
  );

const printSummary = (
  environment: EvalEnvironment,
  options: EvalOptions,
  run: EvalRun,
  summary: EvalSummary,
): void =>
  write(
    `\n${renderSummary(summary, {
      model: environment.modelRef,
      judgeModel: environment.structureOnly
        ? 'reference comparison (no model)'
        : options.judgeModel,
      runs: options.runs,
      passAt: options.passAt,
      agentCostUsd: run.agentCostUsd,
      judgeCostUsd: run.judgeCostUsd,
      structureOnly: environment.structureOnly,
      stoppedForCost: run.stoppedForCost,
    })}`,
  );

const exitCodeAgainstBaseline = (
  options: EvalOptions,
  baseline: Baseline | null,
  run: EvalRun,
): number => {
  if (baseline === null) {
    write(`no baseline at ${options.baselinePath}: nothing to compare with`);
    return 0;
  }
  const diff = diffBaseline(baseline, run.outcomes, { fullRun: options.only === null });
  write(`\ncompared with the baseline at ${options.baselinePath}:\n${renderDiff(diff)}`);
  return diff.regressions.length > 0 ? EXIT_REGRESSION : 0;
};

async function main(): Promise<number> {
  const modelRef = process.env.AI_MODEL_REVIEW ?? DEFAULT_MODEL;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const environment = await createEvalEnvironment(modelRef, apiKey);
  if (!environment.structureOnly && (apiKey ?? '').trim() === '') {
    throw new Error(
      `AI_MODEL_REVIEW=${modelRef} needs ANTHROPIC_API_KEY in this process environment`,
    );
  }
  const options = parseEvalOptions(process.argv.slice(2), environment.structureOnly);
  const judge = environment.structureOnly ? new ReferenceJudge() : buildModelJudge(options, apiKey);
  const run = await execute(environment, options, judge);
  const summary = summarize(run.outcomes);
  printSummary(environment, options, run, summary);
  if (options.dumpPath !== null) {
    await writeFile(
      options.dumpPath,
      `${JSON.stringify({ summary, cases: run.outcomes }, null, JSON_INDENT)}\n`,
    );
  }
  if (environment.structureOnly) return summary.failedCases.length > 0 ? EXIT_REGRESSION : 0;
  if (run.stoppedForCost || summary.unscorableRuns > 0) {
    write('the results are incomplete: not compared with the baseline and not saved');
    return EXIT_INCOMPLETE;
  }
  const exitCode = exitCodeAgainstBaseline(
    options,
    await readBaselineFile(options.baselinePath),
    run,
  );
  if (options.saveBaseline) {
    await writeBaselineFile(
      options.baselinePath,
      buildBaseline(run.outcomes, {
        model: environment.modelRef,
        judgeModel: options.judgeModel,
        runs: options.runs,
        passAt: options.passAt,
        savedAtMs: new SystemClock().nowMs(),
      }),
    );
    write(`baseline saved to ${options.baselinePath}`);
  }
  return exitCode;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Eval failed'}\n`);
    process.exit(1);
  });
