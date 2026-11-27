import { FixedClock } from '@ratingo/ai-core';

import { GrafanaLokiLogsAdapter } from '../logs/grafana-loki.logs-adapter';
import { LogsSearchExecutor } from '../logs/logs-search.executor';

import { createLokiSimulator, type LokiScenario } from './loki.simulator';

const NOW_MS = Date.UTC(2026, 10, 26, 12, 0, 0);
const MINUTE_MS = 60_000;
const CONNECTION = { baseUrl: 'https://loki.example.invalid', user: '1', token: 'token' };

const record = (minutesAgo: number, service: string, message: string, level = 'error') => ({
  service,
  atMs: NOW_MS - minutesAgo * MINUTE_MS,
  level,
  fields: { context: 'Sync', message },
});

const executorFor = (scenario: LokiScenario) =>
  new LogsSearchExecutor(
    new GrafanaLokiLogsAdapter(CONNECTION, createLokiSimulator(NOW_MS)(scenario)),
    new FixedClock(NOW_MS),
  );

const groupsOf = (result: unknown): { sample: { message: string } }[] => {
  const output = result as { withAllRows(): { groups: { sample: { message: string } }[] } };
  return output.withAllRows().groups;
};

describe('createLokiSimulator', () => {
  const scenario: LokiScenario = {
    records: [
      record(5, 'ratingo-worker', 'TMDB API: Request timeout'),
      record(10, 'ratingo-worker', 'Queue stalled', 'warn'),
      record(15, 'ratingo-api', 'Unhandled rejection'),
    ],
  };

  it('answers the query the real log search builds, for one service and one level', async () => {
    const result = await executorFor(scenario).run({ service: 'ratingo-worker' });

    expect(groupsOf(result).map((group) => group.sample.message)).toEqual([
      'TMDB API: Request timeout',
    ]);
  });

  it('includes warnings when the level is warn', async () => {
    const result = await executorFor(scenario).run({ service: 'ratingo-worker', level: 'warn' });

    expect(groupsOf(result)).toHaveLength(2);
  });

  it('filters by a part of the message in any letter case', async () => {
    const result = await executorFor(scenario).run({ service: 'ratingo-worker', text: 'TIMEOUT' });

    expect(groupsOf(result)).toHaveLength(1);
  });

  it('fails with the configured status', async () => {
    const failing = executorFor({ records: [], failWithStatus: 429 });

    await expect(failing.run({ service: 'ratingo-worker' })).rejects.toThrow(
      'logs_search is unavailable: rate_limit',
    );
  });

  it('refuses a query outside the shapes the log search builds', async () => {
    const response = await createLokiSimulator(NOW_MS)(scenario)(
      new URL('https://loki.example.invalid/loki/api/v1/query_range?query=%7Bjob%3D%22x%22%7D'),
    );

    expect(response.status).toBe(400);
  });
});
