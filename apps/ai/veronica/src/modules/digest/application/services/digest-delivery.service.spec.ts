import { FixedClock, RunTrigger } from '@ratingo/ai-core';

import { NotificationError, type NotifierPort } from '../../../notify/public';
import { CLAIM_STALE_MS } from '../../digest.constants';
import type {
  DigestDelivery,
  DigestDeliveryRepository,
} from '../../domain/ports/digest-delivery.repository';
import { NOW_MS } from '../../testing/digest.testing';

import type { DigestComposeService } from './digest-compose.service';
import { DeliveryStatus, DigestDeliveryService } from './digest-delivery.service';

type Status = 'claimed' | 'sending' | 'sent';

class MemoryDeliveries implements DigestDeliveryRepository {
  readonly rows = new Map<string, { status: Status; claimedAtMs: number }>();
  readonly sent = new Map<string, DigestDelivery>();

  async claim(date: string, nowMs: number, staleAfterMs: number) {
    const row = this.rows.get(date);
    if (
      row !== undefined &&
      !(row.status === 'claimed' && nowMs - row.claimedAtMs >= staleAfterMs)
    ) {
      return false;
    }
    this.rows.set(date, { status: 'claimed', claimedAtMs: nowMs });
    return true;
  }

  async markSending(date: string) {
    this.rows.set(date, { claimedAtMs: this.rows.get(date)?.claimedAtMs ?? 0, status: 'sending' });
  }

  async markSent(delivery: DigestDelivery) {
    this.rows.set(delivery.date, {
      claimedAtMs: this.rows.get(delivery.date)?.claimedAtMs ?? 0,
      status: 'sent',
    });
    this.sent.set(delivery.date, delivery);
  }

  async release(date: string) {
    if (this.rows.get(date)?.status !== 'sent') {
      this.rows.delete(date);
    }
  }
}

const build = (notifier: NotifierPort, deliveries = new MemoryDeliveries()) => {
  const clock = new FixedClock(NOW_MS);
  const composer = {
    compose: jest.fn(async () => ({
      digest: {} as never,
      runId: 'run-1',
      message: { html: '<b>x</b>', silent: true },
    })),
  } as unknown as DigestComposeService;
  return {
    clock,
    deliveries,
    composer,
    service: new DigestDeliveryService(composer, clock, deliveries, notifier),
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

  it('sends once when two jobs run at the same time', async () => {
    const notifier = { send: jest.fn().mockResolvedValue(undefined) };
    const { service } = build(notifier);
    const results = await Promise.all([
      service.deliver(RunTrigger.SCHEDULE),
      service.deliver(RunTrigger.SCHEDULE),
    ]);
    expect(results.sort()).toEqual([DeliveryStatus.ALREADY_SENT, DeliveryStatus.SENT]);
    expect(notifier.send).toHaveBeenCalledTimes(1);
  });

  it('releases the claim when Telegram clearly rejected the message, so the retry can send', async () => {
    const notifier = {
      send: jest
        .fn()
        .mockRejectedValueOnce(new NotificationError('rejected', true, false))
        .mockResolvedValue(undefined),
    };
    const { service, deliveries } = build(notifier);
    await expect(service.deliver(RunTrigger.SCHEDULE)).rejects.toThrow('rejected');
    expect(deliveries.rows.size).toBe(0);
    await expect(service.deliver(RunTrigger.SCHEDULE)).resolves.toBe(DeliveryStatus.SENT);
  });

  it('releases the claim when composing fails before anything was sent', async () => {
    const notifier = { send: jest.fn().mockResolvedValue(undefined) };
    const { service, composer, deliveries } = build(notifier);
    (composer.compose as jest.Mock).mockRejectedValueOnce(new Error('boom'));
    await expect(service.deliver(RunTrigger.SCHEDULE)).rejects.toThrow('boom');
    expect(deliveries.rows.size).toBe(0);
  });

  it('keeps the claim when delivery is unknown, even after the stale window', async () => {
    const notifier = {
      send: jest.fn().mockRejectedValue(new NotificationError('timeout', true, true)),
    };
    const { service, clock } = build(notifier);
    await expect(service.deliver(RunTrigger.SCHEDULE)).rejects.toThrow('timeout');
    clock.advance(CLAIM_STALE_MS * 4);
    await expect(service.deliver(RunTrigger.SCHEDULE)).resolves.toBe(DeliveryStatus.ALREADY_SENT);
    expect(notifier.send).toHaveBeenCalledTimes(1);
  });

  it('never resends after Telegram accepted the message but recording failed', async () => {
    const notifier = { send: jest.fn().mockResolvedValue(undefined) };
    const deliveries = new MemoryDeliveries();
    deliveries.markSent = jest.fn().mockRejectedValue(new Error('db blip'));
    const { service, clock } = build(notifier, deliveries);
    await expect(service.deliver(RunTrigger.SCHEDULE)).rejects.toThrow('db blip');
    clock.advance(CLAIM_STALE_MS * 4);
    await expect(service.deliver(RunTrigger.SCHEDULE)).resolves.toBe(DeliveryStatus.ALREADY_SENT);
    expect(notifier.send).toHaveBeenCalledTimes(1);
  });

  it('retakes a claim left by a job that died before sending anything', async () => {
    const notifier = { send: jest.fn().mockResolvedValue(undefined) };
    const { service, deliveries, clock } = build(notifier);
    deliveries.rows.set('2026-11-22', { status: 'claimed', claimedAtMs: NOW_MS - CLAIM_STALE_MS });
    expect(clock.nowMs()).toBe(NOW_MS);
    await expect(service.deliver(RunTrigger.SCHEDULE)).resolves.toBe(DeliveryStatus.SENT);
  });
});
