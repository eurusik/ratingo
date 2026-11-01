export interface RunLock {
  withLock<T>(fn: () => Promise<T>): Promise<T | null>;
}

export const KEY_HEALTH_RUN_LOCK = Symbol('KEY_HEALTH_RUN_LOCK');
