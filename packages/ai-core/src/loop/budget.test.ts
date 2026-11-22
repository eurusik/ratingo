import * as fc from 'fast-check';
import { MessageRole, textMessage } from '../model/model.types';
import { BudgetLevel, buildBudgetLevels, estimateInputTokens, evaluateBudget } from './budget';
import type { BudgetLevelState } from './budget';

const levelArbitrary: fc.Arbitrary<BudgetLevelState> = fc.record({
  level: fc.constantFrom(...Object.values(BudgetLevel)),
  limitUsd: fc.double({ min: 0, max: 100, noNaN: true }),
  spentUsd: fc.double({ min: 0, max: 100, noNaN: true }),
});

const cost = fc.double({ min: 0, max: 200, noNaN: true });

const remaining = (state: BudgetLevelState): number => state.limitUsd - state.spentUsd;
const minRemaining = (levels: readonly BudgetLevelState[]): number =>
  Math.min(...levels.map(remaining));

describe('evaluateBudget', () => {
  it('allows any call when no level is configured', () => {
    expect(evaluateBudget([], 1_000_000)).toEqual({ allowed: true });
  });

  it('allows a call exactly when it fits under the strictest level', () => {
    fc.assert(
      fc.property(
        fc.array(levelArbitrary, { minLength: 1, maxLength: 6 }),
        cost,
        (levels, worstCase) => {
          expect(evaluateBudget(levels, worstCase).allowed).toBe(worstCase <= minRemaining(levels));
        },
      ),
    );
  });

  it('names the level with the least headroom when it denies', () => {
    fc.assert(
      fc.property(
        fc.array(levelArbitrary, { minLength: 1, maxLength: 6 }),
        cost,
        (levels, worstCase) => {
          const decision = evaluateBudget(levels, worstCase);
          if (decision.allowed) {
            return;
          }
          const namedHeadrooms = levels
            .filter((state) => state.level === decision.level)
            .map(remaining);
          expect(namedHeadrooms).toContain(minRemaining(levels));
          expect(decision.remainingUsd).toBe(minRemaining(levels));
          expect(decision.worstCaseUsd).toBe(worstCase);
        },
      ),
    );
  });

  it('never turns a denial into an allowance when a level is added', () => {
    fc.assert(
      fc.property(
        fc.array(levelArbitrary, { maxLength: 5 }),
        levelArbitrary,
        cost,
        (levels, extra, worstCase) => {
          const before = evaluateBudget(levels, worstCase).allowed;
          const after = evaluateBudget([...levels, extra], worstCase).allowed;
          expect(after && !before).toBe(false);
        },
      ),
    );
  });

  it('lets the per-call cap win even when the day has plenty left', () => {
    const levels = buildBudgetLevels(
      { perCallUsd: 0.01, perRunUsd: 1, perDayUsd: 10 },
      { taskUsd: 0, agentDayUsd: 0 },
      0,
    );
    expect(evaluateBudget(levels, 0.02)).toMatchObject({ allowed: false, level: BudgetLevel.CALL });
  });

  it('lets an almost-spent day cap win over a generous run cap', () => {
    const levels = buildBudgetLevels(
      { perRunUsd: 1, perDayUsd: 0.5 },
      { taskUsd: 0, agentDayUsd: 0.49 },
      0,
    );
    expect(evaluateBudget(levels, 0.05)).toMatchObject({
      allowed: false,
      level: BudgetLevel.AGENT_DAY,
    });
  });
});

describe('buildBudgetLevels', () => {
  it('counts the current run against the run, task and day levels', () => {
    const levels = buildBudgetLevels(
      { perRunUsd: 1, perTaskUsd: 2, perDayUsd: 3 },
      { taskUsd: 0.5, agentDayUsd: 1 },
      0.25,
    );
    expect(levels).toEqual([
      { level: BudgetLevel.RUN, limitUsd: 1, spentUsd: 0.25 },
      { level: BudgetLevel.TASK, limitUsd: 2, spentUsd: 0.75 },
      { level: BudgetLevel.AGENT_DAY, limitUsd: 3, spentUsd: 1.25 },
    ]);
  });

  it('skips levels that have no limit', () => {
    expect(buildBudgetLevels({}, { taskUsd: 0, agentDayUsd: 0 }, 0)).toEqual([]);
  });
});

describe('estimateInputTokens', () => {
  it('assumes at most two characters per token so Cyrillic text is not undercounted', () => {
    const text = 'Привіт, як справи сьогодні?';
    const tokens = estimateInputTokens({
      system: '',
      messages: [textMessage(MessageRole.USER, text)],
      tools: [],
    });
    expect(tokens).toBeGreaterThanOrEqual(text.length / 2);
  });

  it('grows with the transcript', () => {
    const small = estimateInputTokens({
      system: 'sys',
      messages: [textMessage(MessageRole.USER, 'hi')],
      tools: [],
    });
    const large = estimateInputTokens({
      system: 'sys',
      messages: [textMessage(MessageRole.USER, 'hi'.repeat(1000))],
      tools: [],
    });
    expect(large).toBeGreaterThan(small);
  });
});
