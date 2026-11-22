import { MIN_EVIDENCE_SIGNIFICANT_CHARS } from '../constants/review-limits.constants';
import type { FindingEvidence } from '../entities/finding';

const WHITESPACE = /\s+/g;
const ANY_WHITESPACE = /\s/g;

const collapse = (text: string): string => text.replace(WHITESPACE, ' ').trim();

export const evidenceHolds = (evidence: FindingEvidence, content: string | undefined): boolean => {
  if (content === undefined) return false;
  const actualLine = content.split('\n')[evidence.line - 1];
  if (actualLine === undefined) return false;
  const actual = collapse(actualLine);
  const excerpt = collapse(evidence.excerpt);
  if (excerpt.length === 0) return false;
  const significant = excerpt.replace(ANY_WHITESPACE, '').length;
  return significant >= MIN_EVIDENCE_SIGNIFICANT_CHARS
    ? actual.includes(excerpt)
    : actual === excerpt;
};
