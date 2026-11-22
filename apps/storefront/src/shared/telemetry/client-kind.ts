import {
  AI_CRAWLER_USER_AGENT_MARKERS,
  BOT_USER_AGENT_MARKERS,
  CLIENT_KIND,
  type ClientKind,
  GENERIC_BOT_USER_AGENT_PATTERN,
  USER_AGENT_MAX_LENGTH,
} from './constants';

const CLIENT_KINDS: ReadonlySet<string> = new Set(Object.values(CLIENT_KIND));

export const isClientKind = (value: unknown): value is ClientKind =>
  typeof value === 'string' && CLIENT_KINDS.has(value);

const includesAny = (userAgent: string, markers: readonly string[]): boolean =>
  markers.some((marker) => userAgent.includes(marker));

export function classifyClientKind(userAgent: string | undefined): ClientKind {
  if (!userAgent) {
    return CLIENT_KIND.HUMAN;
  }
  const normalized = userAgent.slice(0, USER_AGENT_MAX_LENGTH).toLowerCase();
  if (includesAny(normalized, AI_CRAWLER_USER_AGENT_MARKERS)) {
    return CLIENT_KIND.AI_CRAWLER;
  }
  if (
    includesAny(normalized, BOT_USER_AGENT_MARKERS) ||
    GENERIC_BOT_USER_AGENT_PATTERN.test(normalized)
  ) {
    return CLIENT_KIND.BOT;
  }
  return CLIENT_KIND.HUMAN;
}
