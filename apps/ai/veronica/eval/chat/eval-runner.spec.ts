import fc from 'fast-check';

import { ChatOutcome } from '../../src/modules/chat/domain/constants/chat.constants';

import { InvalidRepeatPolicyError } from './aggregate';
import { EvalKind, type EvalCase } from './eval-case';
import { runEval, type AgentRun, type EvalPorts } from './eval-runner';
import { JudgeUnavailableError, type JudgeInput, type JudgePort } from './judge';
import { mapWithLimit } from './concurrency';

const GOOD = 'good answer';
const BAD = 'bad answer';

const makeCase = (id: string, overrides: Partial<EvalCase> = {}): EvalCase => ({
  id,
  kind: EvalKind.KNOWN,
  question: `question ${id}`,
  fixtures: [],
  requiredTools: [],
  expectations: { conveys: ['Says something.'] },
  reference: { calls: [], answer: GOOD },
  ...overrides,
});

const agentRun = (
  answer: string,
  overrides: Partial<AgentRun['result']> = {},
  costUsd = 0.01,
): AgentRun => ({
  costUsd,
  result: {
    caseId: 'x',
    calledKeys: [],
    answer,
    outcome: ChatOutcome.ANSWERED,
    flaggedNumbers: [],
    rawModelOutput: '',
    ...overrides,
  },
});

const answerJudge = (costUsd = 0.005): JudgePort => ({
  judge: async (input: JudgeInput) => ({
    costUsd,
    verdicts: input.expectations.map((expectation) => ({
      ...expectation,
      satisfied: input.answer === GOOD,
      reason: input.answer === GOOD ? 'ok' : 'not the good answer',
    })),
  }),
});

const scriptedAgent = (
  pattern: Readonly<Record<string, readonly boolean[]>>,
): EvalPorts['runAgent'] => {
  const calls = new Map<string, number>();
  return async (testCase) => {
    const index = calls.get(testCase.id) ?? 0;
    calls.set(testCase.id, index + 1);
    return agentRun(
      (pattern[testCase.id] ?? [true])[index % (pattern[testCase.id] ?? [true]).length]
        ? GOOD
        : BAD,
    );
  };
};

const CONFIG = { repeat: { runs: 3, passAt: 2 }, concurrency: 2, maxCostUsd: 100 };

