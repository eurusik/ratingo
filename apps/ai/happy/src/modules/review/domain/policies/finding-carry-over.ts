import type { ChangedFile } from '../entities/pull-request';
import { RECHECK_LINE_WINDOW } from '../constants/review-limits.constants';
import {
  FindingStatus,
  type RecheckAnswer,
  type TrackedFinding,
} from '../entities/tracked-finding';
import { RecheckVerdict } from '../entities/tracked-finding';

import { parseDiffLines } from './diff-hunks';
import { locateEvidence } from './evidence';

export type HeadFiles = ReadonlyMap<string, string | null>;
type TouchedLines = ReadonlyMap<string, ReadonlySet<number>>;

export interface TouchedFiles {
  lines: TouchedLines;
  opaque: ReadonlySet<string>;
}

export interface CarryOverContext {
  precise: boolean;
  touched: TouchedFiles;
  headFiles: HeadFiles;
}

export const touchedFrom = (
  files: readonly Pick<ChangedFile, 'path' | 'patch'>[],
): TouchedFiles => ({
  lines: new Map(
    files.flatMap((file): [string, ReadonlySet<number>][] =>
      file.patch === null ? [] : [[file.path, parseDiffLines(file.patch).added]],
    ),
  ),
  opaque: new Set(files.filter((file) => file.patch === null).map((file) => file.path)),
});

const near = (lines: ReadonlySet<number>, center: number): boolean => {
  for (let offset = -RECHECK_LINE_WINDOW; offset <= RECHECK_LINE_WINDOW; offset += 1) {
    if (lines.has(center + offset)) return true;
  }
  return false;
};

const withStatus = (
  finding: TrackedFinding,
  status: FindingStatus,
  line = finding.line,
): TrackedFinding => ({ ...finding, status, line });

const classifyPrecisely = (finding: TrackedFinding, context: CarryOverContext): TrackedFinding => {
  const content = context.headFiles.get(finding.file);
  const touchedLines = context.touched.lines.get(finding.file);
  const opaque = context.touched.opaque.has(finding.file);
  const touched = touchedLines !== undefined || opaque;
  if (content === undefined) return withStatus(finding, FindingStatus.NEEDS_RECHECK);
  const located = content === null ? null : locateEvidence(content, finding.excerpt, finding.line);
  if (located === null) {
    return touched || content === null
      ? withStatus(finding, FindingStatus.RESOLVED)
      : withStatus(finding, FindingStatus.NEEDS_RECHECK);
  }
  return opaque || (touchedLines !== undefined && near(touchedLines, located))
    ? withStatus(finding, FindingStatus.NEEDS_RECHECK, located)
    : withStatus(finding, FindingStatus.STILL_OPEN, located);
};

export const classifyPrevious = (
  previous: readonly TrackedFinding[],
  context: CarryOverContext,
): TrackedFinding[] =>
  previous
    .filter((finding) => finding.status !== FindingStatus.RESOLVED)
    .map((finding) =>
      context.precise
        ? classifyPrecisely(finding, context)
        : withStatus(finding, FindingStatus.NEEDS_RECHECK),
    );

const STATUS_BY_VERDICT = {
  [RecheckVerdict.RESOLVED]: FindingStatus.RESOLVED,
  [RecheckVerdict.STILL_OPEN]: FindingStatus.STILL_OPEN,
} as const;

export const applyRecheck = (
  carried: readonly TrackedFinding[],
  answers: readonly RecheckAnswer[],
): TrackedFinding[] => {
  const verdicts = new Map(answers.map((answer) => [answer.fingerprint, answer.verdict]));
  return carried.map((finding) => {
    const verdict = verdicts.get(finding.fingerprint);
    return finding.status === FindingStatus.NEEDS_RECHECK && verdict !== undefined
      ? withStatus(finding, STATUS_BY_VERDICT[verdict])
      : finding;
  });
};
