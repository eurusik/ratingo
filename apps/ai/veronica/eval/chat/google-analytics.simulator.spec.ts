import * as fc from 'fast-check';

import { GA_INJECTION_CAMPAIGN } from './google-analytics.dataset';
import { SimulatedGaConnection } from './google-analytics.fake-server';
import {
  simulateRunFunnelReport,
  simulateRunRealtimeReport,
  simulateRunReport,
  simulatedFunnelUsers,
  simulatedRows,
} from './google-analytics.simulator';

const WEEK = [{ start_date: '7daysAgo', end_date: 'yesterday' }];
const TRAFFIC_DIMENSIONS = [
  'country',
  'deviceCategory',
  'sessionDefaultChannelGroup',
  'sessionSource',
  'sessionCampaignName',
  'newVsReturning',
];

const SEARCH_EVENT = { filter: { field_name: 'eventName', string_filter: { value: 'search' } } };

const rows = (input: Record<string, unknown>) => simulatedRows(simulateRunReport(input));
const sum = (values: readonly { value: number }[]) =>
  values.reduce((total, row) => total + row.value, 0);

describe('GA simulator', () => {
  it('answers any combination of traffic dimensions with the same total', () => {
    const total = sum(rows({ date_ranges: WEEK, dimensions: [], metrics: ['sessions'] }));
    fc.assert(
      fc.property(fc.subarray(TRAFFIC_DIMENSIONS, { maxLength: 3 }), (dimensions) => {
        expect(sum(rows({ date_ranges: WEEK, dimensions, metrics: ['sessions'] }))).toBe(total);
      }),
    );
  });

  it('gives a per-day series that adds up to the total for additive metrics', () => {
    const input = { date_ranges: WEEK, metrics: ['eventCount'] };
    const perDay = rows({ ...input, dimensions: ['date'] });
    expect(perDay.map((row) => row.keys[0])).toEqual(
      expect.arrayContaining(['20261115', '20261121']),
    );
    expect(perDay).toHaveLength(7);
    expect(sum(perDay)).toBe(sum(rows({ ...input, dimensions: [] })));
  });

  it('adds a dateRange dimension for two ranges, with names or date_range_N', () => {
    const result = simulateRunReport({
      date_ranges: [
        { start_date: '7daysAgo', end_date: 'yesterday' },
        { start_date: '14daysAgo', end_date: '8daysAgo' },
      ],
      dimensions: [],
      metrics: ['activeUsers'],
    });
    expect(result.ok && result.body.dimension_headers).toEqual([{ name: 'dateRange' }]);
    expect(
      simulatedRows(result)
        .map((row) => row.keys[0])
        .sort(),
    ).toEqual(['date_range_0', 'date_range_1']);
  });

  it('filters, orders and limits like GA', () => {
    const watchlist = rows({
      date_ranges: WEEK,
      dimensions: ['eventName'],
      metrics: ['eventCount'],
      dimension_filter: {
        filter: { field_name: 'eventName', string_filter: { value: 'add_to_watchlist' } },
      },
    });
    const pages = rows({
      date_ranges: WEEK,
      dimensions: ['pagePath'],
      metrics: ['screenPageViews'],
      order_bys: [{ metric: { metric_name: 'screenPageViews' }, desc: true }],
      limit: 2,
    });
    expect(watchlist.map((row) => row.keys[0])).toEqual(['add_to_watchlist']);
    expect(pages.map((row) => row.keys[0])).toEqual(['/', '/movies/dune-part-two']);
  });

  it('keeps the injection string as a campaign name in the data', () => {
    const campaigns = rows({
      date_ranges: WEEK,
      dimensions: ['sessionCampaignName'],
      metrics: ['sessions'],
    });
    expect(campaigns.map((row) => row.keys[0])).toContain(GA_INJECTION_CAMPAIGN);
  });

  it('answers page paths with views, users, sessions and engagement rate in one report', () => {
    const result = simulateRunReport({
      date_ranges: WEEK,
      dimensions: ['pagePath'],
      metrics: ['screenPageViews', 'activeUsers', 'sessions', 'engagementRate'],
      limit: 10,
    });
    expect(result.ok).toBe(true);
    const body = result.ok ? result.body : {};
    const table = body.rows as {
      dimension_values: { value: string }[];
      metric_values: { value: string }[];
    }[];
    expect(table.map((row) => row.dimension_values[0]?.value)).toContain('/movies/dune-part-two');
    for (const row of table) {
      const [views, users, sessions, rate] = row.metric_values.map((cell) => Number(cell.value));
      expect(users).toBeGreaterThan(0);
      expect(views).toBeGreaterThan(users ?? 0);
      expect(sessions).toBeGreaterThanOrEqual(users ?? 0);
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(1);
    }
  });

  it('counts the users behind one event', () => {
    const users = rows({
      date_ranges: WEEK,
      dimensions: ['eventName'],
      metrics: ['activeUsers'],
      dimension_filter: SEARCH_EVENT,
    });
    const events = rows({
      date_ranges: WEEK,
      dimensions: ['eventName'],
      metrics: ['eventCount'],
      dimension_filter: SEARCH_EVENT,
    });
    expect(users[0]?.value).toBeGreaterThan(0);
    expect(users[0]?.value).toBeLessThan(events[0]?.value ?? 0);
  });

  it('joins metrics from different data by the shared date dimension', () => {
    const joined = simulateRunReport({
      date_ranges: WEEK,
      dimensions: ['date'],
      metrics: ['activeUsers', 'screenPageViews', 'eventCount'],
    });
    const byDay = (metric: string) =>
      rows({ date_ranges: WEEK, dimensions: ['date'], metrics: [metric] }).map((row) => [
        row.keys[0],
        row.value,
      ]);
    const columns = (index: number) =>
      (
        (joined.ok ? joined.body.rows : []) as {
          dimension_values: { value: string }[];
          metric_values: { value: string }[];
        }[]
      ).map((row) => [row.dimension_values[0]?.value, Number(row.metric_values[index]?.value)]);
    const sorted = (pairs: unknown[][]) =>
      [...pairs].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(sorted(columns(0))).toEqual(sorted(byDay('activeUsers')));
    expect(sorted(columns(1))).toEqual(sorted(byDay('screenPageViews')));
    expect(sorted(columns(2))).toEqual(sorted(byDay('eventCount')));
  });

  it('returns GA-shaped errors for unknown names and incompatible fields', async () => {
    const connection = new SimulatedGaConnection([]);
    const unknown = await connection.callTool('run_report', {
      date_ranges: WEEK,
      dimensions: ['browserLanguage'],
      metrics: ['activeUsers'],
    });
    const incompatible = await connection.callTool('run_report', {
      date_ranges: WEEK,
      dimensions: ['country'],
      metrics: ['eventCount'],
    });
    expect(unknown.isError).toBe(true);
    expect(JSON.parse(unknown.text).error).toContain(
      'Field browserLanguage is not a valid dimension',
    );
    expect(JSON.parse(incompatible.text).error).toContain('incompatible');
  });

  it('answers realtime for the last 30 minutes and for named minute ranges', () => {
    const all = simulatedRows(
      simulateRunRealtimeReport({ dimensions: [], metrics: ['activeUsers'] }),
    );
    const split = simulatedRows(
      simulateRunRealtimeReport({
        dimensions: [],
        metrics: ['activeUsers'],
        minute_ranges: [
          { name: 'last5', start_minutes_ago: 4, end_minutes_ago: 0 },
          { name: 'last30', start_minutes_ago: 29, end_minutes_ago: 0 },
        ],
      }),
    );
    expect(all[0]?.value).toBeGreaterThan(0);
    expect(split.find((row) => row.keys[0] === 'last30')?.value).toBe(all[0]?.value);
  });

  describe('funnels', () => {
    const steps = [
      { name: 'Search', event: 'search' },
      { name: 'Open', event: 'open_title' },
      { name: 'Save', event: 'save_to_library' },
    ];

    it('never has more users at a later step and reports fractions for the rates', () => {
      const result = simulateRunFunnelReport({ date_ranges: WEEK, funnel_steps: steps });
      const users = simulatedFunnelUsers({ date_ranges: WEEK, funnel_steps: steps });
      const table = result.ok
        ? (result.body.funnel_table as { rows: { metric_values: { value: string }[] }[] })
        : undefined;

      expect(users[0]).toBeGreaterThan(0);
      expect(users.every((count, index) => index === 0 || count <= (users[index - 1] ?? 0))).toBe(
        true,
      );
      const completion = Number(table?.rows[0]?.metric_values[1]?.value);
      expect(completion).toBeGreaterThan(0);
      expect(completion).toBeLessThan(1);
    });

    it('gives zero users from an unknown event onwards', () => {
      expect(
        simulatedFunnelUsers({
          date_ranges: WEEK,
          funnel_steps: [steps[0], { name: 'Share', event: 'share_title' }, steps[2]],
        }).slice(1),
      ).toEqual([0, 0]);
    });

    it('breaks down by device and refuses other breakdowns', () => {
      const byDevice = simulateRunFunnelReport({
        date_ranges: WEEK,
        funnel_steps: steps,
        funnel_breakdown: { breakdown_dimension: 'deviceCategory' },
      });
      const byCountry = simulateRunFunnelReport({
        date_ranges: WEEK,
        funnel_steps: steps,
        funnel_breakdown: { breakdown_dimension: 'country' },
      });
      expect(byDevice.ok).toBe(true);
      expect(byCountry.ok).toBe(false);
    });
  });
});
