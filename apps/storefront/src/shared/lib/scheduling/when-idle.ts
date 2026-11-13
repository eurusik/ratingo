const IDLE_TIMEOUT_MS = 2000;
const FALLBACK_DELAY_MS = 1200;
const SLOW_CONNECTIONS = new Set(['slow-2g', '2g']);

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

const doNothing = () => {};

export function isOnLightConnection(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return Boolean(connection?.saveData) || SLOW_CONNECTIONS.has(connection?.effectiveType ?? '');
}

export function whenIdle(task: () => void): () => void {
  if (typeof window === 'undefined') return doNothing;
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(task, FALLBACK_DELAY_MS);
  return () => window.clearTimeout(handle);
}

export function whenIdleOnFastConnection(task: () => void): (() => void) | undefined {
  if (isOnLightConnection()) return undefined;
  return whenIdle(task);
}

const ignoreFailedPreload = () => undefined;

export function preloadWhenIdle(load: () => Promise<unknown>): (() => void) | undefined {
  return whenIdleOnFastConnection(() => {
    void load().catch(ignoreFailedPreload);
  });
}
