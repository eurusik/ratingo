import { MAX_FINDINGS, MAX_QUESTIONS } from '../constants/review-limits.constants';
import { FindingKind } from '../constants/finding-classification.constants';
import { SEVERITY_ORDER } from '../constants/severity.constants';
import type {
  DroppedFinding,
  Finding,
  FindingValidation,
  ValidatedFinding,
} from '../entities/finding';
import { FindingDropReason } from '../entities/finding';

import type { DiffLines } from './diff-hunks';
import { evidenceHolds } from './evidence';
import { fingerprintFinding } from './finding-fingerprint';
import { findPrecedent } from './precedents';

export type DiffIndex = ReadonlyMap<string, DiffLines>;
export type EvidenceFiles = ReadonlyMap<string, string>;

export interface ValidationCaps {
  findings: number;
  questions: number;
}

const DEFAULT_CAPS: ValidationCaps = { findings: MAX_FINDINGS, questions: MAX_QUESTIONS };

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

const isProven = (finding: Finding, evidenceFiles: EvidenceFiles): boolean =>
  finding.evidence.path === finding.file &&
  evidenceHolds(finding.evidence, evidenceFiles.get(finding.evidence.path));

const settledKind = (finding: Finding, evidenceFiles: EvidenceFiles): FindingKind =>
  finding.kind === FindingKind.FINDING && isProven(finding, evidenceFiles)
    ? FindingKind.FINDING
    : FindingKind.QUESTION;

export const validateFindings = (
  findings: readonly Finding[],
  index: DiffIndex,
  evidenceFiles: EvidenceFiles,
  caps: ValidationCaps = DEFAULT_CAPS,
): FindingValidation => {
  const kept: ValidatedFinding[] = [];
  const questions: ValidatedFinding[] = [];
  const dropped: DroppedFinding[] = [];
  const seen = new Set<string>();
  for (const finding of [...findings].sort(byImportance)) {
    const reason = dropReasonFor(finding, index);
    const precedent = reason === null ? findPrecedent(finding) : null;
    const fingerprint = fingerprintFinding(finding);
    const kind = settledKind(finding, evidenceFiles);
    const bucket = kind === FindingKind.FINDING ? kept : questions;
    const cap = kind === FindingKind.FINDING ? caps.findings : caps.questions;
    if (reason !== null) {
      dropped.push({ finding, reason });
    } else if (precedent !== null) {
      dropped.push({ finding, reason: FindingDropReason.NOT_A_BUG, precedent });
    } else if (seen.has(fingerprint)) {
      dropped.push({ finding, reason: FindingDropReason.DUPLICATE });
    } else if (bucket.length >= cap) {
      dropped.push({ finding, reason: FindingDropReason.OVER_CAP });
    } else {
      seen.add(fingerprint);
      bucket.push({ ...finding, kind, fingerprint });
    }
  }
  return { kept, questions, dropped };
};
