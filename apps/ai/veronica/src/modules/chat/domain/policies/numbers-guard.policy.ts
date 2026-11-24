const NUMBER_TOKEN =
  /(?<![\p{L}_\d])(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?(?!\d)|\d[\d.,]*\d|\d)(?![xXхХ]{2})/gu;
const SPACES = /[ \u00a0\u202f]/g;
const LIST_MARKER = /^\s*(?:[-*•]\s+)?\d{1,2}[.)]\s+/;
const SENTENCE_BREAK = /(?<=[.!?…])\s+/;
const THOUSANDS_GROUP_DIGITS = 3;

const THOUSANDS_GROUP_MAX_LEADING = 3;
const COMPACT_DATE = /^(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/;

const canonical = (text: string): string | null => {
  const parsed = Number(text);
  return Number.isFinite(parsed) ? String(parsed) : null;
};

const plausibleThousands = (groups: readonly string[]): boolean =>
  groups[0].length <= THOUSANDS_GROUP_MAX_LEADING &&
  !groups[0].startsWith('0') &&
  groups.slice(1).every((group) => group.length === THOUSANDS_GROUP_DIGITS);

const mixedSeparators = (compact: string): string => {
  const decimal = compact.lastIndexOf('.') > compact.lastIndexOf(',') ? '.' : ',';
  const thousands = decimal === '.' ? ',' : '.';
  return compact.split(thousands).join('').replace(decimal, '.');
};

const interpretations = (token: string): string[] => {
  const compact = token.replace(SPACES, '');
  const hasDot = compact.includes('.');
  const hasComma = compact.includes(',');
  const candidates: (string | null)[] = [];
  if (hasDot && hasComma) {
    candidates.push(canonical(mixedSeparators(compact)));
  } else if (hasDot || hasComma) {
    const groups = compact.split(hasDot ? '.' : ',');
    if (plausibleThousands(groups)) candidates.push(canonical(groups.join('')));
    if (groups.length === 2) candidates.push(canonical(`${groups[0]}.${groups[1]}`));
    if (candidates.length === 0) candidates.push(canonical(groups.join('')));
  } else {
    candidates.push(canonical(compact));
  }
  return [...new Set(candidates.filter((candidate): candidate is string => candidate !== null))];
};

const withoutListMarkers = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.replace(LIST_MARKER, ''))
    .join('\n');

export const extractNumbers = (text: string): string[][] =>
  [...withoutListMarkers(text).matchAll(NUMBER_TOKEN)].map((match) => interpretations(match[0]));

export const compactDateParts = (candidate: string): string[] => {
  const match = COMPACT_DATE.exec(candidate);
  return match === null ? [] : match.slice(1).map((part) => String(Number(part)));
};

export const knownNumbers = (sources: readonly string[]): ReadonlySet<string> =>
  new Set(
    sources
      .flatMap((source) => extractNumbers(source).flat())
      .flatMap((candidate) => [candidate, ...compactDateParts(candidate)]),
  );

const isVerified = (candidates: readonly string[], known: ReadonlySet<string>): boolean =>
  candidates.some((candidate) => known.has(candidate));

export const unverifiedNumbers = (answer: string, known: ReadonlySet<string>): string[] =>
  extractNumbers(answer)
    .filter((candidates) => !isVerified(candidates, known))
    .map((candidates) => candidates[0] ?? '');

export interface RedactionResult {
  text: string;
  removedSentences: number;
}

export const redactUnverified = (answer: string, known: ReadonlySet<string>): RedactionResult => {
  let removedSentences = 0;
  const lines = answer.split('\n').map((line) => {
    const kept = line.split(SENTENCE_BREAK).filter((sentence) => {
      const clean = unverifiedNumbers(sentence, known).length === 0;
      if (!clean) removedSentences += 1;
      return clean;
    });
    return kept.join(' ');
  });
  const text = lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, removedSentences };
};
