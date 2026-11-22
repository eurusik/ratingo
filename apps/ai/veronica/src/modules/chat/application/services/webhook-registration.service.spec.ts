import { Logger } from '@nestjs/common';

import type { WebhookInfo, WebhookRegistration } from '../../../notify/public';
import { WebhookDecision } from '../../domain/policies/webhook-registration.policy';
import { HmacWebhookSecret } from '../../infrastructure/security/hmac-webhook-secret';

import { WebhookRegistrationService } from './webhook-registration.service';

const URL = 'https://veronica.example/webhooks/telegram';
const secret = new HmacWebhookSecret('bot-token');

class FakeAdmin {
  readonly registered: WebhookRegistration[] = [];
  infoCalls = 0;
  failure: Error | null = null;

  constructor(private readonly info: WebhookInfo) {}

  async getWebhookInfo(): Promise<WebhookInfo> {
    this.infoCalls += 1;
    if (this.failure !== null) throw this.failure;
    return this.info;
  }

  async setWebhook(registration: WebhookRegistration): Promise<void> {
    this.registered.push(registration);
  }
}

const serviceWith = (admin: FakeAdmin, webhookUrl: string | undefined) =>
  new WebhookRegistrationService(admin, secret, {
    allowedUserIds: ['10'],
    ...(webhookUrl === undefined ? {} : { webhookUrl }),
  });

describe('WebhookRegistrationService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('does nothing when no webhook url is configured', async () => {
    const admin = new FakeAdmin({ url: '', allowedUpdates: null });
    await expect(serviceWith(admin, undefined).register()).resolves.toBeNull();
    expect(admin.infoCalls).toBe(0);
    expect(admin.registered).toEqual([]);
  });

  it('registers when Telegram has no webhook, with the derived secret and kept updates', async () => {
    const admin = new FakeAdmin({ url: '', allowedUpdates: null });
    await expect(serviceWith(admin, URL).register()).resolves.toBe(WebhookDecision.REGISTER);
    expect(admin.registered).toEqual([
      {
        url: URL,
        secretToken: secret.value,
        allowedUpdates: ['message'],
        dropPendingUpdates: false,
      },
    ]);
  });

  it('skips when the registered webhook already matches', async () => {
    const admin = new FakeAdmin({ url: URL, allowedUpdates: ['message'] });
    await expect(serviceWith(admin, URL).register()).resolves.toBe(WebhookDecision.SKIP);
    expect(admin.registered).toEqual([]);
  });

  it('updates when the url or the allowed updates differ', async () => {
    const moved = new FakeAdmin({ url: 'https://old.example/hook', allowedUpdates: ['message'] });
    await serviceWith(moved, URL).register();
    expect(moved.registered).toHaveLength(1);
    const widened = new FakeAdmin({ url: URL, allowedUpdates: null });
    await serviceWith(widened, URL).register();
    expect(widened.registered).toHaveLength(1);
  });

  it('never writes the secret to the logs', async () => {
    const lines: string[] = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        lines.push(String(args[0]));
      });
    }
    await serviceWith(
      new FakeAdmin({ url: '', allowedUpdates: null }),
      URL,
    ).onApplicationBootstrap();
    await serviceWith(
      new FakeAdmin({ url: URL, allowedUpdates: ['message'] }),
      URL,
    ).onApplicationBootstrap();
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain(secret.value);
  });

  it('logs a failure and keeps the service booting', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const admin = new FakeAdmin({ url: '', allowedUpdates: null });
    admin.failure = new Error('Telegram down');
    await expect(serviceWith(admin, URL).onApplicationBootstrap()).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Telegram down'));
  });
});
