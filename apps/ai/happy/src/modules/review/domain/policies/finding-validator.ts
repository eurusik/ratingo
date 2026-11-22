import {
  MAX_FINDINGS,
  MAX_QUESTIONS,
  MIN_GATE_TEXT_CHARS,
} from '../constants/review-limits.constants';
import { FindingKind } from '../constants/finding-classification.constants';
import { SEVERITY_ORDER, type Severity } from '../constants/severity.constants';
import type { Check } from '../entities/check';
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

interface ValidationCaps {
  findings: number;
  questions: number;
}

export interface ValidationOptions {
  caps?: ValidationCaps;
  selectedChecks?: readonly Pick<Check, 'id' | 'severityCap'>[];
}

const DEFAULT_CAPS: ValidationCaps = { findings: MAX_FINDINGS, questions: MAX_QUESTIONS };

const severityRank = (finding: Finding): number => SEVERITY_ORDER.indexOf(finding.severity);

const byImportance = (left: Finding, right: Finding): number =>
  severityRank(left) - severityRank(right) ||
  left.file.localeCompare(right.file) ||
  left.line - right.line;

const dropReasonFor = (
  finding: Finding,
  index: DiffIndex,
  checks: ReadonlyMap<string, Pick<Check, 'id' | 'severityCap'>>,
): FindingDropReason | null => {
  if (finding.message.trim().length === 0) return FindingDropReason.EMPTY_MESSAGE;
  if (finding.checkId !== null && !checks.has(finding.checkId)) {
    return FindingDropReason.UNSELECTED_CHECK;
  }
  const lines = index.get(finding.file);
  if (lines === undefined) return FindingDropReason.FILE_NOT_IN_DIFF;
  return lines.commentable.has(finding.line) ? null : FindingDropReason.LINE_NOT_IN_DIFF;
};

const capSeverity = (
  finding: Finding,
  checks: ReadonlyMap<string, Pick<Check, 'severityCap'>>,
): Severity => {
  const cap = finding.checkId === null ? undefined : checks.get(finding.checkId)?.severityCap;
  return cap !== undefined && SEVERITY_ORDER.indexOf(finding.severity) < SEVERITY_ORDER.indexOf(cap)
    ? cap
    : finding.severity;
};

const hasGateText = (finding: Finding): boolean =>
  finding.failureScenario.trim().length >= MIN_GATE_TEXT_CHARS &&
  finding.impact.trim().length >= MIN_GATE_TEXT_CHARS;

const isProven = (finding: Finding, index: DiffIndex, evidenceFiles: EvidenceFiles): boolean =>
  finding.evidence.path === finding.file &&
  index.get(finding.file)?.commentable.has(finding.evidence.line) === true &&
  evidenceHolds(finding.evidence, evidenceFiles.get(finding.evidence.path));

const settledKind = (
  finding: Finding,
  index: DiffIndex,
  evidenceFiles: EvidenceFiles,
): FindingKind =>
  finding.kind === FindingKind.FINDING &&
  hasGateText(finding) &&
  isProven(finding, index, evidenceFiles)
    ? FindingKind.FINDING
    : FindingKind.QUESTION;

export const validateFindings = (
  findings: readonly Finding[],
  index: DiffIndex,
  evidenceFiles: EvidenceFiles,
  options: ValidationOptions = {},
): FindingValidation => {
  const caps = options.caps ?? DEFAULT_CAPS;
  const checks = new Map((options.selectedChecks ?? []).map((check) => [check.id, check]));
  const kept: ValidatedFinding[] = [];
  const questions: ValidatedFinding[] = [];
  const dropped: DroppedFinding[] = [];
  const seen = new Set<string>();
  for (const finding of [...findings].sort(byImportance)) {
    const reason = dropReasonFor(finding, index, checks);
    const precedent = reason === null ? findPrecedent(finding) : null;
    const fingerprint = fingerprintFinding(finding);
    const kind = settledKind(finding, index, evidenceFiles);
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
      bucket.push({
        ...finding,
        kind,
        severity: capSeverity(finding, checks),
        fingerprint,
      });
    }
  }
  return { kept, questions, dropped };
};
