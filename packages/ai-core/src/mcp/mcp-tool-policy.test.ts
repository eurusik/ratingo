import * as fc from 'fast-check';
import { epochDayOf } from './mcp-calendar';
import { decideMcpCall, exposedInputSchema, MAX_SCHEMA_DESCRIPTION_CHARS } from './mcp-tool-policy';
import { McpConstraintKind, McpRefusalCode } from './mcp-tool-policy.types';
import type { McpToolPolicy, McpToolRule } from './mcp-tool-policy.types';

const TODAY = epochDayOf(Date.UTC(2026, 10, 24));
const MAX_LIMIT = 50;
const MAX_SPAN_DAYS = 31;
const MAX_LOOKBACK_DAYS = 90;
const ALLOWED_DIMENSIONS = ['date', 'country', 'pagePath'];

const reportRule: McpToolRule = {
  description: 'Run a report.',
  pinnedArguments: { property_id: '123', currency_code: 'USD' },
  constraints: {
    limit: { kind: McpConstraintKind.NUMBER, min: 1, max: MAX_LIMIT, default: 10 },
    dimensions: { kind: McpConstraintKind.ONE_OF, values: ALLOWED_DIMENSIONS },
    metrics: { kind: McpConstraintKind.MAX_ITEMS, max: 3 },
    date_ranges: {
      kind: McpConstraintKind.DATE_RANGES,
      maxRanges: 2,
      maxSpanDays: MAX_SPAN_DAYS,
      maxLookbackDays: MAX_LOOKBACK_DAYS,
    },
  },
};
const policy: McpToolPolicy = { tools: { run_report: reportRule, echo: { description: 'Echo.' } } };

const anyJson = fc.jsonValue();
const anyArgs = fc.dictionary(
  fc.constantFrom(
    'property_id',
    'currency_code',
    'limit',
    'dimensions',
    'metrics',
    'date_ranges',
    'other',
  ),
  anyJson,
);
const daysAgoText = fc.integer({ min: 0, max: 400 }).map((days) => `${days}daysAgo`);
const dateRange = fc.record({ start_date: daysAgoText, end_date: daysAgoText });

