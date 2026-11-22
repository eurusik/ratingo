export interface WebhookSecretPort {
  readonly value: string;
  matches(provided: unknown): boolean;
}

export const WEBHOOK_SECRET_PORT = Symbol('WEBHOOK_SECRET_PORT');
