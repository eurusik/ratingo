import type { AnalyticsEventName, AnalyticsEvents } from './events';

type GtagParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const MAX_TEXT_LENGTH = 100;

function gtag(): ((...args: unknown[]) => void) | null {
  if (typeof window === 'undefined') return null;
  return typeof window.gtag === 'function' ? window.gtag : null;
}

function normalize(params: GtagParams): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'boolean') result[key] = value ? 'true' : 'false';
    else if (typeof value === 'string') result[key] = value.slice(0, MAX_TEXT_LENGTH);
    else result[key] = value;
  }
  return result;
}

export function track<E extends AnalyticsEventName>(name: E, params: AnalyticsEvents[E]): void {
  const send = gtag();
  if (!send) return;
  try {
    send('event', name, normalize(params as GtagParams));
  } catch {
    return;
  }
}

export function identifyUser(userId: string | null): void {
  const send = gtag();
  if (!send) return;
  try {
    send('set', { user_id: userId });
    send('set', 'user_properties', { logged_in: userId ? 'true' : 'false' });
  } catch {
    return;
  }
}
