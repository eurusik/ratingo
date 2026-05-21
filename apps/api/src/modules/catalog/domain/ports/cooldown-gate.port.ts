/**
 * Result when cooldown was successfully acquired.
 * The token must be passed to release() to prevent releasing another acquirer's lock.
 */
export interface CooldownAcquired {
  acquired: true;
  token: string;
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
   * Returns acquired=true with an opaque token if the lock was set.
   * Returns acquired=false with remaining TTL if already locked.
   */
  tryAcquire(key: string, ttlSeconds: number): Promise<CooldownResult>;

  /**
   * Releases a previously acquired cooldown lock using a fencing token.
   * The token ensures only the original acquirer can release the lock,
   * preventing accidental release of a lock held by a concurrent request.
   * Implementations must handle missing keys and token mismatches gracefully (no-op).
   */
  release(key: string, token: string): Promise<void>;
}

export const COOLDOWN_GATE_PORT = Symbol('COOLDOWN_GATE_PORT');
