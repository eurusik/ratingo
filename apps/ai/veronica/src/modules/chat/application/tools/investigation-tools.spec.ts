import {
  InvestigationTool,
  MetricTemplateName,
} from '../../domain/constants/investigation.constants';

import type { InvestigationExecutors } from './investigation-executors';
import { buildInvestigationTools } from './investigation-tools';

const NO_PARAMETERS = 'Takes no parameters, not even window.';

const metricsQueryDescription = (): string => {
  const tools = buildInvestigationTools({} as InvestigationExecutors);
  const tool = tools.find((candidate) => candidate.name === InvestigationTool.METRICS_QUERY);
  return tool?.definition.description ?? '';
};

const entryOf = (description: string, template: string): string => {
  const start = description.indexOf(`${template}: `);
  const ends = Object.values(MetricTemplateName)
    .map((name) => description.indexOf(` ${name}: `, start + 1))
    .filter((index) => index > start);
  return description.slice(start, ends.length === 0 ? undefined : Math.min(...ends));
};

describe('metrics_query description', () => {
  it('tells the model which templates take no parameters', () => {
    const description = metricsQueryDescription();
    expect(entryOf(description, 'infra_health')).toContain(NO_PARAMETERS);
    expect(entryOf(description, 'backup_status')).toContain(NO_PARAMETERS);
    expect(entryOf(description, 'scheduler_last_runs')).not.toContain(NO_PARAMETERS);
    expect(entryOf(description, 'queue_throughput')).not.toContain(NO_PARAMETERS);
  });

  it('tells the model that a missing last failure means no failure within the lookback', () => {
    expect(entryOf(metricsQueryDescription(), 'scheduler_last_runs')).toContain(
      'A missing last failure means no failed run was seen in the last eight days.',
    );
  });
});
