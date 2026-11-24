import { FixedClock } from '@ratingo/ai-core';

import { AlertKey, RECOVERY_TEXT } from '../../domain/constants/watchdog-rules.constants';
import { HappyProbe } from '../../domain/entities/happy-probe';
import type { WatchdogStatePort } from '../../domain/ports/watchdog.ports';

import { WatchdogService } from './watchdog.service';

const MORNING_AFTER_DEADLINE = Date.parse('2026-12-10T08:00:00Z');

class MemoryState implements WatchdogStatePort {
  active: AlertKey[] = [];
  happyFailures = 0;
  async loadActive() {
    return [...this.active];
  }
  async saveActive(keys: readonly AlertKey[]) {
    this.active = [...keys];
  }
  async loadHappyFailures() {
    return this.happyFailures;
  }
  async saveHappyFailures(failures: number) {
    this.happyFailures = failures;
  }
}

class Harness {
  readonly state = new MemoryState();
  readonly sent: string[] = [];
  readonly beats: number[] = [];
  readonly clock = new FixedClock(MORNING_AFTER_DEADLINE);
  probe: HappyProbe = HappyProbe.UP;
  digestSent = true;
  spent = { agent: 0, chat: 0 };
  failedRuns = 0;
  digestFailure: Error | null = null;
  notifyFailure: Error | null = null;

  readonly service = new WatchdogService(
    { probe: async () => this.probe },
    {
      isSentOn: async () => {
        if (this.digestFailure !== null) throw this.digestFailure;
        return this.digestSent;
      },
    },
    { countFailedSince: async () => this.failedRuns },
    this.state,
    { beat: (nowMs: number) => void this.beats.push(nowMs) },
    {
      send: async ({ html }: { html: string }) => {
        if (this.notifyFailure !== null) throw this.notifyFailure;
        this.sent.push(html);
      },
    },
    {
      save: async () => undefined,
      findRunning: async () => [],
      spentUsd: async ({ task }: { task?: string }) =>
        task === undefined ? this.spent.agent : this.spent.chat,
    },
    { manifest: { name: 'veronica', budgets: { perDayUsd: 0.5 } } } as never,
    this.clock,
  );
}

describe('WatchdogService', () => {
  it('stays silent and beats when everything is fine', async () => {
    const h = new Harness();
    await h.service.tick();
    expect(h.sent).toEqual([]);
    expect(h.beats).toEqual([MORNING_AFTER_DEADLINE]);
  });

  it('alerts about Happy only on the second failed check, once, then reports recovery', async () => {
    const h = new Harness();
    h.probe = HappyProbe.DOWN;
    await h.service.tick();
    expect(h.sent).toEqual([]);
    await h.service.tick();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toContain('Хеппі не відповідає 10 хв');
    await h.service.tick();
    expect(h.sent).toHaveLength(1);
    h.probe = HappyProbe.UP;
    await h.service.tick();
    expect(h.sent[1]).toBe(RECOVERY_TEXT[AlertKey.HAPPY_DOWN]);
    await h.service.tick();
    expect(h.sent).toHaveLength(2);
  });

  it('skips Happy when its URL is not configured', async () => {
    const h = new Harness();
    h.probe = HappyProbe.SKIPPED;
    await h.service.tick();
    await h.service.tick();
    expect(h.sent).toEqual([]);
  });

  it('alerts when the digest is missing after 09:30 Kyiv and recovers when it arrives', async () => {
    const h = new Harness();
    h.digestSent = false;
    await h.service.tick();
    expect(h.sent[0]).toContain('Ранкового звіту досі немає');
    h.digestSent = true;
    await h.service.tick();
    expect(h.sent[1]).toBe(RECOVERY_TEXT[AlertKey.DIGEST_MISSING]);
  });

  it('does not alert about the digest before 09:30 Kyiv', async () => {
    const h = new Harness();
    h.digestSent = false;
    h.clock.advance(-60 * 60 * 1000);
    await h.service.tick();
    expect(h.sent).toEqual([]);
  });

  it('alerts separately for the agent budget and the chat budget at 80%', async () => {
    const h = new Harness();
    h.spent = { agent: 0.4, chat: 0.24 };
    await h.service.tick();
    expect(h.sent).toHaveLength(2);
    expect(h.sent.some((text) => text.includes('Вероніка витратила 80%'))).toBe(true);
    expect(h.sent.some((text) => text.includes('Чат Вероніки витратив 80%'))).toBe(true);
  });

  it('alerts on three failed runs in the last hour', async () => {
    const h = new Harness();
    h.failedRuns = 3;
    await h.service.tick();
    expect(h.sent[0]).toContain('3 невдалих запусків');
  });

  it('keeps a standing alert when its check cannot run, and still beats', async () => {
    const h = new Harness();
    h.digestSent = false;
    await h.service.tick();
    h.digestFailure = new Error('db down');
    await h.service.tick();
    expect(h.sent).toHaveLength(1);
    expect(h.state.active).toContain(AlertKey.DIGEST_MISSING);
    expect(h.beats).toHaveLength(2);
  });

  it('does not save state when Telegram fails, so the alert is retried next tick', async () => {
    const h = new Harness();
    h.failedRuns = 5;
    h.notifyFailure = new Error('telegram down');
    await expect(h.service.tick()).rejects.toThrow('telegram down');
    expect(h.state.active).toEqual([]);
    h.notifyFailure = null;
    await h.service.tick();
    expect(h.sent).toHaveLength(1);
  });
});
