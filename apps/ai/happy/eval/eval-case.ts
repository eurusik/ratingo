import type { RepoRuleFile } from '../src/modules/review/domain/entities/pull-request';

export const EvalKind = {
  POSITIVE: 'positive',
  PROTECTED_NEGATIVE: 'protected_negative',
  UNKNOWN: 'unknown',
} as const;
export type EvalKind = (typeof EvalKind)[keyof typeof EvalKind];

interface EvalExpectation {
  defectId: string;
  markerLine: string;
  ruleCardId?: string;
}

export interface EvalCase {
  id: string;
  kind: EvalKind;
  title: string;
  path: string;
  lines: readonly string[];
  expectation?: EvalExpectation;
}

export const EVAL_RULES: readonly RepoRuleFile[] = [
  {
    path: 'CLAUDE.md',
    content: [
      '# Rules',
      '- Keep the domain layer pure: use the injected clock, constants instead of process.env.',
      '- Wrap every repository database call with withDbError().',
      '- New indexes on existing tables use CREATE INDEX CONCURRENTLY or a squawk-ignore directive; keep IF NOT EXISTS.',
      '- Import across modules only through module/public barrels.',
      "- Don't write comments in code.",
    ].join('\n'),
  },
];

export const expectedLine = (testCase: EvalCase): number | null => {
  const marker = testCase.expectation?.markerLine;
  if (marker === undefined) return null;
  const index = testCase.lines.findIndex((line) => line.includes(marker));
  return index === -1 ? null : index + 1;
};

export const renderPatch = (lines: readonly string[]): string =>
  [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join('\n');
