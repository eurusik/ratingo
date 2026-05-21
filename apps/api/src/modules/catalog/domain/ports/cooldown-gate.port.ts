/**
 * Result when cooldown was successfully acquired.
 */
export interface CooldownAcquired {
  acquired: true;
}

/**
 * Result when cooldown is already active.
 */
export interface CooldownBlocked {
  acquired: false;
  expiresInSeconds: number;
}

export type CooldownResult = CooldownAcquired | CooldownBlocked;

/**
 * Port for acquiring time-based cooldown locks.
 * Implementations must guarantee atomicity of check-and-set.
 */
export interface ICooldownGate {
  /**
   * Attempts to acquire a cooldown lock for the given key.
   * Returns acquired=true if the lock was set (cooldown started).
   * Returns acquired=false with remaining TTL if already locked.
   */
  tryAcquire(key: string, ttlSeconds: number): Promise<CooldownResult>;
}

export const COOLDOWN_GATE_PORT = Symbol('COOLDOWN_GATE_PORT');
