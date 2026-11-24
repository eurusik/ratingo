import { epochDayOf } from '../mcp-calendar';
import { McpServerRegistry } from '../mcp-server.registry';
import { allowedArgumentsOf, decideMcpCall, exposedInputSchema } from '../mcp-tool-policy';
import { McpRefusalCode } from '../mcp-tool-policy.types';
import { createPlatformMcpRegistry } from '../platform-mcp-servers';
import { GOOGLE_ANALYTICS_MCP_SERVER, GoogleAnalyticsMcpKey } from './google-analytics.mcp-server';

const RUN_REPORT_SCHEMA = {
  type: 'object',
  title: 'run_reportParams',
  properties: {
    property_id: { anyOf: [{ type: 'integer' }, { type: 'string' }], title: 'Property Id' },
    date_ranges: { type: 'array', items: { type: 'object', additionalProperties: true } },
    dimensions: { type: 'array', items: { type: 'string' } },
    metrics: { type: 'array', items: { type: 'string' } },
    dimension_filter: { type: 'object', additionalProperties: true, default: null },
    metric_filter: { type: 'object', additionalProperties: true, default: null },
    order_bys: { type: 'array', items: { type: 'object' }, default: null },
    limit: { type: 'integer', default: null },
    offset: { type: 'integer', default: null },
    currency_code: { type: 'string', default: null },
    return_property_quota: { type: 'boolean', default: false },
  },
  required: ['property_id', 'date_ranges', 'dimensions', 'metrics'],
};
const TODAY = epochDayOf(Date.UTC(2026, 10, 24));
const ENV = {
  [GoogleAnalyticsMcpKey.CREDENTIALS_FILE]: '/tmp/ga/key.json',
  [GoogleAnalyticsMcpKey.PROPERTY_ID]: '515589933',
};

const resolvedRule = () => {
  const resolved = new McpServerRegistry([GOOGLE_ANALYTICS_MCP_SERVER]).resolve(
    ['google-analytics'],
    ENV,
  );
  const definition = resolved.configured[0]!.definition;
  return { policy: definition.policy, rule: definition.policy.tools.run_report! };
};

describe('google-analytics MCP server', () => {
  it('is on the platform allowlist and passes validation', () => {
    expect(createPlatformMcpRegistry().names()).toContain('google-analytics');
  });

  it('passes only the credentials path and constants to the subprocess', () => {
    const resolved = new McpServerRegistry([GOOGLE_ANALYTICS_MCP_SERVER]).resolve(
      ['google-analytics'],
      {
        ...ENV,
        ANTHROPIC_API_KEY: 'sk-ant-never',
      },
    );
    expect(Object.keys(resolved.configured[0]!.env).sort()).toEqual([
      'GOOGLE_APPLICATION_CREDENTIALS',
      'HOME',
      'PYTHONDONTWRITEBYTECODE',
      'PYTHONUNBUFFERED',
    ]);
  });

  it('is unconfigured without the credentials file or the property id', () => {
    const registry = new McpServerRegistry([GOOGLE_ANALYTICS_MCP_SERVER]);
    expect(registry.resolve(['google-analytics'], {}).unconfigured[0]?.missingKeys).toEqual([
      'GOOGLE_APPLICATION_CREDENTIALS',
      'GA_PROPERTY_ID',
    ]);
  });

  it('pins the property, hides paging and quota arguments and keeps the model ones', () => {
    const { rule } = resolvedRule();
    const shown = Object.keys(exposedInputSchema(RUN_REPORT_SCHEMA, rule).properties as object);
    expect(shown.sort()).toEqual(
      [
        'date_ranges',
        'dimension_filter',
        'dimensions',
        'limit',
        'metric_filter',
        'metrics',
        'order_bys',
      ].sort(),
    );
  });

  it('sends the pinned property and a default row limit', () => {
    const { policy, rule } = resolvedRule();
    const decision = decideMcpCall(
      policy,
      'run_report',
      {
        property_id: '1',
        date_ranges: [{ start_date: '7daysAgo', end_date: 'yesterday', name: 'week' }],
        dimensions: ['date'],
        metrics: ['activeUsers'],
      },
      { todayEpochDay: TODAY, allowedArguments: allowedArgumentsOf(rule, RUN_REPORT_SCHEMA) },
    );
    expect(decision).toEqual({
      allowed: true,
      arguments: expect.objectContaining({
        property_id: '515589933',
        limit: 20,
        return_property_quota: false,
      }),
    });
  });

  it.each([
    [
      { date_ranges: [{ start_date: '120daysAgo', end_date: 'today' }] },
      McpRefusalCode.DATE_RANGE_NOT_ALLOWED,
    ],
    [{ offset: 100 }, McpRefusalCode.UNKNOWN_ARGUMENT],
    [{ limit: 1000 }, McpRefusalCode.OUT_OF_RANGE],
    [{ metrics: ['a', 'b', 'c', 'd', 'e', 'f'] }, McpRefusalCode.TOO_MANY_ITEMS],
  ])('refuses %j', (args, code) => {
    const { policy, rule } = resolvedRule();
    const decision = decideMcpCall(policy, 'run_report', args, {
      todayEpochDay: TODAY,
      allowedArguments: allowedArgumentsOf(rule, RUN_REPORT_SCHEMA),
    });
    expect(decision).toEqual({ allowed: false, refusal: expect.objectContaining({ code }) });
  });

  it.each([
    [{ start_date: '90daysAgo', end_date: 'today' }],
    [{ start_date: '90daysAgo', end_date: 'yesterday' }],
    [{ start_date: '2026-08-26', end_date: '2026-11-24' }],
  ])('allows the last 90 days written as %j', (range) => {
    const { policy, rule } = resolvedRule();
    const decision = decideMcpCall(
      policy,
      'run_report',
      { date_ranges: [range], dimensions: [], metrics: ['activeUsers'] },
      { todayEpochDay: TODAY, allowedArguments: allowedArgumentsOf(rule, RUN_REPORT_SCHEMA) },
    );
    expect(decision.allowed).toBe(true);
  });

  it('refuses a range that starts 91 days ago', () => {
    const { policy, rule } = resolvedRule();
    const decision = decideMcpCall(
      policy,
      'run_report',
      {
        date_ranges: [{ start_date: '91daysAgo', end_date: 'today' }],
        dimensions: [],
        metrics: ['activeUsers'],
      },
      { todayEpochDay: TODAY, allowedArguments: allowedArgumentsOf(rule, RUN_REPORT_SCHEMA) },
    );
    expect(decision.allowed).toBe(false);
  });

  it('states the realtime window as a number the answer can quote', () => {
    expect(GOOGLE_ANALYTICS_MCP_SERVER.policy.tools.run_realtime_report?.resultNote).toContain(
      '30 minutes',
    );
  });

  it('allows two ranges for a week-over-week comparison', () => {
    const { policy, rule } = resolvedRule();
    const decision = decideMcpCall(
      policy,
      'run_report',
      {
        date_ranges: [
          { start_date: '7daysAgo', end_date: 'yesterday', name: 'this_week' },
          { start_date: '14daysAgo', end_date: '8daysAgo', name: 'last_week' },
        ],
        dimensions: [],
        metrics: ['activeUsers'],
      },
      { todayEpochDay: TODAY, allowedArguments: allowedArgumentsOf(rule, RUN_REPORT_SCHEMA) },
    );
    expect(decision.allowed).toBe(true);
  });
});
