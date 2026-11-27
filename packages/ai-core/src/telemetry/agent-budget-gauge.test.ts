import { AI_METRIC_ATTRIBUTES, AI_METRIC_NAMES } from './ai-metric-names';
import { registerAgentBudgetGauge } from './agent-budget-gauge';
import { createRecordingMeter } from './recording-meter';

describe('registerAgentBudgetGauge', () => {
  it('reports the manifest budget under the agent label', () => {
    const probe = createRecordingMeter();

    registerAgentBudgetGauge(probe.meter, { agent: 'dume', perDayUsd: 1.5 });

    expect(probe.observed(AI_METRIC_NAMES.AGENT_BUDGET_DAY)).toEqual([
      { value: 1.5, attributes: { [AI_METRIC_ATTRIBUTES.AGENT]: 'dume' } },
    ]);
  });
});
