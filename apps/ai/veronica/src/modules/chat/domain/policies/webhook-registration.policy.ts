interface RegisteredWebhook {
  url: string;
  allowedUpdates: readonly string[] | null;
}

export const WebhookDecision = {
  SKIP: 'skip',
  REGISTER: 'register',
} as const;
export type WebhookDecision = (typeof WebhookDecision)[keyof typeof WebhookDecision];

const sameSet = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((item) => right.includes(item));

export const decideWebhookRegistration = (
  current: RegisteredWebhook,
  desired: { url: string; allowedUpdates: readonly string[] },
): WebhookDecision =>
  current.url === desired.url &&
  current.allowedUpdates !== null &&
  sameSet(current.allowedUpdates, desired.allowedUpdates)
    ? WebhookDecision.SKIP
    : WebhookDecision.REGISTER;
