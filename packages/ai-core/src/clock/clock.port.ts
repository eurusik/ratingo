export interface ClockPort {
  nowMs(): number;
}

export const CLOCK_PORT = Symbol('CLOCK_PORT');
