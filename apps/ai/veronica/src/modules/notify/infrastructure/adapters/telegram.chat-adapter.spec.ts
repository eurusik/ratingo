import { NotificationError } from '../../domain/ports/notifier.port';

import { TelegramChatAdapter } from './telegram.chat-adapter';

const CONFIG = { botToken: 'secret-token' };

const reply = (status: number, body: unknown) =>
  jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

const bodyOf = (fetchImpl: jest.Mock): Record<string, unknown> =>
  JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);

const urlOf = (fetchImpl: jest.Mock): string => (fetchImpl.mock.calls[0] as [string])[0];

describe('TelegramChatAdapter', () => {
  it('sends sanitized HTML without link previews', async () => {
    const fetchImpl = reply(200, { ok: true });
    await new TelegramChatAdapter(CONFIG, undefined, fetchImpl).sendMessage(
      '42',
      '<b>hi</b> <a href="https://evil.example">x</a>',
    );
    expect(urlOf(fetchImpl)).toBe('https://api.telegram.org/botsecret-token/sendMessage');
    expect(bodyOf(fetchImpl)).toEqual({
      chat_id: '42',
      text: '<b>hi</b> x',
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  it('posts a message and returns its id so it can be edited later', async () => {
    const fetchImpl = reply(200, { ok: true, result: { message_id: 55 } });
    await expect(
      new TelegramChatAdapter(CONFIG, undefined, fetchImpl).postMessage('42', '<i>шукаю…</i>'),
    ).resolves.toBe(55);
    expect(urlOf(fetchImpl)).toContain('/sendMessage');
  });

  it('fails without retrying when Telegram sends no message id', async () => {
    const error = await new TelegramChatAdapter(CONFIG, undefined, reply(200, { ok: true }))
      .postMessage('42', 'x')
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotificationError);
    expect((error as NotificationError).retryable).toBe(false);
  });

  it('edits a message with sanitized HTML and no link previews', async () => {
    const fetchImpl = reply(200, { ok: true });
    await new TelegramChatAdapter(CONFIG, undefined, fetchImpl).editMessage(
      '42',
      55,
      '<b>ok</b> <a href="https://evil.example">x</a>',
    );
    expect(urlOf(fetchImpl)).toContain('/editMessageText');
    expect(bodyOf(fetchImpl)).toEqual({
      chat_id: '42',
      message_id: 55,
      text: '<b>ok</b> x',
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
    });
  });

  it('shows the typing indicator', async () => {
    const fetchImpl = reply(200, { ok: true });
    await new TelegramChatAdapter(CONFIG, undefined, fetchImpl).sendChatAction('42', 'typing');
    expect(urlOf(fetchImpl)).toContain('/sendChatAction');
    expect(bodyOf(fetchImpl)).toEqual({ chat_id: '42', action: 'typing' });
  });

  it('reads the registered webhook', async () => {
    const fetchImpl = reply(200, {
      ok: true,
      result: { url: 'https://v.example/hook', allowed_updates: ['message'] },
    });
    await expect(
      new TelegramChatAdapter(CONFIG, undefined, fetchImpl).getWebhookInfo(),
    ).resolves.toEqual({
      url: 'https://v.example/hook',
      allowedUpdates: ['message'],
    });
  });

  it('reports no webhook as an empty url and default updates', async () => {
    const fetchImpl = reply(200, { ok: true, result: { url: '' } });
    await expect(
      new TelegramChatAdapter(CONFIG, undefined, fetchImpl).getWebhookInfo(),
    ).resolves.toEqual({
      url: '',
      allowedUpdates: null,
    });
  });

  it('registers a webhook with the secret and without dropping updates', async () => {
    const fetchImpl = reply(200, { ok: true });
    await new TelegramChatAdapter(CONFIG, undefined, fetchImpl).setWebhook({
      url: 'https://v.example/hook',
      secretToken: 'derived',
      allowedUpdates: ['message'],
      dropPendingUpdates: false,
    });
    expect(urlOf(fetchImpl)).toContain('/setWebhook');
    expect(bodyOf(fetchImpl)).toEqual({
      url: 'https://v.example/hook',
      secret_token: 'derived',
      allowed_updates: ['message'],
      drop_pending_updates: false,
    });
  });

  it('throws without leaking the token or the secret when Telegram rejects the call', async () => {
    const adapter = new TelegramChatAdapter(
      CONFIG,
      undefined,
      reply(400, { ok: false, description: 'bad webhook' }),
    );
    const error = await adapter
      .setWebhook({
        url: 'https://v.example/hook',
        secretToken: 'derived',
        allowedUpdates: [],
        dropPendingUpdates: false,
      })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotificationError);
    expect((error as Error).message).toContain('bad webhook');
    expect((error as Error).message).not.toContain('secret-token');
    expect((error as Error).message).not.toContain('derived');
  });

  it('marks a network failure as delivery-unknown without the token', async () => {
    const adapter = new TelegramChatAdapter(
      CONFIG,
      undefined,
      jest.fn().mockRejectedValue(new TypeError('fetch failed secret-token')),
    );
    const error = await adapter.sendMessage('42', 'x').catch((e: unknown) => e);
    expect((error as NotificationError).deliveryUnknown).toBe(true);
    expect((error as Error).message).not.toContain('secret-token');
  });

  it('keeps code links of the configured repository and drops all others', async () => {
    const sha = 'a'.repeat(40);
    const good = `https://github.com/eurusik/ratingo/blob/${sha}/a.ts#L1`;
    const bad = `https://github.com/other/repo/blob/${sha}/a.ts#L1`;
    const fetchImpl = reply(200, { ok: true, result: { message_id: 1 } });
    const adapter = new TelegramChatAdapter(CONFIG, 'eurusik/ratingo', fetchImpl);

    await adapter.sendMessage('42', `<a href="${good}">ok</a> <a href="${bad}">no</a>`);

    expect(bodyOf(fetchImpl).text).toBe(`<a href="${good}">ok</a> no`);
  });
});
