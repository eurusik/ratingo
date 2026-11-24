import { MIN_EVIDENCE_SIGNIFICANT_CHARS } from '../constants/review-limits.constants';
import type { FindingEvidence } from '../entities/finding';

const WHITESPACE = /\s+/g;
const ANY_WHITESPACE = /\s/g;

const collapse = (text: string): string => text.replace(WHITESPACE, ' ').trim();

const lineMatches = (actualLine: string, rawExcerpt: string): boolean => {
  const actual = collapse(actualLine);
  const excerpt = collapse(rawExcerpt);
  if (excerpt.length === 0) return false;
  const significant = excerpt.replace(ANY_WHITESPACE, '').length;
  return significant >= MIN_EVIDENCE_SIGNIFICANT_CHARS
    ? actual.includes(excerpt)
    : actual === excerpt;
};

export const evidenceHolds = (evidence: FindingEvidence, content: string | undefined): boolean => {
  if (content === undefined) return false;
  const actualLine = content.split('\n')[evidence.line - 1];
  return actualLine !== undefined && lineMatches(actualLine, evidence.excerpt);
};

export const locateEvidence = (
  content: string,
  excerpt: string,
  nearLine: number,
): number | null => {
  const matches = content
    .split('\n')
    .flatMap((line, index) => (lineMatches(line, excerpt) ? [index + 1] : []));
  if (matches.length === 0) return null;
  return matches.reduce((best, line) =>
    Math.abs(line - nearLine) < Math.abs(best - nearLine) ? line : best,
  );
};
