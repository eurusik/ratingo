import { isRoundingOfKnown, knownDecimals, type WrittenNumber } from './rounded-numbers.policy';

const NUMBER_TOKEN =
  /(?<![\p{L}_\d])(?:\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?(?!\d)|\d[\d.,]*\d|\d)(?![xXхХ]{2})/gu;
const SPACES = /[ \u00a0\u202f]/g;
const LIST_MARKER = /^\s*(?:[-*•]\s+)?\d{1,2}[.)]\s+/;
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
const MONTH_PART = `(?:\\s+(${MONTHS_GENITIVE.join('|')})|\\.(\\d{1,2}))`;
const YEAR_PART = '(?:[\\s.]+(20\\d{2}))?';
const DATE_END = '(?![\\d.,]\\d)';
const RANGE_MENTION = new RegExp(
  `(?<![\\p{L}\\d.,])(?:(?:з|від)\\s+)?(\\d{1,2})\\s*(?:[–—-]|\\s(?:по|до)\\s)\\s*(\\d{1,2})${MONTH_PART}${YEAR_PART}${DATE_END}`,
  'giu',
);
const DATE_MENTION = new RegExp(
  `(?<![\\p{L}\\d.,])(\\d{1,2})${MONTH_PART}${YEAR_PART}${DATE_END}`,
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

const PERCENT_AFTER = /^\s?(?:%|відсот)/iu;

const writtenNumbers = (text: string): WrittenNumber[] => {
  const prepared = withoutListMarkers(text);
  return [...prepared.matchAll(NUMBER_TOKEN)].map((match) => ({
    candidates: interpretations(match[0]),
    percent: PERCENT_AFTER.test(prepared.slice((match.index ?? 0) + match[0].length)),
  }));
};

export const knownNumbers = (sources: readonly string[]): ReadonlySet<string> =>
  new Set(sources.flatMap((source) => extractNumbers(source).flat()));

const dayMonthKey = (day: number, month: number): string => `${day}.${month}`;
const fullDateKey = (day: number, month: number, year: number): string => `${day}.${month}.${year}`;

export const dateKeysOf = (day: number, month: number, year: number): string[] => [
  dayMonthKey(day, month),
  fullDateKey(day, month, year),
];

export const knownDates = (sources: readonly string[]): ReadonlySet<string> =>
  new Set(
    sources.flatMap((source) =>
      [...source.matchAll(COMPACT_DATE)].flatMap((match) =>
        dateKeysOf(Number(match[3]), Number(match[2]), Number(match[1])),
      ),
    ),
  );

const monthOf = (name: string | undefined, number: string | undefined): number =>
  name === undefined ? Number(number) : MONTHS_GENITIVE.indexOf(name.toLowerCase()) + 1;

interface DateMention {
  text: string;
  days: readonly number[];
  month: number;
  monthName?: string;
  year?: number;
}

const knownWithYear = (mention: DateMention, dates: ReadonlySet<string>, year: number): boolean =>
  mention.days.every((day) => dates.has(fullDateKey(day, mention.month, year)));

const knownWithoutYear = (mention: DateMention, dates: ReadonlySet<string>): boolean =>
  mention.days.every((day) => dates.has(dayMonthKey(day, mention.month)));

const maskedDate = (mention: DateMention, dates: ReadonlySet<string>): string => {
  const words = mention.monthName ?? '';
  if (mention.year !== undefined && knownWithYear(mention, dates, mention.year)) {
    return words;
  }
  if (!knownWithoutYear(mention, dates)) {
    return mention.text;
  }
  return mention.year === undefined ? words : `${words} ${mention.year}`;
};

const mentionOf = (
  text: string,
  days: readonly string[],
  monthName: string | undefined,
  monthNumber: string | undefined,
  year: string | undefined,
): DateMention => ({
  text,
  days: days.map(Number),
  month: monthOf(monthName, monthNumber),
  monthName,
  year: year === undefined ? undefined : Number(year),
});

const withoutKnownRanges = (answer: string, dates: ReadonlySet<string>): string =>
  answer.replace(
    RANGE_MENTION,
    (
      text,
      firstDay: string,
      lastDay: string,
      monthName?: string,
      monthNumber?: string,
      year?: string,
    ) => maskedDate(mentionOf(text, [firstDay, lastDay], monthName, monthNumber, year), dates),
  );

const withoutKnownSingleDates = (answer: string, dates: ReadonlySet<string>): string =>
  answer.replace(
    DATE_MENTION,
    (text, day: string, monthName?: string, monthNumber?: string, year?: string) =>
      maskedDate(mentionOf(text, [day], monthName, monthNumber, year), dates),
  );

const withoutKnownDates = (answer: string, dates: ReadonlySet<string>): string =>
  withoutKnownSingleDates(withoutKnownRanges(answer, dates), dates);

const NO_DATES: ReadonlySet<string> = new Set();

const isVerified = (
  number: WrittenNumber,
  known: ReadonlySet<string>,
  decimals: readonly number[],
): boolean =>
  number.candidates.some((candidate) => known.has(candidate)) ||
  isRoundingOfKnown(number, decimals);

export const unverifiedNumbers = (
  answer: string,
  known: ReadonlySet<string>,
  dates: ReadonlySet<string> = NO_DATES,
): string[] => {
  const decimals = knownDecimals(known);
  return writtenNumbers(withoutKnownDates(answer, dates))
    .filter((number) => !isVerified(number, known, decimals))
    .map((number) => number.candidates[0] ?? '');
};
