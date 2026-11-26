import fc from 'fast-check';

import { isSensitiveKey, REDACTED, redactText, redactValue } from './redaction';

const SECRET_SAMPLES = [
  'sk-ant-api03-abcdefghijklmnop',
  `ghp_${'a1B2c3D4e5'.repeat(3)}`,
  `github_pat_${'x'.repeat(30)}`,
  `glc_${'A1b2'.repeat(10)}`,
  `eyJ${'a'.repeat(12)}.eyJ${'b'.repeat(12)}.${'c'.repeat(12)}`,
  `123456789:${'A'.repeat(35)}`,
];

describe('redactText', () => {
  it.each(SECRET_SAMPLES)('removes the token %#', (secret) => {
    const redacted = redactText(`call failed with ${secret} in the header`);

    expect(redacted).not.toContain(secret);
    expect(redacted).toContain(REDACTED);
  });

  it('removes bearer and basic authorization values', () => {
    expect(redactText('Authorization: Bearer abcdefghijklmnop1234')).not.toContain(
      'abcdefghijklmnop1234',
    );
    expect(redactText('Basic dXNlcjpwYXNzd29yZDEyMw==')).not.toContain('dXNlcjpwYXNz');
  });

  it('removes credentials embedded in connection strings and keeps the host', () => {
    const redacted = redactText('connect postgres://admin:hunter2pass@db.internal:5432/app failed');

    expect(redacted).not.toContain('hunter2pass');
    expect(redacted).not.toContain('admin');
    expect(redacted).toContain('db.internal:5432/app');
  });

  it('removes key=value credentials from query strings', () => {
    const redacted = redactText('GET /cb?access_token=abc123def456&page=2');

    expect(redacted).not.toContain('abc123def456');
    expect(redacted).toContain('page=2');
  });

  it('removes email addresses', () => {
    expect(redactText('user jane.doe+tag@example.com signed in')).not.toContain('jane.doe');
  });

  it('leaves ordinary text untouched', () => {
    const text = 'TVMaze enrichment finished for tt0944947: 8 seasons merged, 2 skipped';

    expect(redactText(text)).toBe(text);
  });

  it('never grows secret-free alphanumeric text', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9 ]{0,80}$/), (text) => redactText(text) === text),
    );
  });

  it('hides a generated secret wherever it sits in a line', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z ]{0,30}$/),
        fc.stringMatching(/^[A-Za-z0-9]{24,40}$/),
        fc.stringMatching(/^[a-z ]{0,30}$/),
        (before, body, after) => {
          const secret = `ghp_${body}`;
          return !redactText(`${before} ${secret} ${after}`).includes(body);
        },
      ),
    );
  });
});

describe('isSensitiveKey', () => {
  it.each([
    'authorization',
    'Authorization',
    'cookie',
    'Set-Cookie',
    'password',
    'refresh_token',
    'accessToken',
    'x-api-key',
    'apiKey',
    'client_secret',
    'userEmail',
    'DATABASE_URL_PASSWORD',
  ])('treats %s as sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each(['inputTokens', 'outputTokens', 'cacheReadTokens', 'job_id', 'queue', 'status'])(
    'keeps %s',
    (key) => {
      expect(isSensitiveKey(key)).toBe(false);
    },
  );
});

describe('redactValue', () => {
  it('replaces the value of sensitive keys at any depth', () => {
    const redacted = redactValue({
      headers: { authorization: 'Bearer abc', accept: 'application/json' },
      list: [{ password: 'p', ok: 1 }],
    });

    expect(redacted).toEqual({
      headers: { authorization: REDACTED, accept: 'application/json' },
      list: [{ password: REDACTED, ok: 1 }],
    });
  });

  it('redacts secret-looking values under harmless keys', () => {
    expect(redactValue({ note: 'token=abcd1234efgh' })).toEqual({ note: REDACTED });
  });

  it('survives circular structures', () => {
    const loop: Record<string, unknown> = { name: 'loop' };
    loop.self = loop;

    expect(() => redactValue(loop)).not.toThrow();
  });

  it('never leaks a secret planted under a sensitive key', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('password', 'authorization', 'cookie', 'apiKey', 'token'),
        fc.stringMatching(/^[A-Za-z0-9]{8,40}$/),
        (key, secret) =>
          !JSON.stringify(redactValue({ outer: { [key]: secret } })).includes(secret),
      ),
    );
  });
});
