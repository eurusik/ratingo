import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { CHAT_CONFIG, TELEGRAM_CONFIG } from '../../../config/config.constants';
import { ChatWebhookService } from '../application/services/chat-webhook.service';
import { WEBHOOK_SECRET_HEADER } from '../chat.constants';
import type { ChatEvent } from '../domain/ports/chat-metrics.port';
import { CHAT_JOB_QUEUE } from '../domain/ports/chat-job-queue.port';
import { CHAT_METRICS_PORT } from '../domain/ports/chat-metrics.port';
import { WEBHOOK_SECRET_PORT } from '../domain/ports/webhook-secret.port';
import type { IncomingMessage } from '../domain/entities/incoming-message';
import { HmacWebhookSecret } from '../infrastructure/security/hmac-webhook-secret';

import { TelegramWebhookController } from './telegram-webhook.controller';

const OWNER = 10;
const secret = new HmacWebhookSecret('bot-token');

const update = (overrides: {
  userId?: number;
  chatId?: number;
  chatType?: string;
  id?: number;
}) => ({
  update_id: overrides.id ?? 1,
  message: {
    from: { id: overrides.userId ?? OWNER },
    chat: { id: overrides.chatId ?? OWNER, type: overrides.chatType ?? 'private' },
    text: '/status',
  },
});

describe('TelegramWebhookController', () => {
  let app: NestFastifyApplication;
  const enqueued: IncomingMessage[] = [];
  const events: ChatEvent[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TelegramWebhookController],
      providers: [
        ChatWebhookService,
        { provide: WEBHOOK_SECRET_PORT, useValue: secret },
        {
          provide: CHAT_JOB_QUEUE,
          useValue: { enqueue: async (m: IncomingMessage) => void enqueued.push(m) },
        },
        { provide: CHAT_METRICS_PORT, useValue: { record: (e: ChatEvent) => void events.push(e) } },
        { provide: CHAT_CONFIG, useValue: { allowedUserIds: [String(OWNER)] } },
        { provide: TELEGRAM_CONFIG, useValue: { botToken: 'bot-token', chatId: String(OWNER) } },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    enqueued.length = 0;
    events.length = 0;
  });

  const post = (payload: unknown, headerValue?: string) =>
    app.inject({
      method: 'POST',
      url: '/webhooks/telegram',
      headers: headerValue === undefined ? {} : { [WEBHOOK_SECRET_HEADER]: headerValue },
      payload: payload as object,
    });

  it('answers 401 and enqueues nothing without the secret header', async () => {
    const response = await post(update({}));
    expect(response.statusCode).toBe(401);
    expect(enqueued).toEqual([]);
    expect(events).toEqual([{ outcome: 'rejected', command: 'none' }]);
  });

  it('answers 401 for a wrong secret', async () => {
    expect((await post(update({}), 'wrong')).statusCode).toBe(401);
    expect(enqueued).toEqual([]);
  });

  it('answers 200 and ignores an unknown user without revealing anything', async () => {
    const response = await post(update({ userId: 999 }), secret.value);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(enqueued).toEqual([]);
    expect(events).toEqual([{ outcome: 'ignored', command: 'none' }]);
  });

  it('ignores the right user in the wrong chat and in a group', async () => {
    expect((await post(update({ chatId: 77 }), secret.value)).statusCode).toBe(200);
    expect((await post(update({ chatType: 'group' }), secret.value)).statusCode).toBe(200);
    expect(enqueued).toEqual([]);
  });

  it('ignores updates that are not text messages', async () => {
    const response = await post({ update_id: 5, edited_message: { text: 'x' } }, secret.value);
    expect(response.statusCode).toBe(200);
    expect(enqueued).toEqual([]);
  });

  it('enqueues a message from the owner and answers 200', async () => {
    const response = await post(update({ id: 42 }), secret.value);
    expect(response.statusCode).toBe(200);
    expect(enqueued).toEqual([
      { updateId: 42, userId: '10', chatId: '10', chatType: 'private', text: '/status' },
    ]);
    expect(events).toEqual([]);
  });

  it('hands the same update to the queue on every Telegram retry', async () => {
    await post(update({ id: 42 }), secret.value);
    await post(update({ id: 42 }), secret.value);
    expect(enqueued.map((m) => m.updateId)).toEqual([42, 42]);
  });
});
