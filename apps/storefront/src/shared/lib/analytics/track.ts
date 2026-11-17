import type { AnalyticsEventName, AnalyticsEvents } from './events';

type GtagParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
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

function clarity(): ((...args: unknown[]) => void) | null {
  if (typeof window === 'undefined') return null;
  return typeof window.clarity === 'function' ? window.clarity : null;
}

function attempt(send: (() => void) | null): void {
  if (!send) return;
  try {
    send();
  } catch {
    return;
  }
}

function setClarityTags(tags: Record<string, string>): void {
  const call = clarity();
  if (!call) return;
  for (const [key, value] of Object.entries(tags)) {
    attempt(() => call('set', key, value));
  }
}

export function track<E extends AnalyticsEventName>(name: E, params: AnalyticsEvents[E]): void {
  const sendGtag = gtag();
  attempt(sendGtag && (() => sendGtag('event', name, normalize(params as GtagParams))));
  const sendClarity = clarity();
  if (name !== 'web_vitals') attempt(sendClarity && (() => sendClarity('event', name)));
}

export function setUserProperties(properties: Record<string, string>): void {
  const sendGtag = gtag();
  attempt(sendGtag && (() => sendGtag('set', 'user_properties', properties)));
  setClarityTags(properties);
}

export function identifyUser(userId: string | null): void {
  const loggedIn = userId ? 'true' : 'false';
  const sendGtag = gtag();
  attempt(
    sendGtag &&
      (() => {
        sendGtag('set', { user_id: userId });
        sendGtag('set', 'user_properties', { logged_in: loggedIn });
      }),
  );
  setClarityTags({ logged_in: loggedIn });
}

export function identifyClarityUser(userId: string): void {
  const call = clarity();
  attempt(call && (() => call('identify', userId)));
}
