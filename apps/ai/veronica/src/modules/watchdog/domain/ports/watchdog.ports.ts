import type { AlertKey } from '../constants/watchdog-rules.constants';
import type { HappyProbe } from '../entities/happy-probe';

export interface HappyHealthPort {
  probe(): Promise<HappyProbe>;
}
export const HAPPY_HEALTH_PORT = Symbol('HAPPY_HEALTH_PORT');

export interface DigestDeliveryProbePort {
  isSentOn(date: string): Promise<boolean>;
}
export const DIGEST_DELIVERY_PROBE_PORT = Symbol('DIGEST_DELIVERY_PROBE_PORT');

export interface FailedRunsPort {
  countFailedSince(agent: string, sinceMs: number): Promise<number>;
}
export const FAILED_RUNS_PORT = Symbol('FAILED_RUNS_PORT');

export interface WatchdogStatePort {
  loadActive(): Promise<AlertKey[]>;
  saveActive(keys: readonly AlertKey[]): Promise<void>;
  loadHappyFailures(): Promise<number>;
  saveHappyFailures(failures: number): Promise<void>;
}
export const WATCHDOG_STATE_PORT = Symbol('WATCHDOG_STATE_PORT');

export interface WatchdogHeartbeatPort {
  beat(nowMs: number): void;
}
export const WATCHDOG_HEARTBEAT_PORT = Symbol('WATCHDOG_HEARTBEAT_PORT');

export const RepairOutcome = {
  HEALTHY: 'healthy',
  REPAIRED: 'repaired',
} as const;
export type RepairOutcome = (typeof RepairOutcome)[keyof typeof RepairOutcome];

export interface QueueKeyRepairPort {
  repairActiveJobsList(): Promise<{ outcome: RepairOutcome; foundType: string }>;
}
export const QUEUE_KEY_REPAIR_PORT = Symbol('QUEUE_KEY_REPAIR_PORT');
