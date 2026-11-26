import * as fc from 'fast-check';

import { JOB_FAILURE_MESSAGE_MAX_CHARS } from '../constants/job-failure.constants';

import { redactFailureMessage } from './failure-message.policy';

const SECRET = 'k3y9Zq7Lm2Xc8Vb4Nn6Ty1Rr5Ww0Ee3Aa';
const wordArb = fc.stringMatching(/^[a-z]{1,8}$/);
const textArb = fc.array(wordArb, { maxLength: 20 }).map((words) => words.join(' '));

describe('redactFailureMessage', () => {
  it('never returns more than the limit', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 2000 }), (message) => {
        expect(redactFailureMessage(message).length).toBeLessThanOrEqual(
          JOB_FAILURE_MESSAGE_MAX_CHARS,
        );
      }),
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (message) => {
        const once = redactFailureMessage(message);
        expect(redactFailureMessage(once)).toBe(once);
      }),
    );
  });

  it('removes e-mails, URL query strings and secret values wherever they appear', () => {
    fc.assert(
      fc.property(
        textArb,
        textArb,
        fc.constantFrom(
          `user.name+tag@example.com`,
          `https://api.example.com/v1/items?apikey=${SECRET}&page=2`,
          `api_key=${SECRET}`,
          `token: ${SECRET}`,
          `Bearer ${SECRET}`,
          `postgres://reader:${SECRET}@db.internal:5432/app`,
        ),
        (before, after, sensitive) => {
          const output = redactFailureMessage(`${before} ${sensitive} ${after}`);
          expect(output).not.toContain(SECRET);
          expect(output).not.toContain('user.name+tag@example.com');
          expect(output).not.toContain('page=2');
        },
      ),
    );
  });

  it('keeps UUIDs, IMDb ids, slugs and numeric ids so the failed item stays known', () => {
    const itemIdArb = fc.oneof(
      fc.uuid(),
      fc.integer({ min: 1_000_000, max: 99_999_999 }).map((n) => `tt${n}`),
      fc.integer({ min: 1, max: 9_999_999 }).map(String),
      fc
        .array(fc.stringMatching(/^[a-z0-9]{1,10}$/), { minLength: 3, maxLength: 8 })
        .map((words) => words.join('-')),
    );
    fc.assert(
      fc.property(textArb, itemIdArb, (before, itemId) => {
        expect(redactFailureMessage(`${before} ${itemId} failed`)).toContain(itemId);
      }),
    );
  });

  it('still removes long hex keys and mixed-case tokens next to an item id', () => {
    const secretArb = fc.oneof(
      fc.stringMatching(/^[a-f0-9]{32,64}$/),
      fc
        .tuple(
          fc.stringMatching(/^[a-z]{8,20}$/),
          fc.stringMatching(/^[A-Z]{8,20}$/),
          fc.stringMatching(/^\d{8,20}$/),
        )
        .map(([lower, upper, digits]) => `${lower}${upper}${digits}`),
    );
    fc.assert(
      fc.property(fc.uuid(), secretArb, (itemId, secret) => {
        const output = redactFailureMessage(`item ${itemId} sent ${secret}`);
        expect(output).toContain(itemId);
        expect(output).not.toContain(secret);
      }),
    );
  });

  it('keeps plain words and job names', () => {
    expect(redactFailureMessage('Job scheduled-upcoming-movies-refresh-soon stalled')).toBe(
      'Job scheduled-upcoming-movies-refresh-soon stalled',
    );
  });

  it('drops the bound parameters of a failed query', () => {
    expect(
      redactFailureMessage('Failed query: select 1 where email = $1\nparams: owner@example.com'),
    ).toBe('Failed query: select 1 where email = $1');
  });

  it('keeps the host and path of a URL', () => {
    expect(redactFailureMessage('GET https://api.trakt.tv/shows/1?extended=full failed')).toBe(
      'GET https://api.trakt.tv/shows/1 failed',
    );
  });

  it('clips long messages with an ellipsis', () => {
    const output = redactFailureMessage('word '.repeat(200));
    expect(output).toHaveLength(JOB_FAILURE_MESSAGE_MAX_CHARS);
    expect(output.endsWith('…')).toBe(true);
  });
});