describe('decideMcpCall', () => {
  it('never lets the model override a pinned argument', () => {
    fc.assert(
      fc.property(anyArgs, (args) => {
        const decision = decideMcpCall(policy, 'run_report', args, TODAY);
        if (decision.allowed) {
          expect(decision.arguments.property_id).toBe('123');
          expect(decision.arguments.currency_code).toBe('USD');
        }
      }),
    );
  });

  it('only allows calls whose constrained arguments hold', () => {
    fc.assert(
      fc.property(
        fc.record({
          limit: fc.option(fc.integer({ min: -100, max: 500 }), { nil: undefined }),
          dimensions: fc.array(fc.constantFrom(...ALLOWED_DIMENSIONS, 'userEmail'), {
            maxLength: 4,
          }),
          metrics: fc.array(fc.string(), { maxLength: 5 }),
          date_ranges: fc.array(dateRange, { minLength: 1, maxLength: 3 }),
        }),
        (args) => {
          const decision = decideMcpCall(policy, 'run_report', args, TODAY);
          if (!decision.allowed) {
            return;
          }
          const allowed = decision.arguments as {
            limit: number;
            dimensions: string[];
            metrics: string[];
            date_ranges: Array<{ start_date: string; end_date: string }>;
          };
          expect(allowed.limit).toBeGreaterThanOrEqual(1);
          expect(allowed.limit).toBeLessThanOrEqual(MAX_LIMIT);
          expect(allowed.dimensions.every((d) => ALLOWED_DIMENSIONS.includes(d))).toBe(true);
          expect(allowed.metrics.length).toBeLessThanOrEqual(3);
          expect(allowed.date_ranges.length).toBeLessThanOrEqual(2);
          for (const range of allowed.date_ranges) {
            const start = Number.parseInt(range.start_date, 10);
            const end = Number.parseInt(range.end_date, 10);
            expect(start).toBeLessThanOrEqual(MAX_LOOKBACK_DAYS);
            expect(start - end + 1).toBeLessThanOrEqual(MAX_SPAN_DAYS);
            expect(end).toBeLessThanOrEqual(start);
          }
        },
      ),
    );
  });

  it('never allows a tool outside the policy', () => {
    fc.assert(
      fc.property(
        fc.string().filter((tool) => !['run_report', 'echo'].includes(tool)),
        anyJson,
        (tool, args) => {
          const decision = decideMcpCall(policy, tool, args, TODAY);
          expect(decision).toEqual({
            allowed: false,
            refusal: expect.objectContaining({ code: McpRefusalCode.TOOL_NOT_ALLOWED }),
          });
        },
      ),
    );
  });

  it('is not fooled by inherited object keys', () => {
    expect(decideMcpCall(policy, 'toString', {}, TODAY).allowed).toBe(false);
    expect(decideMcpCall(policy, '__proto__', {}, TODAY).allowed).toBe(false);
  });

  it('fills a default when the model leaves a capped number out', () => {
    expect(decideMcpCall(policy, 'run_report', {}, TODAY)).toEqual({
      allowed: true,
      arguments: { limit: 10, property_id: '123', currency_code: 'USD' },
    });
  });

  it.each([
    [{ limit: 51 }, McpRefusalCode.OUT_OF_RANGE, 'limit'],
    [{ limit: '5' }, McpRefusalCode.INVALID_ARGUMENTS, 'limit'],
    [{ dimensions: ['userEmail'] }, McpRefusalCode.VALUE_NOT_ALLOWED, 'dimensions'],
    [{ metrics: ['a', 'b', 'c', 'd'] }, McpRefusalCode.TOO_MANY_ITEMS, 'metrics'],
    [
      { date_ranges: [{ start_date: '120daysAgo', end_date: 'today' }] },
      McpRefusalCode.DATE_RANGE_NOT_ALLOWED,
      'date_ranges',
    ],
    [
      { date_ranges: [{ start_date: '2026-11-26', end_date: '2026-11-26' }] },
      McpRefusalCode.DATE_RANGE_NOT_ALLOWED,
      'date_ranges',
    ],
    [
      { date_ranges: [{ start_date: 'last week', end_date: 'today' }] },
      McpRefusalCode.DATE_RANGE_NOT_ALLOWED,
      'date_ranges',
    ],
  ])('refuses %j with %s', (args, code, argument) => {
    expect(decideMcpCall(policy, 'run_report', args, TODAY)).toEqual({
      allowed: false,
      refusal: expect.objectContaining({ code, argument }),
    });
  });

  it('accepts an empty list for a one_of argument', () => {
    expect(decideMcpCall(policy, 'run_report', { dimensions: [] }, TODAY).allowed).toBe(true);
  });

  it('accepts tomorrow in UTC, which is already today in a property east of UTC', () => {
    const decision = decideMcpCall(
      policy,
      'run_report',
      { date_ranges: [{ start_date: '2026-11-25', end_date: '2026-11-25' }] },
      TODAY,
    );
    expect(decision.allowed).toBe(true);
  });

  it('accepts absolute dates inside the window', () => {
    const decision = decideMcpCall(
      policy,
      'run_report',
      { date_ranges: [{ start_date: '2026-11-01', end_date: 'yesterday' }] },
      TODAY,
    );
    expect(decision.allowed).toBe(true);
  });

  it('refuses arguments that are not an object', () => {
    expect(decideMcpCall(policy, 'echo', ['x'], TODAY)).toEqual({
      allowed: false,
      refusal: expect.objectContaining({ code: McpRefusalCode.INVALID_ARGUMENTS }),
    });
  });
});

describe('exposedInputSchema', () => {
  const remote = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'run_reportParams',
    type: 'object',
    properties: {
      property_id: { anyOf: [{ type: 'integer' }, { type: 'string' }], title: 'Property Id' },
      currency_code: { type: 'string', default: null },
      limit: { type: 'integer', default: null, description: 'd'.repeat(2_000) },
      dimensions: { type: 'array', items: { type: 'string' } },
      title: { type: 'string' },
    },
    required: ['property_id', 'dimensions'],
  };

  it('removes pinned arguments and narrows constrained ones', () => {
    const schema = exposedInputSchema(remote, reportRule);

    expect(schema).toEqual({
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'd'.repeat(MAX_SCHEMA_DESCRIPTION_CHARS),
          maximum: 50,
          minimum: 1,
        },
        dimensions: { type: 'array', items: { type: 'string', enum: ALLOWED_DIMENSIONS } },
        title: { type: 'string' },
      },
      required: ['dimensions'],
    });
  });

  it('never shows a pinned argument for any rule', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom(...Object.keys(remote.properties)), { minLength: 1 }),
        (pinned) => {
          const rule: McpToolRule = {
            description: 'x',
            pinnedArguments: Object.fromEntries(pinned.map((key) => [key, 1])),
          };
          const schema = exposedInputSchema(remote, rule);
          for (const key of pinned) {
            expect(schema.properties).not.toHaveProperty(key);
            expect(schema.required).not.toContain(key);
          }
        },
      ),
    );
  });
});
