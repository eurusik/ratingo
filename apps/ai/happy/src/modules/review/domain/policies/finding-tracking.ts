import { FindingKind } from '../constants/finding-classification.constants';
import {
  MAX_TRACKED_EXCERPT_CHARS,
  MAX_TRACKED_FINDINGS,
  MAX_TRACKED_MESSAGE_CHARS,
} from '../constants/review-limits.constants';
import { SEVERITY_ORDER } from '../constants/severity.constants';
import type { ValidatedFinding } from '../entities/finding';
import { FindingStatus, type StatusCounts, type TrackedFinding } from '../entities/tracked-finding';

import { sanitizeModelText } from './output-sanitizer';

const WHITESPACE = /\s+/g;

const normalize = (text: string): string => text.toLowerCase().replace(WHITESPACE, ' ').trim();

const clip = (text: string, limit: number): string => text.slice(0, limit);

export const toTracked = (finding: ValidatedFinding, status: FindingStatus): TrackedFinding => ({
  fingerprint: finding.fingerprint,
  file: finding.file,
  line: finding.line,
  severity: finding.severity,
  category: finding.category,
  kind: finding.kind,
  message: clip(sanitizeModelText(finding.message), MAX_TRACKED_MESSAGE_CHARS),
  excerpt: clip(finding.evidence.excerpt, MAX_TRACKED_EXCERPT_CHARS),
  status,
});

const sameFinding = (carried: TrackedFinding, fresh: ValidatedFinding): boolean =>
  carried.fingerprint === fresh.fingerprint ||
  (carried.file === fresh.file &&
    carried.category === fresh.category &&
    normalize(carried.excerpt) ===
      normalize(clip(fresh.evidence.excerpt, MAX_TRACKED_EXCERPT_CHARS)));

const reaffirmed = (finding: TrackedFinding): TrackedFinding =>
  finding.status === FindingStatus.NEEDS_RECHECK
    ? { ...finding, status: FindingStatus.STILL_OPEN }
    : finding;

const severityRank = (finding: TrackedFinding): number => SEVERITY_ORDER.indexOf(finding.severity);

const byRelevance = (left: TrackedFinding, right: TrackedFinding): number =>
  Number(right.status !== FindingStatus.RESOLVED) -
    Number(left.status !== FindingStatus.RESOLVED) ||
  severityRank(left) - severityRank(right) ||
  left.file.localeCompare(right.file) ||
  left.line - right.line;

export const mergeTracked = (
  carried: readonly TrackedFinding[],
  fresh: readonly ValidatedFinding[],
): TrackedFinding[] => {
  const open = carried.filter((finding) => finding.status !== FindingStatus.RESOLVED);
  const revisited = carried.map((finding) =>
    open.includes(finding) && fresh.some((candidate) => sameFinding(finding, candidate))
      ? reaffirmed(finding)
      : finding,
  );
  const added = fresh
    .filter((candidate) => !open.some((finding) => sameFinding(finding, candidate)))
    .map((candidate) => toTracked(candidate, FindingStatus.NEW));
  return [...revisited, ...added].sort(byRelevance).slice(0, MAX_TRACKED_FINDINGS);
};

export const countStatuses = (tracked: readonly TrackedFinding[]): StatusCounts => {
  const count = (status: FindingStatus): number =>
    tracked.filter((finding) => finding.status === status).length;
  return {
    new: count(FindingStatus.NEW),
    stillOpen: count(FindingStatus.STILL_OPEN),
    resolved: count(FindingStatus.RESOLVED),
    needsRecheck: count(FindingStatus.NEEDS_RECHECK),
  };
};

const openTracked = (tracked: readonly TrackedFinding[]): TrackedFinding[] =>
  tracked.filter((finding) => finding.status !== FindingStatus.RESOLVED);

export const openFindings = (tracked: readonly TrackedFinding[]): TrackedFinding[] =>
  openTracked(tracked).filter((finding) => finding.kind === FindingKind.FINDING);

export const openQuestions = (tracked: readonly TrackedFinding[]): TrackedFinding[] =>
  openTracked(tracked).filter((finding) => finding.kind === FindingKind.QUESTION);
