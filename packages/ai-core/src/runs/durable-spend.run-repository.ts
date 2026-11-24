import type { ClockPort } from '../clock/clock.port';
import { describeError } from '../shared/describe-error';
import type { RunSnapshot } from './run';
import type { RunRepository, SpendQuery } from './run.repository';
import type { SpendLogger, SpendStore } from './spend-store.port';

const SPEND_TTL_SECONDS = 48 * 60 * 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_DAYS_READ = 3;
const MAX_REMEMBERED_RUNS = 1000;
const KEY_PREFIX = 'spend';

function utcDayIndex(ms: number): number {
  return Math.floor(ms / MS_PER_DAY);
}

function agentDayKey(agent: string, dayIndex: number): string {
  return `${KEY_PREFIX}:${agent}:day${dayIndex}`;
}

function taskDayKey(agent: string, task: string, dayIndex: number): string {
  return `${KEY_PREFIX}:${agent}:task:${task}:day${dayIndex}`;
}

export class DurableSpendRunRepository implements RunRepository {
  private readonly counted = new Map<string, number>();

  constructor(
    private readonly inner: RunRepository,
    private readonly store: SpendStore,
    private readonly clock: ClockPort,
    private readonly logger: SpendLogger,
  ) {}

  async save(run: RunSnapshot): Promise<void> {
    await this.inner.save(run);
    const unrecordedUsd = this.takeUnrecorded(run);
    if (unrecordedUsd > 0) {
      await this.record(run, unrecordedUsd);
    }
  }

  findRunning(agent: string): Promise<RunSnapshot[]> {
    return this.inner.findRunning(agent);
  }

  async spentUsd(query: SpendQuery): Promise<number> {
    try {
      const keys = this.daysSince(query.sinceMs).map((day) =>
        query.task === undefined
          ? agentDayKey(query.agent, day)
          : taskDayKey(query.agent, query.task, day),
      );
      const totals = await Promise.all(keys.map((key) => this.store.total(key)));
      return totals.reduce((sum, total) => sum + total, 0);
    } catch (error) {
      this.logger.warn(
        `Durable spend is unavailable, using this process only: ${describeError(error)}`,
      );
      return this.inner.spentUsd(query);
    }
  }

  private daysSince(sinceMs: number): number[] {
    const lastDay = utcDayIndex(this.clock.nowMs());
    const firstDay = Math.min(
      lastDay,
      Math.max(utcDayIndex(sinceMs), lastDay - (MAX_DAYS_READ - 1)),
    );
    return Array.from({ length: lastDay - firstDay + 1 }, (_, offset) => firstDay + offset);
  }

  private takeUnrecorded(run: RunSnapshot): number {
    const unrecordedUsd = run.costUsd - (this.counted.get(run.id) ?? 0);
    if (unrecordedUsd <= 0) {
      return 0;
    }
    this.counted.delete(run.id);
    this.counted.set(run.id, run.costUsd);
    if (this.counted.size > MAX_REMEMBERED_RUNS) {
      const oldest = this.counted.keys().next().value;
      if (oldest !== undefined) {
        this.counted.delete(oldest);
      }
    }
    return unrecordedUsd;
  }

  private async record(run: RunSnapshot, usd: number): Promise<void> {
    const day = utcDayIndex(this.clock.nowMs());
    const keys = [agentDayKey(run.agent, day)];
    if (run.task !== undefined) {
      keys.push(taskDayKey(run.agent, run.task, day));
    }
    try {
      await Promise.all(keys.map((key) => this.store.add(key, usd, SPEND_TTL_SECONDS)));
    } catch (error) {
      this.logger.warn(`Run spend was not stored durably: ${describeError(error)}`);
    }
  }
}