describe('runEval', () => {
  it('runs every case the configured number of times and aggregates the runs', async () => {
    const result = await runEval(
      [makeCase('steady'), makeCase('wobbly'), makeCase('broken')],
      {
        runAgent: scriptedAgent({
          steady: [true, true, true],
          wobbly: [true, false, true],
          broken: [false, false, false],
        }),
        judge: answerJudge(),
      },
      CONFIG,
    );
    expect(result.outcomes.map((o) => [o.caseId, o.passes, o.passed, o.flaky])).toEqual([
      ['steady', 3, true, false],
      ['wobbly', 2, true, true],
      ['broken', 0, false, false],
    ]);
    expect(result.stoppedForCost).toBe(false);
  });

  it('adds up the agent and the judge cost separately', async () => {
    const result = await runEval(
      [makeCase('a'), makeCase('b')],
      { runAgent: async () => agentRun(GOOD, {}, 0.02), judge: answerJudge(0.003) },
      CONFIG,
    );
    expect(result.agentCostUsd).toBeCloseTo(6 * 0.02);
    expect(result.judgeCostUsd).toBeCloseTo(6 * 0.003);
  });

  it('never runs more tasks at once than the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const runAgent: EvalPorts['runAgent'] = async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return agentRun(GOOD);
    };
    await runEval(
      Array.from({ length: 6 }, (_, index) => makeCase(`c${index}`)),
      { runAgent, judge: answerJudge() },
      { ...CONFIG, concurrency: 3 },
    );
    expect(peak).toBe(3);
  });

  it('reports each case once, when its last run is done', async () => {
    const finished: string[] = [];
    await runEval(
      [makeCase('a'), makeCase('b')],
      { runAgent: scriptedAgent({}), judge: answerJudge() },
      { ...CONFIG, onCaseFinished: (outcome) => finished.push(outcome.caseId) },
    );
    expect([...finished].sort()).toEqual(['a', 'b']);
  });

  it('keeps going and fails the run when the agent throws, without leaking a secret', async () => {
    const runAgent: EvalPorts['runAgent'] = async () => {
      throw new Error('boom with sk-ant-secret-secret-secret-1234');
    };
    const result = await runEval([makeCase('a')], { runAgent, judge: answerJudge() }, CONFIG);
    const [run] = result.outcomes[0].runs;
    expect(run.passed).toBe(false);
    expect(run.problem).toContain('boom');
    expect(run.problem).not.toContain('sk-ant-secret');
  });

  it('marks a run the judge could not score as a problem, not as a wrong answer', async () => {
    const judge: JudgePort = {
      judge: async () => {
        throw new JudgeUnavailableError('timeout');
      },
    };
    const result = await runEval([makeCase('a')], { runAgent: scriptedAgent({}), judge }, CONFIG);
    expect(result.outcomes[0].runs.every((run) => run.problem?.includes('timeout'))).toBe(true);
    expect(result.outcomes[0].passed).toBe(false);
  });

  it('does not pay the judge for a fallback answer', async () => {
    let judged = 0;
    const judge: JudgePort = {
      judge: async (input) => {
        judged += 1;
        return answerJudge().judge(input);
      },
    };
    const result = await runEval(
      [makeCase('a')],
      { runAgent: async () => agentRun('SNAPSHOT', { outcome: ChatOutcome.FALLBACK }), judge },
      CONFIG,
    );
    expect(judged).toBe(0);
    expect(result.outcomes[0].runs.every((run) => run.fellBack)).toBe(true);
    expect(result.judgeCostUsd).toBe(0);
  });

  it('checks the tools of each run, not only the answer', async () => {
    const result = await runEval(
      [makeCase('a', { requiredTools: ['job_failures'] })],
      {
        runAgent: async () => agentRun(GOOD, { calledKeys: ['logs_search'] }),
        judge: answerJudge(),
      },
      CONFIG,
    );
    expect(result.outcomes[0].runs[0]).toMatchObject({ toolsOk: false, factsOk: true });
  });

  it('stops starting runs once the cost cap is reached and returns only finished cases', async () => {
    const result = await runEval(
      Array.from({ length: 5 }, (_, index) => makeCase(`c${index}`)),
      { runAgent: async () => agentRun(GOOD, {}, 0.5), judge: answerJudge(0) },
      { repeat: { runs: 1, passAt: 1 }, concurrency: 1, maxCostUsd: 1 },
    );
    expect(result.stoppedForCost).toBe(true);
    expect(result.outcomes.map((outcome) => outcome.caseId)).toEqual(['c0', 'c1']);
  });

  it('refuses a pass threshold above the number of runs', async () => {
    await expect(
      runEval(
        [makeCase('a')],
        { runAgent: scriptedAgent({}), judge: answerJudge() },
        {
          ...CONFIG,
          repeat: { runs: 2, passAt: 3 },
        },
      ),
    ).rejects.toThrow(InvalidRepeatPolicyError);
  });

  it('turns any pattern of good and bad runs into the matching passes, in case order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }), {
          minLength: 1,
          maxLength: 6,
        }),
        fc.integer({ min: 1, max: 4 }),
        async (patterns, concurrency) => {
          const cases = patterns.map((_, index) => makeCase(`c${index}`));
          const pattern = Object.fromEntries(patterns.map((flags, index) => [`c${index}`, flags]));
          const result = await runEval(
            cases,
            { runAgent: scriptedAgent(pattern), judge: answerJudge() },
            { ...CONFIG, concurrency },
          );
          expect(result.outcomes.map((outcome) => outcome.caseId)).toEqual(cases.map((c) => c.id));
          result.outcomes.forEach((outcome, index) => {
            const passes = patterns[index].filter(Boolean).length;
            expect(outcome.passes).toBe(passes);
            expect(outcome.passed).toBe(passes >= 2);
            expect(outcome.flaky).toBe(passes > 0 && passes < 3);
          });
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('mapWithLimit', () => {
  it('keeps the result order of the items', async () => {
    const results = await mapWithLimit([3, 1, 2], 2, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, value));
      return value * 10;
    });
    expect(results).toEqual([30, 10, 20]);
  });

  it('works with a limit larger than the items, a zero limit and no items', async () => {
    expect(await mapWithLimit([1, 2], 10, async (value) => value)).toEqual([1, 2]);
    expect(await mapWithLimit([1, 2], 0, async (value) => value)).toEqual([1, 2]);
    expect(await mapWithLimit([], 3, async (value) => value)).toEqual([]);
  });
});
