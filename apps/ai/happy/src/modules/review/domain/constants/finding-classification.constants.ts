export const FindingTopic = {
  LOGIC: 'logic',
  DATA_INTEGRITY: 'data_integrity',
  AUTHORIZATION: 'authorization',
  INJECTION: 'injection',
  XSS: 'xss',
  ENV_CONFIG: 'env_config',
  DOS_RATE_LIMIT: 'dos_rate_limit',
  ARCHITECTURE_RULE: 'architecture_rule',
  PERFORMANCE: 'performance',
  TESTING: 'testing',
  OTHER: 'other',
} as const;
export type FindingTopic = (typeof FindingTopic)[keyof typeof FindingTopic];

export const FINDING_TOPICS = Object.values(FindingTopic) as [FindingTopic, ...FindingTopic[]];

export const FindingKind = {
  FINDING: 'finding',
  QUESTION: 'question',
} as const;
export type FindingKind = (typeof FindingKind)[keyof typeof FindingKind];

export const FINDING_KINDS = Object.values(FindingKind) as [FindingKind, ...FindingKind[]];
