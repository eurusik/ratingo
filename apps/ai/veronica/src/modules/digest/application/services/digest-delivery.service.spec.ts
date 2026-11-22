import { FixedClock, RunTrigger } from '@ratingo/ai-core';

import type { NotifierPort } from '../../../notify/public';
import { NOW_MS } from '../../domain/digest.testing';
import type {
  DigestDelivery,
  DigestDeliveryRepository,
} from '../../domain/ports/digest-delivery.repository';

import type { DigestComposeService } from './digest-compose.service';
import { DeliveryStatus, DigestDeliveryService } from './digest-delivery.service';

class MemoryDeliveries implements DigestDeliveryRepository {
  readonly sent = new Map<string, DigestDelivery>();
  async wasSent(date: string) {
    return this.sent.has(date);
  }
  async markSent(delivery: DigestDelivery) {
    this.sent.set(delivery.date, delivery);
  }
}

const build = (notifier: NotifierPort, deliveries = new MemoryDeliveries()) => {
  const composer = {
    compose: jest.fn(async () => ({
      digest: {} as never,
      runId: 'run-1',
      message: { html: '<b>x</b>', silent: true },
    })),
  } as unknown as DigestComposeService;
  return {
    deliveries,
    composer,
    service: new DigestDeliveryService(composer, new FixedClock(NOW_MS), deliveries, notifier),
  };
};

describe('DigestDeliveryService', () => {
  it('sends once and records the delivery for the Kyiv date', async () => {
    const notifier = { send: jest.fn().mockResolvedValue(undefined) };
    const { service, deliveries } = build(notifier);
    await expect(service.deliver(RunTrigger.SCHEDULE)).resolves.toBe(DeliveryStatus.SENT);
    expect(notifier.send).toHaveBeenCalledWith({ html: '<b>x</b>', silent: true });
    expect(deliveries.sent.get('2026-11-22')).toMatchObject({ silent: true, runId: 'run-1' });
  });

  it('never sends twice for the same date', async () => {
    const notifier = { send: jest.fn().mockResolvedValue(undefined) };
    const { service, composer } = build(notifier);
    await service.deliver(RunTrigger.SCHEDULE);
    await expect(service.deliver(RunTrigger.SCHEDULE)).resolves.toBe(DeliveryStatus.ALREADY_SENT);
    expect(notifier.send).toHaveBeenCalledTimes(1);
    expect(composer.compose).toHaveBeenCalledTimes(1);
  });

  it('does not mark the date as sent when Telegram fails, so the retry can send', async () => {
    const notifier = {
      send: jest.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue(undefined),
    };
    const { service, deliveries } = build(notifier);
    await expect(service.deliver(RunTrigger.SCHEDULE)).rejects.toThrow('down');
    expect(deliveries.sent.size).toBe(0);
    await expect(service.deliver(RunTrigger.SCHEDULE)).resolves.toBe(DeliveryStatus.SENT);
  });
});
