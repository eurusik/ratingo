import { setTimeout as sleep } from 'node:timers/promises';

import type { Clock, Sleeper } from '../domain';

export const systemClock: Clock = {
  now: () => new Date(),
};

export const timerSleeper: Sleeper = {
  sleep: async (ms) => {
    await sleep(ms);
  },
};
