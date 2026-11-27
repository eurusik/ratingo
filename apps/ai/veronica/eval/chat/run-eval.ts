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

import { summarize, type CaseOutcome } from './aggregate';
import { buildBaseline, diffBaseline, type BaselineDiff } from './baseline';
import { readBaselineFile, writeBaselineFile } from './baseline-file';
import { measureJudgeAgreement, type CalibrationReport } from './calibration';
import { CALIBRATION_ITEMS } from './calibration.set';
import { EVAL_CASES } from './cases';
import { parseEvalOptions, type EvalOptions } from './eval-options';
import { runEval, type EvalPorts, type EvalRun } from './eval-runner';
import type { EvalCase } from './eval-case';
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

const write = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

const selectCases = (only: readonly string[] | null): readonly EvalCase[] => {
  if (only === null) return EVAL_CASES;
  const unknown = only.filter((id) => !EVAL_CASES.some((testCase) => testCase.id === id));
  if (unknown.length > 0) throw new Error(`Unknown case id: ${unknown.join(', ')}`);
  return EVAL_CASES.filter((testCase) => only.includes(testCase.id));
};

const buildJudge = (options: EvalOptions, apiKey: string | undefined): JudgePort => {
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

const runCases = async (
  cases: readonly EvalCase[],
  options: EvalOptions,
  ports: EvalPorts,
): Promise<EvalRun> =>
  runEval(cases, ports, {
    repeat: { runs: options.runs, passAt: options.passAt },
    concurrency: options.concurrency,
    maxCostUsd: options.maxCostUsd,
    onCaseFinished: printCase,
  });

const compareWithBaseline = async (
  options: EvalOptions,
  run: EvalRun,
): Promise<BaselineDiff | null> => {
  const baseline = await readBaselineFile(options.baselinePath);
  if (baseline === null) {
    write(`no baseline at ${options.baselinePath}: nothing to compare with`);
    return null;
  }
  const diff = diffBaseline(baseline, run.outcomes);
  write(`\ncompared with the baseline at ${options.baselinePath}:\n${renderDiff(diff)}`);
  return diff;
};

const reportRun = async (
  options: EvalOptions,
  modelRef: string,
  structureOnly: boolean,
  run: EvalRun,
): Promise<number> => {
  const summary = summarize(run.outcomes);
  write(
    `\n${renderSummary(summary, {
      model: modelRef,
      judgeModel: structureOnly ? 'reference comparison (no model)' : options.judgeModel,
      runs: options.runs,
      passAt: options.passAt,
      agentCostUsd: run.agentCostUsd,
      judgeCostUsd: run.judgeCostUsd,
      structureOnly,
      stoppedForCost: run.stoppedForCost,
    })}`,
  );
  if (options.dumpPath !== null) {
    await writeFile(
      options.dumpPath,
      `${JSON.stringify({ summary, cases: run.outcomes }, null, JSON_INDENT)}\n`,
    );
  }
  if (run.stoppedForCost) return EXIT_INCOMPLETE;
  if (structureOnly) return summary.failedCases.length > 0 ? EXIT_REGRESSION : 0;
  const diff = await compareWithBaseline(options, run);
  if (options.saveBaseline) {
    await writeBaselineFile(
      options.baselinePath,
      buildBaseline(run.outcomes, {
        model: modelRef,
        judgeModel: options.judgeModel,
        runs: options.runs,
        passAt: options.passAt,
        savedAtMs: new SystemClock().nowMs(),
      }),
    );
    write(`baseline saved to ${options.baselinePath}`);
  }
  return diff !== null && diff.regressions.length > 0 ? EXIT_REGRESSION : 0;
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

async function main(): Promise<number> {
  const modelRef = process.env.AI_MODEL_FAST ?? DEFAULT_MODEL;
  const structureOnly = isStubModel(modelRef);
  const options = parseEvalOptions(process.argv.slice(2), structureOnly);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!structureOnly && (apiKey ?? '').trim() === '') {
    throw new Error(
      `AI_MODEL_FAST=${modelRef} needs ANTHROPIC_API_KEY in this process environment`,
    );
  }
  if (structureOnly && options.calibrate) {
    throw new Error('Calibration needs a real judge: set AI_MODEL_FAST to an Anthropic model');
  }
  const judge: JudgePort = structureOnly ? new ReferenceJudge() : buildJudge(options, apiKey);
  let exitCode = 0;
  if (!options.calibrateOnly) {
    const folder = await loadVeronicaAgentFolder();
    const setup = { modelRef, anthropicApiKey: apiKey, anthropicMaxRetries: ANTHROPIC_MAX_RETRIES };
    const run = await runCases(selectCases(options.only), options, {
      runAgent: (testCase) => runCase(testCase, setup, folder),
      judge,
    });
    exitCode = await reportRun(options, modelRef, structureOnly, run);
  }
  if (options.calibrate) {
    const report = await calibrate(options, judge);
    if (!report.trustworthy) exitCode = Math.max(exitCode, EXIT_REGRESSION);
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
