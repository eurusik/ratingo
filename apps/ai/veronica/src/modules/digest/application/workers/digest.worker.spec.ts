import { UnrecoverableError } from 'bullmq';

import { NotificationError } from '../../../notify/public';

import { DigestWorker } from './digest.worker';
import type { DigestDeliveryService } from '../services/digest-delivery.service';

const workerWith = (deliver: jest.Mock) =>
  new DigestWorker({ deliver } as unknown as DigestDeliveryService, {} as never);

describe('DigestWorker', () => {
  it('ignores unknown job types', async () => {
    const deliver = jest.fn();
    await expect(workerWith(deliver).process({ name: 'other' })).resolves.toBe('ignored');
    expect(deliver).not.toHaveBeenCalled();
  });

  it('stops retrying when Telegram rejects the message for good', async () => {
    const worker = workerWith(
      jest.fn().mockRejectedValue(new NotificationError('bad html', false)),
    );
    await expect(worker.process({ name: 'daily-digest' })).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('lets BullMQ retry transient failures', async () => {
    const failure = new NotificationError('down', true);
    const worker = workerWith(jest.fn().mockRejectedValue(failure));
    await expect(worker.process({ name: 'daily-digest' })).rejects.toBe(failure);
  });
});
