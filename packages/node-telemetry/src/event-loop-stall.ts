import { MS_PER_SECOND, NS_PER_SECOND } from './units';

export const EVENT_LOOP_RESOLUTION_MS = 20;

const RESOLUTION_SECONDS = EVENT_LOOP_RESOLUTION_MS / MS_PER_SECOND;

export const toStallSeconds = (delayNs: number): number =>
  Math.max(0, delayNs / NS_PER_SECOND - RESOLUTION_SECONDS);
