/**
 * Centralized development timing utility.
 * Single place to enable/disable all performance logging.
 *
 * Usage:
 *   const t = DevTiming.start('authRefresh', { userId });
 *   t.mark('after_verify');
 *   await doSomething();
 *   t.mark('after_db');
 *   t.end(); // logs if enabled
 *
 * To disable all timing logs: set TIMING_ENABLED=false or change ENABLED constant.
 */

import { Logger } from '@nestjs/common';

// Master switch — set to false to disable all timing logs
const ENABLED = process.env.TIMING_ENABLED !== 'false';

// Event loop lag threshold (ms)
const LAG_THRESHOLD_MS = 100;

const logger = new Logger('DevTiming');

/**
 * Timing session for a single operation.
 */
class TimingSession {
  private readonly marks: Array<{ name: string; time: number }> = [];
  private readonly t0 = Date.now();

  constructor(
    private readonly operation: string,
    private readonly context: Record<string, unknown> = {},
  ) {}

  mark(name: string): this {
    if (ENABLED) {
      this.marks.push({ name, time: Date.now() });
    }
    return this;
  }

  end(): void {
    if (!ENABLED) return;

    const parts: string[] = [];
    let prev = this.t0;

    for (const { name, time } of this.marks) {
      parts.push(`${name}=${time - prev}ms`);
      prev = time;
    }

    parts.push(`total=${Date.now() - this.t0}ms`);

    const contextStr = Object.entries(this.context)
      .map(([k, v]) => `${k}=${v ?? 'null'}`)
      .join(' ');

    logger.log(`[TIMING] ${this.operation} ${contextStr} ${parts.join(' ')}`);
  }

  elapsed(): number {
    return Date.now() - this.t0;
  }
}

/**
 * Interface for timing session (public API).
 */
interface ITimingSession {
  mark(name: string): ITimingSession;
  end(): void;
  elapsed(): number;
}

/**
 * No-op session when timing is disabled.
 */
const NOOP_SESSION: ITimingSession = {
  mark() {
    return NOOP_SESSION;
  },
  end() {},
  elapsed() {
    return 0;
  },
};

/**
 * DevTiming — centralized timing utility.
 */
export const DevTiming = {
  /**
   * Whether timing is enabled.
   */
  enabled: ENABLED,

  /**
   * Starts a timing session for an operation.
   */
  start(operation: string, context: Record<string, unknown> = {}): ITimingSession {
    return ENABLED ? new TimingSession(operation, context) : NOOP_SESSION;
  },

  /**
   * Starts event loop lag monitoring.
   * Call once in main.ts after app starts.
   */
  startEventLoopMonitor(): void {
    if (!ENABLED) return;

    let lastTick = Date.now();
    setInterval(() => {
      const now = Date.now();
      const lag = now - lastTick - 1000;
      lastTick = now;

      if (lag > LAG_THRESHOLD_MS) {
        logger.warn(`[EVENT_LOOP_LAG] ${lag}ms`);
      }
    }, 1000).unref();

    logger.log('Event loop lag monitor started');
  },
};
