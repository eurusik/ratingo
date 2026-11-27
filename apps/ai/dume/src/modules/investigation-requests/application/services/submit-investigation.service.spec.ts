import { FixedClock } from '@ratingo/ai-core';

import {
  FailureReason,
  RejectionReason,
  RequestState,
} from '../../domain/constants/request.constants';
import {
  FakeDayLimits,
  InMemoryRequestStore,
  NOW_MS,
  RecordingQueue,
} from '../../testing/investigation-requests.testing';

import {
  SubmitInvestigationService,
  SubmitKind,
  type Submission,
} from './submit-investigation.service';

const submission: Submission = {
  requestId: 'tg1000001',
  question: 'Why does sync-show time out?',
  ref: 'main',
};

const setup = () => {
  const store = new InMemoryRequestStore();
  const queue = new RecordingQueue();
  const limits = new FakeDayLimits();
  const service = new SubmitInvestigationService(store, queue, limits, new FixedClock(NOW_MS));
  return { store, queue, limits, service };
};

describe('SubmitInvestigationService', () => {
  it('stores a new request as queued, counts it once and puts one job in the queue', async () => {
    const { service, store, queue, limits } = setup();

    const result = await service.submit(submission);

    expect(result).toMatchObject({ kind: SubmitKind.ACCEPTED, created: true });
    expect(store.records.get('tg1000001')).toMatchObject({
      state: RequestState.QUEUED,
      question: submission.question,
      createdAtMs: NOW_MS,
    });
    expect(queue.jobs).toEqual([{ requestId: 'tg1000001' }]);
    expect(limits.accepted).toBe(1);
  });

  it('answers a repeat of the same request with the stored one and adds no job and no count', async () => {
    const { service, queue, limits } = setup();
    await service.submit(submission);

    const repeat = await service.submit(submission);

    expect(repeat).toMatchObject({ kind: SubmitKind.ACCEPTED, created: false });
    expect(queue.jobs).toHaveLength(1);
    expect(limits.accepted).toBe(1);
  });

  it('answers a repeat even when the daily limits are reached by now', async () => {
    const { service, limits } = setup();
    await service.submit(submission);
    limits.accepted = limits.max;
    limits.spent = limits.budget;

    expect(await service.submit(submission)).toMatchObject({ created: false });
  });

  it.each([
    ['another question', { question: 'Something else?' }],
    ['another ref', { ref: 'development' }],
  ])('refuses the same request id with %s', async (_name, change) => {
    const { service, queue } = setup();
    await service.submit(submission);

    expect(await service.submit({ ...submission, ...change })).toEqual({
      kind: SubmitKind.CONFLICT,
    });
    expect(queue.jobs).toHaveLength(1);
  });

  it('treats a lost creation race as a repeat of the winner', async () => {
    const { service, store, queue } = setup();
    const winner = { ...submission };
    store.create = async () => {
      store.records.set(winner.requestId, {
        version: 1,
        requestId: winner.requestId,
        question: winner.question,
        ref: winner.ref,
        state: RequestState.QUEUED,
        createdAtMs: NOW_MS,
      });
      return 'exists';
    };

    expect(await service.submit(submission)).toMatchObject({ created: false });
    expect(queue.jobs).toHaveLength(0);
  });

  it.each([
    ['the day budget is spent', (l: FakeDayLimits) => (l.spent = l.budget), RejectionReason.DAY_BUDGET],
    ['the daily count is reached', (l: FakeDayLimits) => (l.accepted = l.max), RejectionReason.DAILY_COUNT_CAP],
  ])('rejects without storing anything when %s', async (_name, exhaust, reason) => {
    const { service, store, queue, limits } = setup();
    exhaust(limits);

    expect(await service.submit(submission)).toEqual({ kind: SubmitKind.REJECTED, reason });
    expect(store.records.size).toBe(0);
    expect(queue.jobs).toHaveLength(0);
  });

  it('rejects when the queue is full', async () => {
    const { service, queue } = setup();
    queue.waiting = 2;

    expect(await service.submit(submission)).toEqual({
      kind: SubmitKind.REJECTED,
      reason: RejectionReason.QUEUE_FULL,
    });
  });

  it('still accepts a request when counting it fails, because the job is already queued', async () => {
    const { service, queue, limits } = setup();
    limits.countAccepted = async () => {
      throw new Error('redis down');
    };

    expect(await service.submit(submission)).toMatchObject({ kind: SubmitKind.ACCEPTED });
    expect(queue.jobs).toHaveLength(1);
  });

  it('reports a request failed when it cannot be queued, instead of leaving it queued forever', async () => {
    const { service, store, queue } = setup();
    queue.failWith = new Error('redis down');

    const result = await service.submit(submission);

    expect(result).toMatchObject({
      kind: SubmitKind.ACCEPTED,
      record: { state: RequestState.FAILED, reason: FailureReason.INTERNAL_ERROR },
    });
    expect(store.records.get('tg1000001')?.state).toBe(RequestState.FAILED);
  });
});
