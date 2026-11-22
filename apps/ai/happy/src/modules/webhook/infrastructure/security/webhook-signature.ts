import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_FORMAT = /^sha256=[0-9a-f]{64}$/;
const SIGNATURE_PREFIX = 'sha256=';

export const signWebhookBody = (secret: string, rawBody: Buffer): string =>
  `${SIGNATURE_PREFIX}${createHmac('sha256', secret).update(rawBody).digest('hex')}`;

export const verifyWebhookSignature = (
  secret: string,
  rawBody: Buffer,
  header: string | undefined,
): boolean => {
  if (header === undefined || !SIGNATURE_FORMAT.test(header)) return false;
  const expected = Buffer.from(signWebhookBody(secret, rawBody));
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
};
