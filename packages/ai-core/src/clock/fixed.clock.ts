import type { ClockPort } from './clock.port';

export class FixedClock implements ClockPort {
  constructor(private currentMs: number = 0) {}

  nowMs(): number {
    return this.currentMs;
  }

  advance(ms: number): void {
    this.currentMs += ms;
  }
}
