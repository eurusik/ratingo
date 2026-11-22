import { NotificationError } from '../../domain/ports/notifier.port';

import { TelegramNotifierAdapter } from './telegram.notifier-adapter';

const CONFIG = { botToken: 'secret-token', chatId: '42' };

const reply = (status: number, body: unknown) =>
  jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('TelegramNotifierAdapter', () => {
  it('posts HTML and disables the notification for silent messages', async () => {
    const fetchImpl = reply(200, { ok: true });
    await new TelegramNotifierAdapter(CONFIG, fetchImpl).send({ html: '<b>hi</b>', silent: true });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botsecret-token/sendMessage');
    expect(JSON.parse(init.body as string)).toMatchObject({
      chat_id: '42',
      text: '<b>hi</b>',
      parse_mode: 'HTML',
      disable_notification: true,
    });
  });

  it('sends loud messages with notifications on', async () => {
    const fetchImpl = reply(200, { ok: true });
    await new TelegramNotifierAdapter(CONFIG, fetchImpl).send({ html: 'x', silent: false });
    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.disable_notification).toBe(false);
  });

  it('throws without leaking the token when Telegram rejects the message', async () => {
    const adapter = new TelegramNotifierAdapter(
      CONFIG,
      reply(400, { ok: false, description: 'bad html' }),
    );
    const error = await adapter.send({ html: 'x', silent: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NotificationError);
    expect((error as Error).message).toContain('bad html');
    expect((error as Error).message).not.toContain('secret-token');
  });

  it('throws without leaking the token when the network fails', async () => {
    const adapter = new TelegramNotifierAdapter(
      CONFIG,
      jest.fn().mockRejectedValue(new TypeError('fetch failed secret-token')),
    );
    const error = await adapter.send({ html: 'x', silent: false }).catch((e: unknown) => e);
    expect((error as Error).message).not.toContain('secret-token');
  });
});
