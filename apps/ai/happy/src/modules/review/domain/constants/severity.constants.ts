export const Severity = {
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor',
  NIT: 'nit',
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const SEVERITY_ORDER: readonly Severity[] = [
  Severity.CRITICAL,
  Severity.MAJOR,
  Severity.MINOR,
  Severity.NIT,
];

export const FindingCategory = {
  CORRECTNESS: 'correctness',
  SECURITY: 'security',
  ARCHITECTURE: 'architecture',
  PERFORMANCE: 'performance',
  TESTS: 'tests',
  MAINTAINABILITY: 'maintainability',
  RULES: 'rules',
} as const;
export type FindingCategory = (typeof FindingCategory)[keyof typeof FindingCategory];

export const FINDING_CATEGORIES = Object.values(FindingCategory) as [
  FindingCategory,
  ...FindingCategory[],
];
export const FINDING_SEVERITIES = Object.values(Severity) as [Severity, ...Severity[]];
