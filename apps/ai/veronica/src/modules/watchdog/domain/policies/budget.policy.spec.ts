import * as fc from 'fast-check';

import { AlertKey } from '../constants/watchdog-rules.constants';

import { evaluateAgentBudget, evaluateChatBudget, isBudgetNearlyExhausted } from './budget.policy';

describe('budget watchdog', () => {
  it('alerts at exactly 80% and not just below', () => {
    expect(isBudgetNearlyExhausted({ spentUsd: 0.4, limitUsd: 0.5 })).toBe(true);
    expect(isBudgetNearlyExhausted({ spentUsd: 0.3999, limitUsd: 0.5 })).toBe(false);
  });

  it('never alerts without a positive limit', () => {
    expect(isBudgetNearlyExhausted({ spentUsd: 5, limitUsd: 0 })).toBe(false);
  });

  it('is monotonic in spend', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 200, noNaN: true }),
        fc.double({ min: 0, max: 50, noNaN: true }),
        (limitUsd, spentUsd, extra) => {
          if (isBudgetNearlyExhausted({ spentUsd, limitUsd })) {
            expect(isBudgetNearlyExhausted({ spentUsd: spentUsd + extra, limitUsd })).toBe(true);
          }
        },
      ),
    );
  });

  it('names the agent and the chat separately with percent and money', () => {
    const agent = evaluateAgentBudget({ spentUsd: 0.42, limitUsd: 0.5 });
    expect(agent.key).toBe(AlertKey.BUDGET_AGENT);
    expect(agent.finding?.text).toContain('84%');
    expect(agent.finding?.text).toContain('$0.42 із $0.50');
    const chat = evaluateChatBudget({ spentUsd: 0.3, limitUsd: 0.3 });
    expect(chat.key).toBe(AlertKey.BUDGET_CHAT);
    expect(chat.finding?.text).toContain('100%');
  });

  it('is healthy below the threshold', () => {
    expect(evaluateAgentBudget({ spentUsd: 0.1, limitUsd: 0.5 }).finding).toBeNull();
  });
});
