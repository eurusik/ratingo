import { UnrecoverableError } from 'bullmq';

import { NotificationError } from '../../../notify/public';
import type { ChatService } from '../services/chat.service';

import { ChatWorker } from './chat.worker';

const MESSAGE = { updateId: 1, userId: '10', chatId: '10', chatType: 'private', text: '/help' };

const dumeJob = (attemptsMade: number, name = 'dume-follow-up') =>
  ({
    id: 'job-1',
    name,
    attemptsMade,
    opts: { attempts: 3 },
    data: { chatId: '10', requestId: 'tg00001000', createdAtMs: 1, attempt: 1 },
  }) as never;

const abandoningWorker = () => {
  const abandon = jest.fn().mockResolvedValue(undefined);
  const worker = new ChatWorker(
    { handle: jest.fn() } as never,
    { handle: jest.fn() } as never,
    { handle: jest.fn(), abandon } as never,
    { purge: jest.fn() } as never,
    {} as never,
    {} as never,
  );
  return { abandon, worker };
};

const workerWith = (
  handle: jest.Mock,
  followUp: jest.Mock = jest.fn(),
  purge: jest.Mock = jest.fn(),
  dumeFollowUp: jest.Mock = jest.fn(),
) =>
  new ChatWorker(
    { handle } as unknown as ChatService,
    { handle: followUp } as never,
    { handle: dumeFollowUp } as never,
    { purge } as never,
    {} as never,
    {} as never,
  );

describe('ChatWorker', () => {
  it('hands a chat job to the chat service', async () => {
    const handle = jest.fn().mockResolvedValue('handled');
    await expect(workerWith(handle).process({ name: 'chat-message', data: MESSAGE })).resolves.toBe(
      'handled',
    );
    expect(handle).toHaveBeenCalledWith(MESSAGE);
  });

  it('purges old exchanges on the retention job', async () => {
    const purge = jest.fn().mockResolvedValue(4);
    await expect(
      workerWith(jest.fn(), jest.fn(), purge).process({ name: 'exchange-retention', data: {} }),
    ).resolves.toBe('deleted:4');
  });

  it('ignores unknown job types and malformed payloads', async () => {
    const handle = jest.fn();
    const worker = workerWith(handle);
    await expect(worker.process({ name: 'other', data: MESSAGE })).resolves.toBe('ignored');
    await expect(worker.process({ name: 'chat-message', data: { text: 1 } })).resolves.toBe(
      'ignored',
    );
    await expect(worker.process({ name: 'chat-message', data: null })).resolves.toBe('ignored');
    expect(handle).not.toHaveBeenCalled();
  });

  it('stops retrying when Telegram rejects the reply for good or delivery is unknown', async () => {
    for (const failure of [
      new NotificationError('bad html', false),
      new NotificationError('timeout', true, true),
    ]) {
      await expect(
        workerWith(jest.fn().mockRejectedValue(failure)).process({
          name: 'chat-message',
          data: MESSAGE,
        }),
      ).rejects.toBeInstanceOf(UnrecoverableError);
    }
  });

  it('lets BullMQ retry transient failures', async () => {
    const failure = new NotificationError('down', true);
    await expect(
      workerWith(jest.fn().mockRejectedValue(failure)).process({
        name: 'chat-message',
        data: MESSAGE,
      }),
    ).rejects.toBe(failure);
  });

  it('hands a Happy follow-up job to the follow-up service', async () => {
    const followUp = jest.fn().mockResolvedValue('wait');
    const data = { chatId: '10', pullNumber: 470, headSha: 'abc', attempt: 2 };
    await expect(
      workerWith(jest.fn(), followUp).process({ name: 'happy-follow-up', data }),
    ).resolves.toBe('wait');
    expect(followUp).toHaveBeenCalledWith(data);
    await expect(
      workerWith(jest.fn(), followUp).process({ name: 'happy-follow-up', data: { chatId: 1 } }),
    ).resolves.toBe('ignored');
  });

  it('hands a DUM-E follow-up job to its service and ignores a malformed one', async () => {
    const dumeFollowUp = jest.fn().mockResolvedValue('delivered');
    const worker = workerWith(jest.fn(), jest.fn(), jest.fn(), dumeFollowUp);
    const data = { chatId: '10', requestId: 'tg1000001', createdAtMs: 1, attempt: 1 };

    await expect(worker.process({ name: 'dume-follow-up', data })).resolves.toBe('delivered');
    await expect(worker.process({ name: 'dume-follow-up', data: { chatId: '10' } })).resolves.toBe(
      'ignored',
    );
    expect(dumeFollowUp).toHaveBeenCalledTimes(1);
  });

  it('keeps the count of unknown deliveries on a DUM-E follow-up and refuses a wrong one', async () => {
    const dumeFollowUp = jest.fn().mockResolvedValue('waiting');
    const worker = workerWith(jest.fn(), jest.fn(), jest.fn(), dumeFollowUp);
    const data = { chatId: '10', requestId: 'tg1000001', createdAtMs: 1, attempt: 2 };

    await worker.process({ name: 'dume-follow-up', data: { ...data, deliveryAttempts: 1 } });
    await expect(
      worker.process({ name: 'dume-follow-up', data: { ...data, deliveryAttempts: 'many' } }),
    ).resolves.toBe('ignored');

    expect(dumeFollowUp).toHaveBeenCalledWith({ ...data, deliveryAttempts: 1 });
    expect(dumeFollowUp).toHaveBeenCalledTimes(1);
  });

  describe('when a DUM-E follow-up fails', () => {
    it('tells the owner and frees the chat once it will not be retried again', () => {
      const { abandon, worker } = abandoningWorker();

      worker.onFailed(dumeJob(3), new Error('telegram down'));

      expect(abandon).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'tg00001000' }));
    });

    it('does the same at once for an error that is never retried', () => {
      const { abandon, worker } = abandoningWorker();

      worker.onFailed(dumeJob(1), new UnrecoverableError('bad html'));

      expect(abandon).toHaveBeenCalledTimes(1);
    });

    it('leaves the chat locked while retries remain', () => {
      const { abandon, worker } = abandoningWorker();

      worker.onFailed(dumeJob(1), new Error('telegram 502'));

      expect(abandon).not.toHaveBeenCalled();
    });

    it('does nothing for other jobs', () => {
      const { abandon, worker } = abandoningWorker();

      worker.onFailed(dumeJob(3, 'chat-message'), new Error('x'));
      worker.onFailed(undefined, new Error('x'));

      expect(abandon).not.toHaveBeenCalled();
    });
  });

  it('closes the explorer connection only after the worker has finished its jobs', async () => {
    const order: string[] = [];
    const worker = new ChatWorker(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { disconnect: () => order.push('redis') } as never,
      { close: async () => void order.push('explorer') } as never,
    );
    Object.assign(worker, { worker: { close: async () => void order.push('worker') } });

    await worker.onApplicationShutdown();

    expect(order).toEqual(['worker', 'explorer', 'redis']);
  });

  it('shuts down even when the explorer connection fails to close', async () => {
    const worker = new ChatWorker(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { disconnect: jest.fn() } as never,
      { close: async () => Promise.reject(new Error('broken')) } as never,
    );

    await expect(worker.onApplicationShutdown()).resolves.toBeUndefined();
  });
});
