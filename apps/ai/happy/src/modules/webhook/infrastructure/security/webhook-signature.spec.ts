import * as fc from 'fast-check';

import { signWebhookBody, verifyWebhookSignature } from './webhook-signature';

const secret = fc.string({ minLength: 1, maxLength: 40 });
const body = fc.uint8Array({ maxLength: 200 }).map((bytes) => Buffer.from(bytes));

describe('verifyWebhookSignature', () => {
  it('accepts the signature of the exact raw body', () => {
    fc.assert(
      fc.property(secret, body, (key, raw) =>
        verifyWebhookSignature(key, raw, signWebhookBody(key, raw)),
      ),
    );
  });

  it('rejects a changed body, a changed secret and a missing header', () => {
    fc.assert(
      fc.property(secret, secret, body, body, (key, otherKey, raw, otherRaw) => {
        fc.pre(!raw.equals(otherRaw) && key !== otherKey);
        const signature = signWebhookBody(key, raw);
        return (
          !verifyWebhookSignature(key, otherRaw, signature) &&
          !verifyWebhookSignature(otherKey, raw, signature) &&
          !verifyWebhookSignature(key, raw, undefined)
        );
      }),
    );
  });

  it('rejects malformed headers without throwing', () => {
    fc.assert(
      fc.property(secret, body, fc.string({ maxLength: 90 }), (key, raw, header) => {
        fc.pre(header !== signWebhookBody(key, raw));
        return verifyWebhookSignature(key, raw, header) === false;
      }),
    );
    const good = signWebhookBody('k', Buffer.from('x'));
    expect(verifyWebhookSignature('k', Buffer.from('x'), good.toUpperCase())).toBe(false);
    expect(verifyWebhookSignature('k', Buffer.from('x'), good.replace('sha256=', 'sha1='))).toBe(
      false,
    );
  });
});
