import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';

import {
  StubModelAdapter,
  StubScenario,
  SystemClock,
  createModelProviders,
  createStubScript,
  parseModelRef,
  priceFor,
  type ModelPort,
} from '@ratingo/ai-core';

import { MODEL_PRICES } from '../../src/config/models.config';
import { loadVeronicaAgentFolder } from '../../src/core/agent-folder';

import { summarize, type CaseOutcome, type EvalSummary } from './aggregate';
import { buildBaseline, diffBaseline, type Baseline } from './baseline-diff';
import { readBaselineFile, writeBaselineFile } from './baseline-file';
import type { CalibrationReport } from './calibration';
import { measureJudgeAgreement } from './calibration-runner';
import { CALIBRATION_ITEMS } from './calibration.set';
import { EVAL_CASES } from './cases';
import type { EvalCase } from './eval-case';
import { parseEvalOptions, type EvalOptions } from './eval-options';
import { runEval, type EvalRun } from './eval-runner';
import { explorerEval, needsExplorerDatabase } from './explorer-eval-database';
import { isStubModel, runCase } from './harness';
import type { JudgePort } from './judge';
import { ModelJudge } from './model-judge';
import { ReferenceJudge } from './reference-judge';
import { renderCalibration, renderCase, renderDiff, renderSummary } from './report';

const DEFAULT_MODEL = 'stub:digest';
const ANTHROPIC_PROVIDER = 'anthropic';
const ANTHROPIC_MAX_RETRIES = 3;
const JSON_INDENT = 2;
const EXIT_REGRESSION = 1;
const EXIT_INCOMPLETE = 2;

interface RunIdentity {
  modelRef: string;
  structureOnly: boolean;
  apiKey: string | undefined;
}

interface RunContext {
  identity: RunIdentity;
  options: EvalOptions;
  baseline: Baseline | null;
  skippedCases: readonly string[];
}

interface ExecutedCases {
  run: EvalRun;
  skippedCases: readonly string[];
}

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
  if (ref.provider !== ANTHROPIC_PROVIDER) {
    throw new Error(`The judge must be an Anthropic model, got "${options.judgeModel}"`);
  }
  const providers = createModelProviders({
    stub: new StubModelAdapter(createStubScript(StubScenario.NORMAL)),
    anthropicApiKey: apiKey,
    anthropicMaxRetries: ANTHROPIC_MAX_RETRIES,
  });
  const port: ModelPort | undefined = providers[ref.provider];
  if (port === undefined) throw new Error('The judge model needs ANTHROPIC_API_KEY');
  return new ModelJudge(port, ref.model, priceFor(MODEL_PRICES, options.judgeModel));
};

const printCase = (outcome: CaseOutcome): void => write(renderCase(outcome));

const executeCases = async (
  identity: RunIdentity,
  options: EvalOptions,
  judge: JudgePort,
): Promise<ExecutedCases> => {
  const folder = await loadVeronicaAgentFolder();
  const setup = {
    modelRef: identity.modelRef,
    anthropicApiKey: identity.apiKey,
    anthropicMaxRetries: ANTHROPIC_MAX_RETRIES,
  };
  const {
    runnable,
    skipped: skippedCases,
    notice,
  } = explorerEval.plan(selectCases(options.only), needsExplorerDatabase);
  if (notice !== null) write(notice);
  await explorerEval.startIfConfigured();
  try {
    const run = await runEval(
      runnable,
      { runAgent: (testCase) => runCase(testCase, setup, folder), judge },
      {
        repeat: { runs: options.runs, passAt: options.passAt },
        concurrency: options.concurrency,
        maxCostUsd: options.maxCostUsd,
        onCaseFinished: printCase,
      },
    );
    return { run, skippedCases };
  } finally {
    await explorerEval.stop();
  }
};

const printSummary = (
  { identity, options }: RunContext,
  run: EvalRun,
  summary: EvalSummary,
): void =>
  write(
    `\n${renderSummary(summary, {
      model: identity.modelRef,
      judgeModel: identity.structureOnly ? 'reference comparison (no model)' : options.judgeModel,
      runs: options.runs,
      passAt: options.passAt,
      agentCostUsd: run.agentCostUsd,
      judgeCostUsd: run.judgeCostUsd,
      structureOnly: identity.structureOnly,
      stoppedForCost: run.stoppedForCost,
    })}`,
  );

