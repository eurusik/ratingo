export const REDACTED = '[REDACTED]';

const MAX_REDACTION_DEPTH = 6;

const MAX_ARRAY_ITEMS = 50;

const SENSITIVE_KEY_PARTS = [
  'authorization',
  'cookie',
  'password',
  'passwd',
  'secret',
  'apikey',
  'credential',
  'privatekey',
  'sessionid',
  'email',
  'signature',
  'dsn',
];

const SECRET_TOKEN_KEY = /token(?!s)/;

const VALUE_RULES: readonly RegExp[] = [
  /\bsk-ant-[A-Za-z0-9_-]{10,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bglc_[A-Za-z0-9+/=_-]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi,
  /\b[A-Za-z0-9_]{0,40}?(?:api[_-]?key|token|secret|password|passwd)["']?\s*[:=]\s*["']?[^\s"',;&]{4,}/gi,
  /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}/g,
];

const URL_CREDENTIALS = /\b([A-Za-z][A-Za-z0-9+.-]{1,20}:\/\/)[^\s/:@]{1,128}:[^\s/@]{1,256}@/g;

const normalizeKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

export function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return (
    SECRET_TOKEN_KEY.test(normalized) ||
    SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
  );
}

export function redactText(text: string): string {
  return VALUE_RULES.reduce(
    (redacted, rule) => redacted.replace(rule, REDACTED),
    text.replace(URL_CREDENTIALS, `$1${REDACTED}@`),
  );
}

const isPlainObject = (value: object): value is Record<string, unknown> => {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export function redactValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') {
    return redactText(value);
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth >= MAX_REDACTION_DEPTH || seen.has(value)) {
    return REDACTED;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactValue(item, depth + 1, seen));
  }
  if (value instanceof Error) {
    return redactText(value.message);
  }
  if (!isPlainObject(value)) {
    return redactText(String(value));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? REDACTED : redactValue(entry, depth + 1, seen),
    ]),
  );
}
