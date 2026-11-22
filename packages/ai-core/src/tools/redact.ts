export const REDACTION_PLACEHOLDER = '[REDACTED]';

interface RedactionRule {
  name: string;
  pattern: RegExp;
}

const REDACTION_RULES: readonly RedactionRule[] = [
  { name: 'anthropic-key', pattern: /\bsk-ant-[A-Za-z0-9_-]{10,}/g },
  { name: 'github-token', pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/g },
  { name: 'github-fine-grained-token', pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/g },
  { name: 'slack-token', pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'telegram-bot-token', pattern: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g },
  { name: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { name: 'bearer-header', pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi },
  {
    name: 'credential-assignment',
    pattern:
      /\b[A-Za-z0-9_]{0,40}?(?:api[_-]?key|token|secret|password|passwd)["']?\s*[:=]\s*["']?[^\s"',;]{4,}/gi,
  },
  {
    name: 'email-address',
    pattern: /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}/g,
  },
];

export function redactSecrets(text: string): string {
  return REDACTION_RULES.reduce(
    (redacted, rule) => redacted.replace(rule.pattern, REDACTION_PLACEHOLDER),
    text,
  );
}
