import 'reflect-metadata';
import { writeFile } from 'node:fs/promises';

import { EVAL_CASES } from './cases';
import { isStubModel, runCase } from './harness';
import { asPercent, scoreCase, summarize, type CaseScore } from './scorer';

const DEFAULT_MODEL = 'stub:digest';
const COST_DECIMALS = 4;
const ID_COLUMN_WIDTH = 28;

const mark = (ok: boolean): string => (ok ? 'ok' : 'FAIL');

async function main(): Promise<void> {
  const modelRef = process.env.AI_MODEL_FAST ?? DEFAULT_MODEL;
  const structureOnly = isStubModel(modelRef);
  if (!structureOnly && (process.env.ANTHROPIC_API_KEY ?? '').trim() === '') {
    throw new Error(
      `AI_MODEL_FAST=${modelRef} needs ANTHROPIC_API_KEY in this process environment`,
    );
  }
  const scores: CaseScore[] = [];
  const dump: unknown[] = [];
  let costUsd = 0;
  for (const testCase of EVAL_CASES) {
    const run = await runCase(testCase, {
      modelRef,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    });
    const score = scoreCase(testCase, run.result);
    scores.push(score);
    costUsd += run.costUsd;
    dump.push({ case: testCase.id, ...run.result, score });
    process.stdout.write(
      `${testCase.id.padEnd(ID_COLUMN_WIDTH)} tools=${mark(score.toolsOk)} facts=${mark(score.factsOk)} numbers=${score.unverifiedNumbers.length === 0 ? 'ok' : `UNVERIFIED(${score.unverifiedNumbers.join(',')})`} outcome=${run.result.outcome}\n`,
    );
  }
  const summary = summarize(scores);
  if (process.env.EVAL_DUMP !== undefined && process.env.EVAL_DUMP !== '') {
    await writeFile(
      process.env.EVAL_DUMP,
      `${JSON.stringify({ summary, cases: dump }, null, 2)}\n`,
    );
  }
  process.stdout.write(
    [
      '',
      `model: ${modelRef}`,
      `cases: ${summary.cases}`,
      `tool selection accuracy: ${asPercent(summary.toolSelectionAccuracy)}`,
      `fact accuracy: ${asPercent(summary.factAccuracy)}`,
      `cases with numbers not found in tool results: ${summary.hallucinatedNumbers}`,
      `cases that fell back to the raw snapshot (failed, not hallucinated): ${summary.fallbacks}`,
      `unknown questions answered honestly: ${asPercent(summary.unknownAnsweredHonestly)}`,
      `failed cases: ${summary.failedCases.join(', ') || 'none'}`,
      `cost: $${costUsd.toFixed(COST_DECIMALS)}`,
      structureOnly
        ? 'stub model replays the reference answers: this checks the harness, not the model'
        : 'real model: compare with the previous run',
      '',
    ].join('\n'),
  );
  if (structureOnly && summary.failedCases.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Eval failed'}\n`);
  process.exit(1);
});
