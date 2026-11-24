import { FixtureGaConnection, gaReport } from './google-analytics.fake-server';

const REPORT = 'google-analytics__run_report';
const WEEK = [{ start_date: '7daysAgo', end_date: 'yesterday' }];

const connection = new FixtureGaConnection([
  { tool: REPORT, response: gaReport(['date'], ['activeUsers'], [[['20261115'], ['251']]]) },
  { tool: REPORT, response: gaReport([], ['activeUsers'], [[[], ['1843']]]) },
]);

describe('fake GA server', () => {
  it('answers a per-day request with per-day rows and a total request with the total', async () => {
    const perDay = await connection.callTool('run_report', {
      date_ranges: WEEK,
      dimensions: ['date'],
      metrics: ['activeUsers'],
    });
    const total = await connection.callTool('run_report', {
      date_ranges: WEEK,
      dimensions: [],
      metrics: ['activeUsers'],
    });

    expect(perDay.text).toContain('20261115');
    expect(total.text).toContain('1843');
    expect(total.text).not.toContain('20261115');
  });

  it('reports a dimension it has no data for instead of returning another report', async () => {
    const result = await connection.callTool('run_report', {
      date_ranges: WEEK,
      dimensions: ['country'],
      metrics: ['activeUsers'],
    });

    expect(result).toEqual({ isError: true, text: expect.stringContaining('["country"]') });
  });
});
