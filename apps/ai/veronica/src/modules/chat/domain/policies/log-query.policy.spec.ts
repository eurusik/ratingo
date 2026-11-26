import * as fc from 'fast-check';

import { LogService } from '../constants/logs.constants';

import {
  InvalidLogSearchError,
  buildLogQuery,
  isLogId,
  isLogText,
  type LogSearchCriteria,
} from './log-query.policy';

const NOW_MS = Date.UTC(2026, 10, 26, 12, 0, 0);
const LIMIT = 500;
const SERVICES = Object.values(LogService).join('|');
const ID = '[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}';
const QUEUE = '[a-z0-9][a-z0-9_-]{0,63}';
const PLAIN_TEXT_CHAR = '[^\\\\`|.+*?()\\[\\]{}^$\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029]';
const ESCAPED_OR_PLAIN = `(?:\\\\[\\\\.+*?()|\\[\\]{}^$]|${PLAIN_TEXT_CHAR})+`;

const GRAMMAR = new RegExp(
  `^\\{service_name=\`(?:${SERVICES})\`,deployment_environment_name=\`production\`\\}` +
    ` \\| detected_level(?:=\`error\`|=~\`warn\\|error\`)` +
    `(?: \\| queue=\`${QUEUE}\`)?` +
    `(?: \\| job_id=\`${ID}\`)?` +
    `(?: \\| request_id=\`${ID}\`)?` +
    `(?: \\| run_id=\`${ID}\`)?` +
    `(?: \\|~ \`\\(\\?i\\)${ESCAPED_OR_PLAIN}\`)?$`,
  'u',
);

const HOSTILE_STRINGS = [
  '`} | line_format "{{.x}}"',
  '`}\n{service_name=~".+"}',
  'x` or `y',
  '" |= "',
  '.*',
  '(?i)(a+)+$',
  '\\`',
  '\\\\`',
  '{} | json | drop',
  'job` | detected_level=`debug',
  '| unwrap bytes',
  ' `',
  'ratingo-api`,service_name=~`.+',
  'a\nb',
];

const anyText = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 140 }),
  fc.string({ unit: 'grapheme', maxLength: 140 }),
  fc.constantFrom(...HOSTILE_STRINGS),
  fc.tuple(fc.constantFrom(...HOSTILE_STRINGS), fc.string()).map(([bad, extra]) => bad + extra),
);

const maybe = <T>(arbitrary: fc.Arbitrary<T>) => fc.option(arbitrary, { nil: undefined });

const mostlyValid = <T>(valid: fc.Arbitrary<T>, hostile: fc.Arbitrary<string>) =>
  fc.oneof({ weight: 9, arbitrary: valid }, { weight: 1, arbitrary: hostile });

const validText = anyText.filter(isLogText);
const validId = fc.stringMatching(new RegExp(`^${ID}$`, 'u'));
const validQueue = fc.stringMatching(new RegExp(`^${QUEUE}$`, 'u'));

const anyCriteria: fc.Arbitrary<LogSearchCriteria> = fc.record({
  service: mostlyValid(fc.constantFrom(...Object.values(LogService)), anyText),
  level: mostlyValid(fc.constantFrom('error', 'warn'), anyText),
  windowHours: fc.integer({ min: 1, max: 168 }),
  text: maybe(mostlyValid(validText, anyText)),
  jobId: maybe(mostlyValid(validId, anyText)),
  requestId: maybe(mostlyValid(validId, anyText)),
  runId: maybe(mostlyValid(validId, anyText)),
  queue: maybe(mostlyValid(validQueue, anyText)),
});

const validCriteria = (overrides: Partial<LogSearchCriteria> = {}): LogSearchCriteria => ({
  service: LogService.WORKER,
  level: 'error',
  windowHours: 24,
  ...overrides,
});

const queryOf = (overrides: Partial<LogSearchCriteria> = {}) =>
  buildLogQuery(validCriteria(overrides), NOW_MS, LIMIT);

const unescaped = (pattern: string): string => pattern.replace(/\\(.)/gu, '$1');

const jsonEscaped = (text: string): string => JSON.stringify(text).slice(1, -1);

const patternOf = (logql: string): string | undefined => /\|~ `\(\?i\)(.*)`$/u.exec(logql)?.[1];

const builds = (overrides: Partial<LogSearchCriteria>): boolean => {
  try {
    queryOf(overrides);
    return true;
  } catch {
    return false;
  }
};

