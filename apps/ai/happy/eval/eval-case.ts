import {
  FileStatus,
  type ChangedFile,
  type RepoRuleFile,
} from '../src/modules/review/domain/entities/pull-request';

export const EvalKind = {
  POSITIVE: 'positive',
  PROTECTED_NEGATIVE: 'protected_negative',
  UNKNOWN: 'unknown',
} as const;
export type EvalKind = (typeof EvalKind)[keyof typeof EvalKind];

interface EvalExpectation {
  defectId: string;
  markerLine: string;
}

interface ChangedMarkers {
  from: string;
  to?: string;
}

export interface EvalSiblingFile {
  path: string;
  status: typeof FileStatus.ADDED | typeof FileStatus.MODIFIED;
  lines: readonly string[];
  additions?: number;
  deletions?: number;
}

export interface EvalCase {
  id: string;
  kind: EvalKind;
  title: string;
  path: string;
  lines: readonly string[];
  changed?: ChangedMarkers;
  extraFiles?: Readonly<Record<string, readonly string[]>>;
  siblingFiles?: readonly EvalSiblingFile[];
  coreFiles?: readonly string[];
  expectation?: EvalExpectation;
  checkId?: string;
  source?: string;
}

const PATCH_CONTEXT_LINES = 3;

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

export interface LineRange {
  start: number;
  end: number;
}

export const changedRange = (testCase: EvalCase): LineRange | null => {
  const markers = testCase.changed;
  if (markers === undefined) return null;
  const startIndex = testCase.lines.findIndex((line) => line.includes(markers.from));
  if (startIndex === -1) return null;
  const to = markers.to ?? markers.from;
  const endOffset = testCase.lines.slice(startIndex).findIndex((line) => line.includes(to));
  return endOffset === -1 ? null : { start: startIndex + 1, end: startIndex + endOffset + 1 };
};

export const baseLinesOf = (testCase: EvalCase): readonly string[] | null => {
  if (testCase.changed === undefined) return null;
  const range = changedRange(testCase);
  return range === null
    ? null
    : testCase.lines.filter((_, index) => index + 1 < range.start || index + 1 > range.end);
};

export const changedLinesOf = (testCase: EvalCase): readonly string[] => {
  const range = changedRange(testCase);
  return range === null ? testCase.lines : testCase.lines.slice(range.start - 1, range.end);
};

export const renderPatch = (testCase: EvalCase): string => {
  const range = changedRange(testCase);
  if (range === null) {
    return [
      `@@ -0,0 +1,${testCase.lines.length} @@`,
      ...testCase.lines.map((line) => `+${line}`),
    ].join('\n');
  }
  const contextStart = Math.max(1, range.start - PATCH_CONTEXT_LINES);
  const contextEnd = Math.min(testCase.lines.length, range.end + PATCH_CONTEXT_LINES);
  const before = testCase.lines.slice(contextStart - 1, range.start - 1);
  const added = testCase.lines.slice(range.start - 1, range.end);
  const after = testCase.lines.slice(range.end, contextEnd);
  const baseCount = before.length + after.length;
  return [
    `@@ -${baseCount === 0 ? 0 : contextStart},${baseCount} +${contextStart},${baseCount + added.length} @@`,
    ...before.map((line) => ` ${line}`),
    ...added.map((line) => `+${line}`),
    ...after.map((line) => ` ${line}`),
  ].join('\n');
};

const renderWholeFilePatch = (lines: readonly string[]): string =>
  [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join('\n');

export const siblingChangedFiles = (testCase: EvalCase): ChangedFile[] =>
  (testCase.siblingFiles ?? []).map((sibling) => ({
    path: sibling.path,
    status: sibling.status,
    additions: sibling.additions ?? sibling.lines.length,
    deletions: sibling.deletions ?? 0,
    patch: renderWholeFilePatch(sibling.lines),
  }));
