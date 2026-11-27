import { DelegationStatus } from '../../domain/constants/dume.constants';
import {
  DUME_ALREADY_RUNNING_NOTICE,
  DUME_ALREADY_STARTED_NOTICE,
  DUME_REJECTION_NOTICE,
  DUME_STARTED_NOTICE,
  DUME_UNAVAILABLE_NOTICE,
} from '../../domain/constants/dume-replies.constants';
import { DumeRejectionReason, DumeSubmitKind } from '../../domain/entities/dume';
import { DumeUnavailableError } from '../../domain/ports/dume-client.port';
import {
  FakeDelegationStore,
  FakeDumeClient,
  RecordingQueue,
} from '../../testing/dume-fakes.testing';

import { DumeDelegationService } from './dume-delegation.service';

const REQUEST = { chatId: '10', updateId: 4711, question: 'Why does sync-show time out?' };

const setup = () => {
  const client = new FakeDumeClient();
  const store = new FakeDelegationStore();
  const queue = new RecordingQueue();
  return { client, store, queue, service: new DumeDelegationService(client, store, queue) };
};

describe('DumeDelegationService', () => {
  it('names the request after the Telegram update and starts it on main', async () => {
    const { service, client } = setup();

    const outcome = await service.delegate(REQUEST);

    expect(client.submissions).toEqual([
      { requestId: 'tg4711', question: REQUEST.question, ref: 'main' },
    ]);
    expect(outcome).toEqual({
      status: DelegationStatus.STARTED,
      requestId: 'tg4711',
      ownerNotice: DUME_STARTED_NOTICE,
    });
  });

  it('schedules the first follow-up from the time DUM-E gave the request', async () => {
    const { service, queue } = setup();

    await service.delegate(REQUEST);

    expect(queue.dumeFollowUps).toEqual([
      {
        followUp: { chatId: '10', requestId: 'tg4711', createdAtMs: 1_000, attempt: 1 },
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
      request: { requestId: 'tg4711', state: 'running', createdAtMs: 1_000 },
    };

    const retry = await service.delegate(REQUEST);

    expect(retry).toMatchObject({
      status: DelegationStatus.ALREADY_STARTED,
      ownerNotice: DUME_ALREADY_STARTED_NOTICE,
    });
    expect(client.submissions.every((entry) => entry.requestId === 'tg4711')).toBe(true);
  });

  it('answers a second question in the same message as already started, without a new follow-up', async () => {
    const { service, client, queue } = setup();
    client.submitResult = { kind: DumeSubmitKind.CONFLICT };

    const outcome = await service.delegate(REQUEST);

    expect(outcome.status).toBe(DelegationStatus.ALREADY_STARTED);
    expect(queue.dumeFollowUps).toEqual([]);
  });

  it('does not start a second investigation while this chat has one in flight', async () => {
    const { service, client, store } = setup();
    store.inFlight.set('10', 'tg4000');

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

  it('reports DUM-E as unavailable with the reason and frees the chat', async () => {
    const { service, client, store } = setup();
    client.submitResult = new DumeUnavailableError('not_configured');

    const outcome = await service.delegate(REQUEST);

    expect(outcome).toEqual({
      status: DelegationStatus.UNAVAILABLE,
      reason: 'not_configured',
      ownerNotice: DUME_UNAVAILABLE_NOTICE,
    });
    expect(store.inFlight.size).toBe(0);
  });

  it('treats a broken store as unavailable too, never as an exception for the model run', async () => {
    const { service, store } = setup();
    store.claimInFlight = async () => {
      throw new Error('redis down');
    };

    expect(await service.delegate(REQUEST)).toMatchObject({
      status: DelegationStatus.UNAVAILABLE,
      reason: 'internal_error',
    });
  });

  it('gives no gendered past-tense verb about itself in any notice', () => {
    const notices = [
      DUME_STARTED_NOTICE,
      DUME_ALREADY_STARTED_NOTICE,
      DUME_ALREADY_RUNNING_NOTICE,
      DUME_UNAVAILABLE_NOTICE,
      ...Object.values(DUME_REJECTION_NOTICE),
    ];

    for (const notice of notices) {
      expect(notice).not.toMatch(
        /(?:^|\s)(?:зробив|зробила|запустив|запустила|почав|почала|не зміг|не змогла)(?:\s|[.,]|$)/u,
      );
    }
  });
});
