import { UnrecoverableError } from 'bullmq';

import { NotificationError } from '../../../notify/public';
import type { ChatService } from '../services/chat.service';

import { ChatWorker } from './chat.worker';

const MESSAGE = { updateId: 1, userId: '10', chatId: '10', chatType: 'private', text: '/help' };

const workerWith = (handle: jest.Mock, followUp: jest.Mock = jest.fn()) =>
  new ChatWorker({ handle } as unknown as ChatService, { handle: followUp } as never, {} as never);

describe('ChatWorker', () => {
  it('hands a chat job to the chat service', async () => {
    const handle = jest.fn().mockResolvedValue('handled');
    await expect(workerWith(handle).process({ name: 'chat-message', data: MESSAGE })).resolves.toBe(
      'handled',
    );
    expect(handle).toHaveBeenCalledWith(MESSAGE);
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
});
