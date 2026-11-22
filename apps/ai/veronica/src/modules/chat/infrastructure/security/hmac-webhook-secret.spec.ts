import { createHmac } from 'node:crypto';

import fc from 'fast-check';

import { HmacWebhookSecret } from './hmac-webhook-secret';

const TELEGRAM_SECRET_FORMAT = /^[A-Za-z0-9_-]{1,256}$/;

describe('HmacWebhookSecret', () => {
  it('derives the secret from the bot token with HMAC-SHA256', () => {
    const expected = createHmac('sha256', '123:abc')
      .update('ratingo-telegram-webhook')
      .digest('base64url');
    expect(new HmacWebhookSecret('123:abc').value).toBe(expected);
  });

  it('is stable for a token and different for another', () => {
    expect(new HmacWebhookSecret('a').value).toBe(new HmacWebhookSecret('a').value);
    expect(new HmacWebhookSecret('a').value).not.toBe(new HmacWebhookSecret('b').value);
  });

  it('always fits the characters and length Telegram allows', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (token) => {
        expect(new HmacWebhookSecret(token).value).toMatch(TELEGRAM_SECRET_FORMAT);
      }),
    );
  });

  it('matches only the exact secret', () => {
    const secret = new HmacWebhookSecret('123:abc');
    expect(secret.matches(secret.value)).toBe(true);
    expect(secret.matches(`${secret.value}x`)).toBe(false);
    expect(secret.matches(secret.value.slice(1))).toBe(false);
    expect(secret.matches('')).toBe(false);
    expect(secret.matches(undefined)).toBe(false);
    expect(secret.matches([secret.value])).toBe(false);
    expect(secret.matches(null)).toBe(false);
  });

  it('rejects any other string', () => {
    const secret = new HmacWebhookSecret('123:abc');
    fc.assert(
      fc.property(
        fc.string().filter((candidate) => candidate !== secret.value),
        (candidate) => {
          expect(secret.matches(candidate)).toBe(false);
        },
      ),
    );
  });
});
