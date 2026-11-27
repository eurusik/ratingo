import { FixedClock } from '@ratingo/ai-core';

import { NotificationError } from '../../../notify/public';
import { DUME_DEADLINE_MS } from '../../domain/constants/dume.constants';
import {
  DUME_FAILURE_LINE,
  DUME_GAVE_UP_LINE,
  DUME_NOT_FOUND_LINE,
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

const FOLLOW_UP = {
  chatId: '10',
  requestId: 'tg1000001',
  createdAtMs: NOW_MS - 60_000,
  attempt: 1,
};

const setup = (nowMs = NOW_MS) => {
  const client = new FakeDumeClient();
  const store = new FakeDelegationStore();
  const queue = new RecordingQueue();
  const sent: string[] = [];
  const remembered: { chatId: string; turns: unknown[] }[] = [];
  const state = { sendFailure: null as Error | null };
  const service = new DumeFollowUpService(
    client,
    queue,
    {
      sendMessage: async (_chatId: string, html: string) => {
        if (state.sendFailure !== null) throw state.sendFailure;
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
  store.inFlight.set('10', 'tg1000001');
  return { client, store, queue, sent, remembered, state, service };
};

describe('DumeFollowUpService', () => {
  it('delivers the answer as its own message, frees the chat and remembers a short form', async () => {
    const { service, client, sent, store, remembered } = setup();
    client.lookups = [{ kind: 'found', request: answeredView() }];

    expect(await service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.DELIVERED);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('🔎 <b>DUM-E</b>');
    expect(store.inFlight.size).toBe(0);
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

  it('sends nothing the second time, so a repeated job never duplicates the message', async () => {
    const { service, client, sent } = setup();
    client.lookups = [{ kind: 'found', request: answeredView() }];

    await service.handle(FOLLOW_UP);
    const second = await service.handle(FOLLOW_UP);

    expect(second).toBe(DumeFollowUpOutcome.DUPLICATE);
    expect(sent).toHaveLength(1);
  });

  it('confirms the delivery only after every message was sent', async () => {
    const { service, client, store } = setup();
    client.lookups = [{ kind: 'found', request: answeredView() }];

    await service.handle(FOLLOW_UP);

    expect(store.confirmed.has('tg1000001')).toBe(true);
  });

  it('does not confirm a delivery that failed', async () => {
    const { service, client, state, store } = setup();
    client.lookups = [{ kind: 'found', request: answeredView() }];
    state.sendFailure = new NotificationError('telegram 502', true);

    await expect(service.handle(FOLLOW_UP)).rejects.toBe(state.sendFailure);

    expect(store.confirmed.size).toBe(0);
  });

  it('lets the job retry when sending fails, by giving the delivery claim back', async () => {
    const { service, client, state, store, sent } = setup();
    client.lookups = [{ kind: 'found', request: answeredView() }];
    state.sendFailure = new NotificationError('telegram 502', true);

    await expect(service.handle(FOLLOW_UP)).rejects.toBe(state.sendFailure);
    state.sendFailure = null;

    expect(store.delivered.size).toBe(0);
    expect(await service.handle(FOLLOW_UP)).toBe(DumeFollowUpOutcome.DELIVERED);
    expect(sent).toHaveLength(1);
  });

  it('keeps the claim when Telegram may already have delivered the message', async () => {
    const { service, client, state, store } = setup();
    client.lookups = [{ kind: 'found', request: answeredView() }];
    state.sendFailure = new NotificationError('timeout', true, true);

    await expect(service.handle(FOLLOW_UP)).rejects.toBe(state.sendFailure);

    expect(store.delivered.has('tg1000001')).toBe(true);
  });
});
