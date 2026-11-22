import { CHAT_JOB_OPTIONS, CHAT_JOB_TYPES } from '../../chat.constants';
import type { IncomingMessage } from '../../domain/entities/incoming-message';

import { BullmqChatJobQueue } from './bullmq-chat-job-queue';

const message = (updateId: number): IncomingMessage => ({
  updateId,
  userId: '10',
  chatId: '10',
  chatType: 'private',
  text: '/help',
});

class DedupingQueue {
  readonly jobs = new Map<string, { name: string; data: unknown; opts: Record<string, unknown> }>();
  readonly close = jest.fn().mockResolvedValue(undefined);

  async add(name: string, data: unknown, opts: Record<string, unknown>) {
    const id = String(opts.jobId);
    if (!this.jobs.has(id)) this.jobs.set(id, { name, data, opts });
    return {} as never;
  }
}

describe('BullmqChatJobQueue', () => {
  it('enqueues a chat job with retention and a job id from the update id', async () => {
    const queue = new DedupingQueue();
    await new BullmqChatJobQueue(queue as never).enqueue(message(501));
    expect([...queue.jobs.keys()]).toEqual(['telegram-501']);
    const job = queue.jobs.get('telegram-501');
    expect(job?.name).toBe(CHAT_JOB_TYPES.MESSAGE);
    expect(job?.data).toEqual(message(501));
    expect(job?.opts).toMatchObject({
      attempts: CHAT_JOB_OPTIONS.attempts,
      removeOnComplete: CHAT_JOB_OPTIONS.removeOnComplete,
      removeOnFail: CHAT_JOB_OPTIONS.removeOnFail,
    });
  });

  it('never uses a bare integer as the job id, which BullMQ rejects', async () => {
    const queue = new DedupingQueue();
    await new BullmqChatJobQueue(queue as never).enqueue(message(7));
    const [id] = [...queue.jobs.keys()];
    expect(String(parseInt(id, 10))).not.toBe(id);
  });

  it('collapses a Telegram retry of the same update into one job', async () => {
    const queue = new DedupingQueue();
    const adapter = new BullmqChatJobQueue(queue as never);
    await adapter.enqueue(message(501));
    await adapter.enqueue(message(501));
    await adapter.enqueue(message(502));
    expect(queue.jobs.size).toBe(2);
  });

  it('closes the queue on shutdown', async () => {
    const queue = new DedupingQueue();
    await new BullmqChatJobQueue(queue as never).onApplicationShutdown();
    expect(queue.close).toHaveBeenCalled();
  });
});