const dumpRun = async (path: string, summary: EvalSummary, run: EvalRun): Promise<void> => {
  await writeFile(path, `${JSON.stringify({ summary, cases: run.outcomes }, null, JSON_INDENT)}\n`);
};

const saveBaseline = async ({ identity, options }: RunContext, run: EvalRun): Promise<void> => {
  await writeBaselineFile(
    options.baselinePath,
    buildBaseline(run.outcomes, {
      model: identity.modelRef,
      judgeModel: options.judgeModel,
      runs: options.runs,
      passAt: options.passAt,
      savedAtMs: new SystemClock().nowMs(),
    }),
  );
  write(`baseline saved to ${options.baselinePath}`);
};

const exitCodeAgainstBaseline = (
  { options, baseline, skippedCases }: RunContext,
  run: EvalRun,
): number => {
  if (baseline === null) {
    write(`no baseline at ${options.baselinePath}: nothing to compare with`);
    return 0;
  }
  const diff = diffBaseline(baseline, run.outcomes, {
    fullRun: options.only === null && skippedCases.length === 0,
  });
  write(`\ncompared with the baseline at ${options.baselinePath}:\n${renderDiff(diff)}`);
  return diff.regressions.length > 0 ? EXIT_REGRESSION : 0;
};

const reportRun = async (context: RunContext, run: EvalRun): Promise<number> => {
  const { identity, options } = context;
  const summary = summarize(run.outcomes);
  printSummary(context, run, summary);
  if (options.dumpPath !== null) await dumpRun(options.dumpPath, summary, run);
  if (identity.structureOnly) return summary.failedCases.length > 0 ? EXIT_REGRESSION : 0;
  if (run.stoppedForCost || summary.unscorableRuns > 0) {
    write('the results are incomplete: not compared with the baseline and not saved');
    return EXIT_INCOMPLETE;
  }
  const exitCode = exitCodeAgainstBaseline(context, run);
  if (options.saveBaseline && context.skippedCases.length > 0) {
    write(`baseline not saved: ${context.skippedCases.length} cases were skipped`);
    return Math.max(exitCode, EXIT_INCOMPLETE);
  }
  if (options.saveBaseline) await saveBaseline(context, run);
  return exitCode;
};

const calibrate = async (options: EvalOptions, judge: JudgePort): Promise<CalibrationReport> => {
  const report = await measureJudgeAgreement(
    CALIBRATION_ITEMS,
    EVAL_CASES,
    judge,
    options.concurrency,
  );
  write(`\n${renderCalibration(report)}`);
  return report;
};

const identityFromEnvironment = (): RunIdentity => {
  const modelRef = process.env.AI_MODEL_FAST ?? DEFAULT_MODEL;
  const structureOnly = isStubModel(modelRef);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!structureOnly && (apiKey ?? '').trim() === '') {
    throw new Error(
      `AI_MODEL_FAST=${modelRef} needs ANTHROPIC_API_KEY in this process environment`,
    );
  }
  return { modelRef, structureOnly, apiKey };
};

async function main(): Promise<number> {
  const identity = identityFromEnvironment();
  const options = parseEvalOptions(process.argv.slice(2), identity.structureOnly);
  if (identity.structureOnly && options.calibrate) {
    throw new Error('Calibration needs a real judge: set AI_MODEL_FAST to an Anthropic model');
  }
  const judge = identity.structureOnly
    ? new ReferenceJudge()
    : buildModelJudge(options, identity.apiKey);
  const baseline =
    identity.structureOnly || options.calibrateOnly
      ? null
      : await readBaselineFile(options.baselinePath);
  let exitCode = 0;
  if (!options.calibrateOnly) {
    const executed = await executeCases(identity, options, judge);
    exitCode = await reportRun(
      { identity, options, baseline, skippedCases: executed.skippedCases },
      executed.run,
    );
  }
  if (options.calibrate && !(await calibrate(options, judge)).trustworthy) {
    exitCode = Math.max(exitCode, EXIT_REGRESSION);
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
