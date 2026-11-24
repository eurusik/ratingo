import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { WebhookSecretPort } from '../../domain/ports/webhook-secret.port';

const WEBHOOK_SECRET_CONTEXT = 'ratingo-telegram-webhook';
const WEBHOOK_SECRET_MAX_LENGTH = 256;

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

export class HmacWebhookSecret implements WebhookSecretPort {
  readonly value: string;
  private readonly fingerprint: Buffer;

  constructor(botToken: string) {
    this.value = createHmac('sha256', botToken)
      .update(WEBHOOK_SECRET_CONTEXT)
      .digest('base64url')
      .slice(0, WEBHOOK_SECRET_MAX_LENGTH);
    this.fingerprint = sha256(this.value);
  }

  matches(provided: unknown): boolean {
    return typeof provided === 'string' && timingSafeEqual(sha256(provided), this.fingerprint);
  }
}
