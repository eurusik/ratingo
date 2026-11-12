import type { AuthIntent } from './auth-opener';

const STORAGE_KEY = 'ratingo:pending-auth-intent:v1';
const MAX_AGE_MS = 15 * 60 * 1000;

interface StoredIntent {
  intent: AuthIntent;
  savedAt: number;
}

function isAuthIntent(value: unknown): value is AuthIntent {
  if (typeof value !== 'object' || value === null) return false;
  const intent = value as Record<string, unknown>;
  return (
    intent.kind === 'save' &&
    typeof intent.title === 'string' &&
    typeof intent.mediaItemId === 'string' &&
    intent.mediaItemId.length > 0
  );
}

function isStoredIntent(value: unknown): value is StoredIntent {
  if (typeof value !== 'object' || value === null) return false;
  const stored = value as Record<string, unknown>;
  return typeof stored.savedAt === 'number' && isAuthIntent(stored.intent);
}

export function serializePendingIntent(intent: AuthIntent, now: number): string {
  return JSON.stringify({ intent, savedAt: now } satisfies StoredIntent);
}

export function parsePendingIntent(raw: string | null, now: number): AuthIntent | null {
  if (!raw) return null;
  try {
    const stored: unknown = JSON.parse(raw);
    if (!isStoredIntent(stored)) return null;
    const age = now - stored.savedAt;
    return age >= 0 && age <= MAX_AGE_MS ? stored.intent : null;
  } catch {
    return null;
  }
}

function sessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberPendingIntent(intent: AuthIntent, now = Date.now()): void {
  try {
    sessionStore()?.setItem(STORAGE_KEY, serializePendingIntent(intent, now));
  } catch (error) {
    console.warn('Could not keep the sign-in intent across the redirect', { error });
  }
}

export function forgetPendingIntent(): void {
  try {
    sessionStore()?.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Could not clear the sign-in intent', { error });
  }
}

export function hasPendingIntent(): boolean {
  try {
    return sessionStore()?.getItem(STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

export function takePendingIntent(now = Date.now()): AuthIntent | null {
  const intent = parsePendingIntent(sessionStore()?.getItem(STORAGE_KEY) ?? null, now);
  forgetPendingIntent();
  return intent;
}
