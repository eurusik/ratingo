import * as fc from 'fast-check';
import { REDACTION_PLACEHOLDER, redactSecrets } from './redact';

describe('redactSecrets', () => {
  it.each([
    ['anthropic key', 'key sk-ant-api03-abcdefghijklmnop done'],
    ['github token', 'ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
    ['bearer header', 'Authorization: Bearer abcdefghijklmnop1234'],
    ['github fine-grained token', 'github_pat_abcdefghijklmnopqrstuvwxyz0123'],
    ['slack token', 'xoxb-1234567890-abcdefghij'],
    ['telegram bot token', '123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw0'],
    ['jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r'],
    ['key assignment', 'password = hunter2secret'],
    ['prefixed token variable', 'access_token=abcd1234efgh'],
    ['env style secret', 'GITHUB_TOKEN=abcd1234 DB_PASSWORD=hunter22'],
    ['quoted client secret', 'client_secret: "abcd1234"'],
    ['email address', 'contact jane.doe@example.com now'],
  ])('redacts a %s', (_label, input) => {
    expect(redactSecrets(input)).toContain(REDACTION_PLACEHOLDER);
  });

  it('stays fast on a very long run of letters', () => {
    const started = Date.now();
    redactSecrets('a'.repeat(200_000));
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('keeps ordinary text', () => {
    const text = 'Queue ingestion has 12 waiting jobs and 0 failed.';
    expect(redactSecrets(text)).toBe(text);
  });

  it('removes any generated anthropic-style key', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[A-Za-z0-9_-]{12,40}$/),
        fc.string({ maxLength: 20 }),
        (suffix, noise) => {
          const secret = `sk-ant-${suffix}`;
          expect(redactSecrets(`${noise} ${secret} ${noise}`)).not.toContain(secret);
        },
      ),
    );
  });
});
