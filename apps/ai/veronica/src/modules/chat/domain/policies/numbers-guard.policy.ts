const NUMBER_TOKEN =
  /(?<![\p{L}_\d])(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?(?!\d)|\d[\d.,]*\d|\d)(?![xXхХ]{2})/gu;
const SPACES = /[ \u00a0\u202f]/g;
const LIST_MARKER = /^\s*(?:[-*•]\s+)?\d{1,2}[.)]\s+/;
const SENTENCE_BREAK = /(?<=[.!?…])\s+/;
const THOUSANDS_GROUP_DIGITS = 3;

const THOUSANDS_GROUP_MAX_LEADING = 3;
const COMPACT_DATE = /(?<!\d)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/g;
const MONTHS_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];
const DATE_MENTION = new RegExp(
  `(?<![\\p{L}\\d.,])(\\d{1,2})(?:\\s+(${MONTHS_GENITIVE.join('|')})|\\.(\\d{1,2}))(?:[\\s.]+(20\\d{2}))?(?![\\d.,]\\d)`,
  'giu',
);

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

export const knownNumbers = (sources: readonly string[]): ReadonlySet<string> =>
  new Set(sources.flatMap((source) => extractNumbers(source).flat()));

const dayMonthKey = (day: number, month: number): string => `${day}.${month}`;
const fullDateKey = (day: number, month: number, year: number): string => `${day}.${month}.${year}`;

export const knownDates = (sources: readonly string[]): ReadonlySet<string> =>
  new Set(
    sources.flatMap((source) =>
      [...source.matchAll(COMPACT_DATE)].flatMap((match) => {
        const [day, month, year] = [Number(match[3]), Number(match[2]), Number(match[1])];
        return [dayMonthKey(day, month), fullDateKey(day, month, year)];
      }),
    ),
  );

const monthOf = (name: string | undefined, number: string | undefined): number =>
  name === undefined ? Number(number) : MONTHS_GENITIVE.indexOf(name.toLowerCase()) + 1;

interface DateMention {
  text: string;
  day: number;
  month: number;
  monthName?: string;
  year?: number;
}

const maskedDate = (mention: DateMention, dates: ReadonlySet<string>): string => {
  const words = mention.monthName ?? '';
  if (
    mention.year !== undefined &&
    dates.has(fullDateKey(mention.day, mention.month, mention.year))
  ) {
    return words;
  }
  if (!dates.has(dayMonthKey(mention.day, mention.month))) {
    return mention.text;
  }
  return mention.year === undefined ? words : `${words} ${mention.year}`;
};

const withoutKnownDates = (answer: string, dates: ReadonlySet<string>): string =>
  answer.replace(
    DATE_MENTION,
    (
      text,
      day: string,
      monthName: string | undefined,
      monthNumber: string | undefined,
      year: string | undefined,
    ) =>
      maskedDate(
        {
          text,
          day: Number(day),
          month: monthOf(monthName, monthNumber),
          monthName,
          year: year === undefined ? undefined : Number(year),
        },
        dates,
      ),
  );

const NO_DATES: ReadonlySet<string> = new Set();

const isVerified = (candidates: readonly string[], known: ReadonlySet<string>): boolean =>
  candidates.some((candidate) => known.has(candidate));

export const unverifiedNumbers = (
  answer: string,
  known: ReadonlySet<string>,
  dates: ReadonlySet<string> = NO_DATES,
): string[] =>
  extractNumbers(withoutKnownDates(answer, dates))
    .filter((candidates) => !isVerified(candidates, known))
    .map((candidates) => candidates[0] ?? '');

export interface RedactionResult {
  text: string;
  removedSentences: number;
}

export const redactUnverified = (
  answer: string,
  known: ReadonlySet<string>,
  dates: ReadonlySet<string> = NO_DATES,
): RedactionResult => {
  let removedSentences = 0;
  const lines = answer.split('\n').map((line) => {
    const kept = line.split(SENTENCE_BREAK).filter((sentence) => {
      const clean = unverifiedNumbers(sentence, known, dates).length === 0;
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
