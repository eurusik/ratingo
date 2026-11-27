import { FixedClock } from '@ratingo/ai-core';

import { NotificationError } from '../../../notify/public';
import { DUME_DEADLINE_MS } from '../../domain/constants/dume.constants';
import {
  DUME_DELIVERY_FAILED_LINE,
  DUME_FAILURE_LINE,
  DUME_GAVE_UP_LINE,
  DUME_NOT_FOUND_LINE,
  DUME_REST_NOT_DELIVERED_LINE,
} from '../../domain/constants/dume-replies.constants';
import { TurnRole } from '../../domain/entities/conversation-turn';
import { DumeFailureReason, DumeState } from '../../domain/entities/dume';
import { DumeUnavailableError } from '../../domain/ports/dume-client.port';
import {
  FakeDelegationStore,
  FakeDumeClient,
  RecordingQueue,
} from '../../testing/dume-fakes.testing';
import { NOW_MS, answeredView, failedView, queuedView } from '../../testing/dume.testing';

import { DumeFollowUpOutcome, DumeFollowUpService } from './dume-follow-up.service';

const REQUEST_ID = 'tg00001000';
const FOLLOW_UP = { chatId: '10', requestId: REQUEST_ID, createdAtMs: NOW_MS - 60_000, attempt: 1 };
const ANSWERED = { kind: 'found', request: answeredView({ requestId: REQUEST_ID }) } as const;

const setup = (nowMs = NOW_MS) => {
  const client = new FakeDumeClient();
  const store = new FakeDelegationStore();
  const queue = new RecordingQueue();
  const sent: string[] = [];
  const remembered: { chatId: string; turns: unknown[] }[] = [];
  const sending = { failures: [] as (Error | null)[] };
  const service = new DumeFollowUpService(
    client,
    queue,
    {
      sendMessage: async (_chatId: string, html: string) => {
        const failure = sending.failures.shift();
        if (failure) throw failure;
        sent.push(html);
      },
    } as never,
    store,
    {
      recent: async () => [],
      append: async (chatId: string, turns: readonly unknown[]) =>
        void remembered.push({ chatId, turns: [...turns] }),
    },
    { repository: 'eurusik/ratingo' },
    new FixedClock(nowMs),
  );
  store.inFlight.set('10', REQUEST_ID);
  return { client, store, queue, sent, remembered, sending, service };
};

const rejectedForGood = () => new NotificationError('telegram 400', false);

