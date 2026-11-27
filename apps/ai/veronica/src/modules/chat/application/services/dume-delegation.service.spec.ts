import { FixedClock } from '@ratingo/ai-core';

import { DelegationStatus } from '../../domain/constants/dume.constants';
import {
  DUME_ALREADY_RUNNING_NOTICE,
  DUME_ALREADY_STARTED_NOTICE,
  DUME_REJECTION_NOTICE,
  DUME_STARTED_NOTICE,
  DUME_UNAVAILABLE_NOTICE,
  DUME_UNCONFIRMED_NOTICE,
  DUME_UNTRACKED_NOTICE,
} from '../../domain/constants/dume-replies.constants';
import { DumeRejectionReason, DumeSubmitKind } from '../../domain/entities/dume';
import { DumeUnavailableError, StartCertainty } from '../../domain/ports/dume-client.port';
import {
  FakeDelegationStore,
  FakeDumeClient,
  RecordingQueue,
} from '../../testing/dume-fakes.testing';
import { NOW_MS } from '../../testing/dume.testing';

import { DumeDelegationService } from './dume-delegation.service';

const REQUEST = { chatId: '10', updateId: 4711, question: 'Why does sync-show time out?' };
const REQUEST_ID = 'tg00004711';

const setup = () => {
  const client = new FakeDumeClient();
  const store = new FakeDelegationStore();
  const queue = new RecordingQueue();
  const service = new DumeDelegationService(client, store, queue, new FixedClock(NOW_MS));
  return { client, store, queue, service };
};

