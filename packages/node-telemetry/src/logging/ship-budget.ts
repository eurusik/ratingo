import type { LogLevel } from './log-level';

const MS_PER_MINUTE = 60_000;

const MS_PER_DAY = 86_400_000;

const NON_ERROR_DAILY_SHARE = 0.8;

const ERROR_RATE_MULTIPLIER = 2;

export type BudgetVerdict = 'ok' | 'rate_limit' | 'daily_cap';

export interface ShipBudgetLimits {
  readonly maxRecordsPerMinute: number;
  readonly maxBytesPerDay: number;
}

export class ShipBudget {
  private minute = -1;
  private recordsThisMinute = 0;
  private day = -1;
  private bytesToday = 0;

  constructor(private readonly limits: ShipBudgetLimits) {}

  admit(level: LogLevel, bytes: number, nowMs: number): BudgetVerdict {
    this.rollWindows(nowMs);
    const isError = level === 'error';
    const dailyLimit = this.limits.maxBytesPerDay * (isError ? 1 : NON_ERROR_DAILY_SHARE);
    if (this.bytesToday + bytes > dailyLimit) {
      return 'daily_cap';
    }
    const rateLimit = this.limits.maxRecordsPerMinute * (isError ? ERROR_RATE_MULTIPLIER : 1);
    if (this.recordsThisMinute >= rateLimit) {
      return 'rate_limit';
    }
    this.recordsThisMinute += 1;
    this.bytesToday += bytes;
    return 'ok';
  }

  private rollWindows(nowMs: number): void {
    const minute = Math.floor(nowMs / MS_PER_MINUTE);
    if (minute !== this.minute) {
      this.minute = minute;
      this.recordsThisMinute = 0;
    }
    const day = Math.floor(nowMs / MS_PER_DAY);
    if (day !== this.day) {
      this.day = day;
      this.bytesToday = 0;
    }
  }
}