describe('DumeFollowUpService', () => {
  it('delivers the answer as its own message, frees the chat and remembers a short form', async () => {
    const { service, client, sent, store, remembered } = setup();
    client.lookups = [ANSWERED];

    expect(await service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.DELIVERED);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('🔎 <b>DUM-E</b>');
    expect(store.inFlight.size).toBe(0);
    expect(store.delivery.get(REQUEST_ID)).toBe('sent');
    expect(remembered).toEqual([
      {
        chatId: '10',
        turns: [
          expect.objectContaining({
            role: TurnRole.ASSISTANT,
            text: expect.stringContaining('DUM-E: '),
          }),
        ],
      },
    ]);
  });

  it('waits and polls again later while the request is still running', async () => {
    const { service, client, queue, sent } = setup();
    client.lookups = [{ kind: 'found', request: queuedView({ state: DumeState.RUNNING }) }];

    expect(await service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.WAITING);

    expect(sent).toEqual([]);
    expect(queue.dumeFollowUps).toEqual([
      { followUp: { ...FOLLOW_UP, attempt: 2 }, delayMs: 30_000 },
    ]);
  });

  it('keeps polling when DUM-E cannot be reached, and says so once the deadline passes', async () => {
    const early = setup();
    early.client.lookups = [new DumeUnavailableError('timeout')];
    expect(await early.service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.WAITING);

    const late = setup(NOW_MS + DUME_DEADLINE_MS);
    late.client.lookups = [new DumeUnavailableError('timeout')];
    expect(await late.service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.DELIVERED);
    expect(late.sent).toEqual([expect.stringContaining(DUME_GAVE_UP_LINE)]);
  });

  it.each(Object.values(DumeFailureReason))(
    'tells the owner why a run failed with %s',
    async (reason) => {
      const { service, client, sent } = setup();
      client.lookups = [{ kind: 'found', request: failedView(reason) }];

      await service.handle(FOLLOW_UP);

      expect(sent).toEqual([expect.stringContaining(DUME_FAILURE_LINE[reason])]);
    },
  );

  it('says so when DUM-E has no such request', async () => {
    const { service, client, sent } = setup();
    client.lookups = [{ kind: 'not_found' }];

    await service.handle(FOLLOW_UP);

    expect(sent).toEqual([expect.stringContaining(DUME_NOT_FOUND_LINE)]);
  });

  describe('sending only once', () => {
    it('sends nothing the second time and still frees the chat', async () => {
      const { service, client, sent, store } = setup();
      client.lookups = [ANSWERED];
      await service.handle(FOLLOW_UP);
      store.inFlight.set('10', REQUEST_ID);

      expect(await service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.DUPLICATE);

      expect(sent).toHaveLength(1);
      expect(store.inFlight.size).toBe(0);
    });

    it('does not read a send that is still in progress as a delivery, and tries again after the claim expires', async () => {
      const { service, client, sent, store, queue } = setup();
      client.lookups = [ANSWERED];
      store.delivery.set(REQUEST_ID, 'sending');

      expect(await service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.WAITING);

      expect(sent).toEqual([]);
      expect(queue.dumeFollowUps).toEqual([
        { followUp: { ...FOLLOW_UP, attempt: 2 }, delayMs: 125_000 },
      ]);
      expect(store.inFlight.get('10')).toBe(REQUEST_ID);

      store.expireSending(REQUEST_ID);
      expect(await service.handle({ ...FOLLOW_UP, attempt: 2 })).toBe(
        DumeFollowUpOutcome.DELIVERED,
      );
      expect(sent).toHaveLength(1);
    });
  });

  describe('when sending fails', () => {
    it('lets the job retry by giving the delivery claim back', async () => {
      const { service, client, sending, store, sent } = setup();
      client.lookups = [ANSWERED];
      const failure = new NotificationError('telegram 502', true);
      sending.failures = [failure];

      await expect(service.handle(FOLLOW_UP)).rejects.toBe(failure);

      expect(store.delivery.has(REQUEST_ID)).toBe(false);
      expect(await service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.DELIVERED);
      expect(sent).toHaveLength(1);
    });

    it('keeps the claim and tries again later, from the same part, when Telegram may already have delivered the message', async () => {
      const { service, client, sending, store, queue, sent } = setup();
      client.lookups = [ANSWERED];
      sending.failures = [new NotificationError('timeout', true, true)];

      expect(await service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.WAITING);

      expect(store.delivery.get(REQUEST_ID)).toBe('sending');
      expect(store.inFlight.get('10')).toBe(REQUEST_ID);
      expect(queue.dumeFollowUps).toEqual([
        { followUp: { ...FOLLOW_UP, attempt: 2, deliveryAttempts: 1 }, delayMs: 125_000 },
      ]);

      store.expireSending(REQUEST_ID);
      expect(await service.handle(queue.dumeFollowUps[0]?.followUp as never)).toBe(
        DumeFollowUpOutcome.DELIVERED,
      );
      expect(sent).toHaveLength(1);
    });

    it('stops retrying after an unknown delivery too many times, logs it and frees the chat', async () => {
      const { service, client, sending, store, queue } = setup();
      client.lookups = [ANSWERED];
      sending.failures = [new NotificationError('timeout', true, true)];

      const outcome = await service.handle({ ...FOLLOW_UP, deliveryAttempts: 2 });

      expect(outcome).toBe(DumeFollowUpOutcome.UNDELIVERED);
      expect(queue.dumeFollowUps).toEqual([]);
      expect(store.inFlight.has('10')).toBe(false);
    });

    it('says the rest could not be delivered, instead of confirming a truncated answer, when the answer is gone after part one', async () => {
      const { service, client, store, sent } = setup();
      client.lookups = [{ kind: 'not_found' }];
      store.parts.set(REQUEST_ID, 1);

      expect(await service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.DELIVERED);

      expect(sent).toHaveLength(1);
      expect(sent[0]).toContain(DUME_REST_NOT_DELIVERED_LINE);
      expect(store.delivery.get(REQUEST_ID)).toBe('sent');
    });

    it('says the rest could not be delivered when the retry gives up after part one', async () => {
      const { service, client, store, sent } = setup();
      client.lookups = [{ kind: 'found', request: queuedView({ requestId: REQUEST_ID }) }];
      store.parts.set(REQUEST_ID, 2);

      await service.handle({ ...FOLLOW_UP, createdAtMs: NOW_MS - DUME_DEADLINE_MS - 1 });

      expect(sent).toHaveLength(1);
      expect(sent[0]).toContain(DUME_REST_NOT_DELIVERED_LINE);
      expect(sent[0]).not.toContain(DUME_GAVE_UP_LINE);
    });

    it('resumes after the part that was already sent, so a retry never repeats message one', async () => {
      const { service, client, sending, store, sent } = setup();
      const long = 'x'.repeat(300);
      client.lookups = [
        {
          kind: 'found',
          request: answeredView({
            requestId: REQUEST_ID,
            result: {
              ...(answeredView().result as NonNullable<ReturnType<typeof answeredView>['result']>),
              answer: {
                ...(answeredView().result as NonNullable<ReturnType<typeof answeredView>['result']>)
                  .answer,
                facts: Array.from({ length: 12 }, (_, index) => ({
                  text: `fact ${index} ${long}`,
                  citations: [{ path: 'apps/api/src/a.ts', startLine: 1, endLine: 2 }],
                  evidence: [
                    { ref: `logs_search#${index}.1`, tool: 'logs_search', summary: long },
                    { ref: `logs_search#${index}.2`, tool: 'logs_search', summary: long },
                  ],
                })),
              },
            },
          }),
        },
      ];
      sending.failures = [null, new NotificationError('telegram 502', true)];

      await expect(service.handle(FOLLOW_UP)).rejects.toBeInstanceOf(NotificationError);
      const firstPart = sent[0];
      expect(store.parts.get(REQUEST_ID)).toBe(1);

      await service.handle(FOLLOW_UP);

      expect(sent[0]).toBe(firstPart);
      expect(sent.filter((message) => message === firstPart)).toHaveLength(1);
      expect(sent.length).toBeGreaterThan(1);
    });

    it('sends plain text when Telegram rejects the formatted message for good', async () => {
      const { service, client, sending, sent } = setup();
      client.lookups = [ANSWERED];
      sending.failures = [rejectedForGood()];

      await service.handle(FOLLOW_UP);

      expect(sent).toHaveLength(1);
      expect(sent[0]).not.toMatch(/<(b|i|a|code)\b/);
      expect(sent[0]).toContain('DUM-E');
    });

    it('sends one short honest line when the plain text is rejected too', async () => {
      const { service, client, sending, sent } = setup();
      client.lookups = [ANSWERED];
      sending.failures = [rejectedForGood(), rejectedForGood()];

      await service.handle(FOLLOW_UP);

      expect(sent).toEqual([expect.stringContaining(DUME_DELIVERY_FAILED_LINE)]);
    });
  });

  describe('abandoning a follow-up that will not be retried', () => {
    it('tells the owner once, frees the chat and confirms the delivery', async () => {
      const { service, sent, store } = setup();

      await service.abandon(FOLLOW_UP);
      await service.abandon(FOLLOW_UP);

      expect(sent).toEqual([expect.stringContaining(DUME_DELIVERY_FAILED_LINE)]);
      expect(store.inFlight.size).toBe(0);
      expect(store.delivery.get(REQUEST_ID)).toBe('sent');
    });

    it('stays quiet when the answer was already delivered, but still frees the chat', async () => {
      const { service, sent, store } = setup();
      store.delivery.set(REQUEST_ID, 'sent');

      await service.abandon(FOLLOW_UP);

      expect(sent).toEqual([]);
      expect(store.inFlight.size).toBe(0);
    });

    it('frees the chat even when the last line cannot be sent', async () => {
      const { service, sending, store } = setup();
      sending.failures = [new NotificationError('telegram down', true)];

      await service.abandon(FOLLOW_UP);

      expect(store.inFlight.size).toBe(0);
    });
  });
});
