import { MAX_FINDINGS } from '../constants/review-limits.constants';
import { SEVERITY_ORDER } from '../constants/severity.constants';
import type {
  DroppedFinding,
  Finding,
  FindingValidation,
  ValidatedFinding,
} from '../entities/finding';
import { FindingDropReason } from '../entities/finding';

import type { DiffLines } from './diff-hunks';
import { fingerprintFinding } from './finding-fingerprint';

export type DiffIndex = ReadonlyMap<string, DiffLines>;

const severityRank = (finding: Finding): number => SEVERITY_ORDER.indexOf(finding.severity);

const byImportance = (left: Finding, right: Finding): number =>
  severityRank(left) - severityRank(right) ||
  left.file.localeCompare(right.file) ||
  left.line - right.line;

const dropReasonFor = (finding: Finding, index: DiffIndex): FindingDropReason | null => {
  if (finding.message.trim().length === 0) return FindingDropReason.EMPTY_MESSAGE;
  const lines = index.get(finding.file);
  if (lines === undefined) return FindingDropReason.FILE_NOT_IN_DIFF;
  return lines.commentable.has(finding.line) ? null : FindingDropReason.LINE_NOT_IN_DIFF;
};

export const validateFindings = (
  findings: readonly Finding[],
  index: DiffIndex,
  cap: number = MAX_FINDINGS,
): FindingValidation => {
  const kept: ValidatedFinding[] = [];
  const dropped: DroppedFinding[] = [];
  const seen = new Set<string>();
  for (const finding of [...findings].sort(byImportance)) {
    const reason = dropReasonFor(finding, index);
    const fingerprint = fingerprintFinding(finding);
    if (reason !== null) {
      dropped.push({ finding, reason });
    } else if (seen.has(fingerprint)) {
      dropped.push({ finding, reason: FindingDropReason.DUPLICATE });
    } else if (kept.length >= cap) {
      dropped.push({ finding, reason: FindingDropReason.OVER_CAP });
    } else {
      seen.add(fingerprint);
      kept.push({ ...finding, fingerprint });
    }
  }
  return { kept, dropped };
};
