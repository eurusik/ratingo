import * as fc from 'fast-check';

import {
  isHttpStatus,
  isJobNameFilter,
  isProviderName,
  isQueueName,
  parseWindow,
} from './metric-params.policy';

describe('parseWindow', () => {
  it.each([
    ['1h', '1h', 1],
    ['24h', '24h', 24],
    ['168h', '168h', 168],
    ['7d', '7d', 168],
    ['1d', '1d', 24],
  ])('accepts %s', (raw, promql, hours) => {
    expect(parseWindow(raw)).toEqual({ promql, hours });
  });

  it.each(['0h', '169h', '8d', '30d', '24', 'h', '1w', '-1h', '1.5h', '24h ', ' 24h', '24H', ''])(
    'rejects «%s»',
    (raw) => {
      expect(parseWindow(raw)).toBeNull();
    },
  );

  it('accepts exactly the windows from 1 hour to 7 days', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 999 }), fc.constantFrom('h', 'd'), (amount, unit) => {
        const hours = unit === 'h' ? amount : amount * 24;
        const parsed = parseWindow(`${amount}${unit}`);
        if (hours >= 1 && hours <= 168) {
          expect(parsed).toEqual({ promql: `${amount}${unit}`, hours });
        } else {
          expect(parsed).toBeNull();
        }
      }),
    );
  });

  it('never lets anything but digits and one unit into the query text', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const parsed = parseWindow(raw);
        if (parsed !== null) {
          expect(parsed.promql).toMatch(/^\d{1,3}[hd]$/);
        }
      }),
    );
  });
});

describe('label validators', () => {
  const dangerous = fc.constantFrom(
    '"',
    '\\',
    '{',
    '}',
    '(',
    ')',
    ',',
    '=',
    '~',
    '`',
    ' ',
    '\n',
    '|',
  );

  it.each([
    [isQueueName, 'ingestion', true],
    [isQueueName, 'stats-queue', true],
    [isQueueName, 'a'.repeat(65), false],
    [isQueueName, 'Ingestion', false],
    [isQueueName, '', false],
    [isProviderName, 'api.trakt.tv', true],
    [isProviderName, 'api.tmdb.org', true],
    [isProviderName, '.hidden', false],
    [isHttpStatus, '429', true],
    [isHttpStatus, '999', false],
    [isHttpStatus, '42', false],
    [isHttpStatus, '4290', false],
  ])('%p on «%s» is %p', (validator, value, expected) => {
    expect(validator(value)).toBe(expected);
  });

  it.each([isQueueName, isProviderName, isHttpStatus])(
    'never accepts a value with a PromQL metacharacter',
    (validator) => {
      fc.assert(
        fc.property(fc.string(), dangerous, fc.string(), (before, bad, after) => {
          expect(validator(`${before}${bad}${after}`)).toBe(false);
        }),
      );
    },
  );
});

describe('isJobNameFilter', () => {
  it.each(['refresh-all', 'scheduled-upcoming-movies-refresh-soon', 'trending', 'key-health'])(
    'accepts the job name part %s',
    (value) => {
      expect(isJobNameFilter(value)).toBe(true);
    },
  );

  it('accepts any lowercase fragment of a job name', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,63}$/), (value) => {
        expect(isJobNameFilter(value)).toBe(true);
      }),
    );
  });

  it('rejects anything with characters outside a job name', () => {
    const hostile = fc
      .tuple(
        fc.string(),
        fc.constantFrom('"', '}', '{', '*', ' ', '\\', '.', '_', 'A', '«'),
        fc.string(),
      )
      .map(([before, bad, after]) => `${before}${bad}${after}`);
    fc.assert(
      fc.property(hostile, (value) => {
        expect(isJobNameFilter(value)).toBe(false);
      }),
    );
  });
});
