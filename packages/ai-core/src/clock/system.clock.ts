import type { ClockPort } from './clock.port';

export class SystemClock implements ClockPort {
  nowMs(): number {
    return Date.now();
  }
}