describe('buildLogQuery', () => {
  it('builds the query for a service at the default level', () => {
    expect(queryOf()).toEqual({
      logql:
        '{service_name=`ratingo-worker`,deployment_environment_name=`production`} | detected_level=`error`',
      startMs: NOW_MS - 24 * 3_600_000,
      endMs: NOW_MS,
      limit: LIMIT,
    });
  });

  it('reads warnings and errors together for the warn level', () => {
    expect(queryOf({ level: 'warn' }).logql).toContain('| detected_level=~`warn|error`');
  });

  it('adds exact filters on structured metadata before the text filter', () => {
    const { logql } = queryOf({
      queue: 'ingestion',
      jobId: 'repeat:abc123:1795',
      requestId: 'req-1',
      runId: 'run_9',
      text: 'rate limit (429)',
    });
    expect(logql).toBe(
      '{service_name=`ratingo-worker`,deployment_environment_name=`production`}' +
        ' | detected_level=`error` | queue=`ingestion` | job_id=`repeat:abc123:1795`' +
        ' | request_id=`req-1` | run_id=`run_9` |~ `(?i)rate limit \\(429\\)`',
    );
  });

  it.each([
    ['service', { service: 'ratingo-secrets' }],
    ['level', { level: 'debug' }],
    ['text with a backtick', { text: 'a`b' }],
    ['text with a line break', { text: 'a\nb' }],
    ['blank text', { text: '   ' }],
    ['text over the limit', { text: 'x'.repeat(101) }],
    ['job id with a space', { jobId: 'a b' }],
    ['job id with a backtick', { jobId: 'a`b' }],
    ['empty request id', { requestId: '' }],
    ['queue in capitals', { queue: 'Ingestion' }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => queryOf(overrides)).toThrow(InvalidLogSearchError);
  });

  it('looks for a quote or a backslash the way the JSON log line stores it', () => {
    const pattern = patternOf(queryOf({ text: 'DTO "A" path C:\\x' }).logql) as string;
    const line = JSON.stringify({ message: 'Duplicate DTO "A" path C:\\x is bad' });
    expect(new RegExp(pattern, 'iu').test(line)).toBe(true);
  });

  it('treats query syntax in a text as plain characters and refuses it in an id', () => {
    expect(isLogText('| json')).toBe(true);
    expect(isLogId('a|b')).toBe(false);
    expect(queryOf({ text: '| json | drop' }).logql).toContain('`(?i)\\| json \\| drop`');
  });

  describe('properties', () => {
    it('only ever produces a query of the allowed shape, whatever the input', () => {
      let built = 0;
      fc.assert(
        fc.property(anyCriteria, (criteria) => {
          let logql: string;
          try {
            logql = buildLogQuery(criteria, NOW_MS, LIMIT).logql;
          } catch (error) {
            expect(error).toBeInstanceOf(InvalidLogSearchError);
            return;
          }
          built += 1;
          expect(logql).toMatch(GRAMMAR);
        }),
        { numRuns: 3000 },
      );
      expect(built).toBeGreaterThan(1000);
    });

    it('keeps the query on one line with one stream selector and a fixed pipeline', () => {
      fc.assert(
        fc.property(anyCriteria, (criteria) => {
          let logql: string;
          try {
            logql = buildLogQuery(criteria, NOW_MS, LIMIT).logql;
          } catch (error) {
            expect(error).toBeInstanceOf(InvalidLogSearchError);
            return;
          }
          const withoutText = logql.replace(/ \|~ `\(\?i\).*`$/u, '');
          expect(withoutText).not.toMatch(/[\n\r]/u);
          expect(withoutText.match(/\{/gu)?.length).toBe(1);
          expect(withoutText.match(/ \| /gu)?.length).toBe(withoutText.split(' | ').length - 1);
          expect(withoutText.split(' | ').slice(1)).toEqual(
            expect.arrayContaining([expect.stringMatching(/^detected_level=/u)]),
          );
        }),
        { numRuns: 2000 },
      );
    });

    it('turns text into a literal substring match: every special character is escaped', () => {
      fc.assert(
        fc.property(
          fc.string({ unit: 'binary', minLength: 1, maxLength: 100 }).filter(isLogText),
          fc.string({ maxLength: 20 }),
          fc.string({ maxLength: 20 }),
          (text, before, after) => {
            const pattern = patternOf(queryOf({ text }).logql) as string;
            expect(unescaped(pattern)).toBe(jsonEscaped(text.trim()));
            expect(
              new RegExp(pattern, 'iu').test(`${before}${jsonEscaped(text.trim())}${after}`),
            ).toBe(true);
          },
        ),
        { numRuns: 1000 },
      );
    });

    it('matches the text and nothing broader: the match is exactly the text itself', () => {
      fc.assert(
        fc.property(
          fc.string({ unit: 'binary', minLength: 1, maxLength: 30 }).filter(isLogText),
          (text) => {
            const pattern = patternOf(queryOf({ text }).logql) as string;
            const literal = jsonEscaped(text.trim());
            expect(new RegExp(pattern, 'iu').exec(literal)?.[0]).toBe(literal);
          },
        ),
        { numRuns: 500 },
      );
    });

    it('accepts exactly the ids that match the id shape', () => {
      fc.assert(
        fc.property(anyText, (value) => {
          expect(builds({ jobId: value })).toBe(isLogId(value));
        }),
        { numRuns: 1000 },
      );
    });
  });
});