describe('DumeDelegationService', () => {
  it('names the request after the Telegram update, padded to the length DUM-E requires, on main', async () => {
    const { service, client } = setup();

    const outcome = await service.delegate(REQUEST);

    expect(client.submissions).toEqual([
      { requestId: REQUEST_ID, question: REQUEST.question, ref: 'main' },
    ]);
    expect(outcome).toEqual({
      status: DelegationStatus.STARTED,
      requestId: REQUEST_ID,
      ownerNotice: DUME_STARTED_NOTICE,
    });
  });

  it('gives a request id of at least eight characters even for a small update id', async () => {
    const { service, client } = setup();

    await service.delegate({ ...REQUEST, updateId: 7 });

    expect(client.submissions[0]?.requestId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('schedules the first follow-up from the time DUM-E gave the request', async () => {
    const { service, queue } = setup();

    await service.delegate(REQUEST);

    expect(queue.dumeFollowUps).toEqual([
      {
        followUp: { chatId: '10', requestId: REQUEST_ID, createdAtMs: 1_000, attempt: 1 },
        delayMs: 30_000,
      },
    ]);
  });

  it('answers a retry of the same Telegram update as already started and starts nothing twice', async () => {
    const { service, client } = setup();
    await service.delegate(REQUEST);
    client.submitResult = {
      kind: DumeSubmitKind.ACCEPTED,
      created: false,
      request: { requestId: REQUEST_ID, state: 'running', createdAtMs: 1_000 },
    };

    const retry = await service.delegate(REQUEST);

    expect(retry).toMatchObject({
      status: DelegationStatus.ALREADY_STARTED,
      ownerNotice: DUME_ALREADY_STARTED_NOTICE,
    });
    expect(client.submissions.every((entry) => entry.requestId === REQUEST_ID)).toBe(true);
  });

  it('answers a second question in the same message as already started and still follows it up', async () => {
    const { service, client, queue } = setup();
    client.submitResult = { kind: DumeSubmitKind.CONFLICT };

    const outcome = await service.delegate(REQUEST);

    expect(outcome.status).toBe(DelegationStatus.ALREADY_STARTED);
    expect(queue.dumeFollowUps).toHaveLength(1);
    expect(queue.dumeFollowUps[0]?.followUp.createdAtMs).toBe(NOW_MS);
  });

  it('does not start a second investigation while this chat has one in flight', async () => {
    const { service, client, store } = setup();
    store.inFlight.set('10', 'tg00004000');

    const outcome = await service.delegate(REQUEST);

    expect(outcome).toEqual({
      status: DelegationStatus.ALREADY_RUNNING,
      ownerNotice: DUME_ALREADY_RUNNING_NOTICE,
    });
    expect(client.submissions).toEqual([]);
  });

  it.each(Object.values(DumeRejectionReason))(
    'relays the rejection %s with a notice and frees the chat',
    async (reason) => {
      const { service, client, store, queue } = setup();
      client.submitResult = { kind: DumeSubmitKind.REJECTED, reason };

      const outcome = await service.delegate(REQUEST);

      expect(outcome).toEqual({
        status: DelegationStatus.REJECTED,
        reason,
        ownerNotice: DUME_REJECTION_NOTICE[reason],
      });
      expect(store.inFlight.size).toBe(0);
      expect(queue.dumeFollowUps).toEqual([]);
    },
  );

  it('reports DUM-E as unavailable when it was certainly not started, and frees the chat', async () => {
    const { service, client, store, queue } = setup();
    client.submitResult = new DumeUnavailableError('not_configured');

    const outcome = await service.delegate(REQUEST);

    expect(outcome).toEqual({
      status: DelegationStatus.UNAVAILABLE,
      reason: 'not_configured',
      ownerNotice: DUME_UNAVAILABLE_NOTICE,
    });
    expect(store.inFlight.size).toBe(0);
    expect(queue.dumeFollowUps).toEqual([]);
  });

  describe('when DUM-E may have accepted the question but its answer did not reach Veronica', () => {
    it.each(['TimeoutError', 'HTTP 502', 'unexpected response shape'])(
      'keeps the chat locked, follows the request up anyway and says the start is unconfirmed (%s)',
      async (reason) => {
        const { service, client, store, queue } = setup();
        client.submitResult = new DumeUnavailableError(reason, StartCertainty.MAYBE_STARTED);

        const outcome = await service.delegate(REQUEST);

        expect(outcome).toEqual({
          status: DelegationStatus.UNCONFIRMED,
          requestId: REQUEST_ID,
          ownerNotice: DUME_UNCONFIRMED_NOTICE,
        });
        expect(store.inFlight.get('10')).toBe(REQUEST_ID);
        expect(queue.dumeFollowUps).toEqual([
          {
            followUp: { chatId: '10', requestId: REQUEST_ID, createdAtMs: NOW_MS, attempt: 1 },
            delayMs: 30_000,
          },
        ]);
      },
    );
  });

  describe('when the follow-up cannot be scheduled', () => {
    it('retries the idempotent schedule and still starts', async () => {
      const { service, queue } = setup();
      queue.scheduleFailures = 2;

      const outcome = await service.delegate(REQUEST);

      expect(outcome.status).toBe(DelegationStatus.STARTED);
      expect(queue.dumeFollowUps).toHaveLength(1);
    });

    it('says the answer cannot be tracked, and frees the chat, when it never works', async () => {
      const { service, queue, store } = setup();
      queue.scheduleFailures = 10;

      const outcome = await service.delegate(REQUEST);

      expect(outcome).toEqual({
        status: DelegationStatus.UNTRACKED,
        requestId: REQUEST_ID,
        ownerNotice: DUME_UNTRACKED_NOTICE,
      });
      expect(store.inFlight.size).toBe(0);
    });

    it('also says so after an unconfirmed start', async () => {
      const { service, client, queue } = setup();
      client.submitResult = new DumeUnavailableError('TimeoutError', StartCertainty.MAYBE_STARTED);
      queue.scheduleFailures = 10;

      expect((await service.delegate(REQUEST)).status).toBe(DelegationStatus.UNTRACKED);
    });
  });

  it('treats a broken store as unavailable, never as an exception for the model run', async () => {
    const { service, store, client } = setup();
    store.claimInFlight = async () => {
      throw new Error('redis down');
    };

    expect(await service.delegate(REQUEST)).toMatchObject({
      status: DelegationStatus.UNAVAILABLE,
      reason: 'internal_error',
    });
    expect(client.submissions).toEqual([]);
  });

  it('gives no gendered past-tense verb about itself in any notice', () => {
    const notices = [
      DUME_STARTED_NOTICE,
      DUME_ALREADY_STARTED_NOTICE,
      DUME_ALREADY_RUNNING_NOTICE,
      DUME_UNAVAILABLE_NOTICE,
      DUME_UNCONFIRMED_NOTICE,
      DUME_UNTRACKED_NOTICE,
      ...Object.values(DUME_REJECTION_NOTICE),
    ];

    for (const notice of notices) {
      expect(notice).not.toMatch(
        /(?:^|\s)(?:зробив|зробила|запустив|запустила|почав|почала|не зміг|не змогла)(?:\s|[.,]|$)/u,
      );
    }
  });
});
