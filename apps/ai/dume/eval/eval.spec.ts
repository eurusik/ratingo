import { Logger } from '@nestjs/common';

import { summarize } from './aggregate';
import { ANSWERABLE_CASES } from './cases/answerable.cases';
import { EVAL_CASES } from './cases/cases';
import { INJECTION_CASES } from './cases/injection.cases';
import { RUNTIME_CASES } from './cases/runtime.cases';
import { UNKNOWN_CASES } from './cases/unknown.cases';
import { CaseKind, type EvalCase, type RuntimeSource } from './eval-case';
import { runEval } from './eval-runner';
import { createEvalEnvironment, runCase, type EvalEnvironment } from './harness';
import { ReferenceJudge } from './judge';
import { StaleCaseError } from './reference-script';

const MIN_CASES = 15;
const MAX_CASES = 30;
const MIN_UNKNOWN_CASES = 3;

describe('the investigation eval on the stub model', () => {
  let environment: EvalEnvironment;

  beforeAll(async () => {
    Logger.overrideLogger(false);
    environment = await createEvalEnvironment('stub:review', undefined);
  });

  it('keeps between 15 and 30 cases with unique ids, unknown questions and an injection case', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(MIN_CASES);
    expect(EVAL_CASES.length).toBeLessThanOrEqual(MAX_CASES);
    expect(new Set(EVAL_CASES.map((testCase) => testCase.id)).size).toBe(EVAL_CASES.length);
    expect(UNKNOWN_CASES.length).toBeGreaterThanOrEqual(MIN_UNKNOWN_CASES);
    expect(INJECTION_CASES.length).toBeGreaterThanOrEqual(1);
    expect(ANSWERABLE_CASES.every((testCase) => testCase.kind === CaseKind.ANSWERABLE)).toBe(true);
  });

  it('gives every case what a correct answer must convey and the evidence its claims point at', () => {
    for (const testCase of EVAL_CASES) {
      expect(testCase.conveys.length).toBeGreaterThan(0);
      expect(testCase.reference.answer.length).toBeGreaterThan(0);
      for (const claim of testCase.reference.claims) {
        expect(claim.evidence.every((index) => testCase.evidence[index] !== undefined)).toBe(true);
        expect(
          (claim.runtime ?? []).every((index) => testCase.runtimeSources?.[index] !== undefined),
        ).toBe(true);
      }
      if (testCase.kind === CaseKind.UNKNOWN) {
        expect(testCase.evidence).toEqual([]);
        expect(testCase.reference.unknowns.length).toBeGreaterThan(0);
      } else {
        expect(
          testCase.requiredFiles.length + (testCase.requiredEvidence ?? []).length,
        ).toBeGreaterThan(0);
        expect(
          testCase.requiredFiles.every((file) =>
            testCase.evidence.some((entry) => entry.path === file),
          ),
        ).toBe(true);
      }
    }
  });

  it('passes every case when the reference is replayed against this checkout, so every anchor still exists', async () => {
    const run = await runEval(
      EVAL_CASES,
      { runAgent: (testCase) => runCase(testCase, environment), judge: new ReferenceJudge() },
      { repeat: { runs: 1, passAt: 1 }, concurrency: 4, maxCostUsd: 1 },
    );

    const summary = summarize(run.outcomes);
    expect(
      run.outcomes
        .filter((outcome) => !outcome.passed)
        .map((outcome) => outcome.runs.flatMap((entry) => entry.failures)),
    ).toEqual([]);
    expect(summary).toMatchObject({
      passedCases: EVAL_CASES.length,
      fabricatedCitations: 0,
      unscorableRuns: 0,
      honestUnknownRate: 1,
    });
  });

  it('cites the rows and calls the tools returned, so the facts of a runtime case carry runtime evidence', async () => {
    const testCase = RUNTIME_CASES.find(
      (entry) => entry.id === 'tracked-show-errors-not-in-job-failures',
    ) as EvalCase;

    const outcome = await runCase(testCase, environment);

    expect(outcome.answer?.facts.flatMap((fact) => fact.evidence.map((row) => row.ref))).toEqual([
      'job_failures#1',
      'logs_search#1.1',
    ]);
    expect(outcome.answer?.assumptions).toEqual([]);
  });

  it('fails a runtime case whose cited row is not in what the tool returned', async () => {
    const testCase = RUNTIME_CASES[0] as EvalCase;
    const [source] = testCase.runtimeSources ?? [];
    const changed: EvalCase = {
      ...testCase,
      runtimeSources: [{ ...(source as RuntimeSource), anchor: 'no such row' }],
    };

    const outcome = await runCase(changed, environment);

    expect(outcome.answer?.facts.map((fact) => fact.text)).not.toContain(
      testCase.reference.claims[0]?.text,
    );
    expect(outcome.answer?.assumptions[0]?.problems[0]?.failure).toBe('evidence_not_shown');
  });

  it('fails a case whose answer differs from what the judge expects', async () => {
    const [first] = ANSWERABLE_CASES as readonly EvalCase[];
    const changed: EvalCase = {
      ...(first as EvalCase),
      reference: { ...(first as EvalCase).reference, answer: 'a different answer' },
    };
    const run = await runEval(
      [changed],
      {
        runAgent: (testCase) =>
          runCase(
            { ...testCase, reference: { ...testCase.reference, answer: 'what the agent says' } },
            environment,
          ),
        judge: new ReferenceJudge(),
      },
      { repeat: { runs: 1, passAt: 1 }, concurrency: 1, maxCostUsd: 1 },
    );

    expect(run.outcomes[0]?.passed).toBe(false);
  });

  it('reports a stale case instead of passing it when an anchor left the code', async () => {
    const [first] = ANSWERABLE_CASES as readonly EvalCase[];
    const stale: EvalCase = {
      ...(first as EvalCase),
      evidence: [
        {
          path: (first as EvalCase).evidence[0]?.path ?? '',
          anchor: 'this text is nowhere in the file',
          verifiedAt: '',
        },
      ],
    };

    await expect(runCase(stale, environment)).rejects.toBeInstanceOf(StaleCaseError);
  });
});
