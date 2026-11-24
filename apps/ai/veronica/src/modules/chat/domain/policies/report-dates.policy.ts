import { dateKeysOf } from './numbers-guard.policy';

const DAYS_PER_ERA = 146_097;
const YEARS_PER_ERA = 400;
const DAYS_PER_YEAR = 365;
const EPOCH_SHIFT_DAYS = 719_468;
const MONTHS_PER_YEAR = 12;
const MARCH_BASED_SHIFT = 3;
const MONTH_DAYS_FACTOR = 153;
const MONTH_DAYS_OFFSET = 2;
const MONTH_DAYS_DIVISOR = 5;
const LEAP_EVERY = 4;
const CENTURY = 100;
const DAYS_PER_FOUR_YEARS = 1_460;
const DAYS_PER_CENTURY = 36_524;
const LAST_DAY_OF_ERA = 146_096;
const JANUARY_FEBRUARY = 2;

const RANGE_END = /"(?:start_date|end_date)"\s*:\s*"([^"]{1,20})"/g;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAYS_AGO = /^(\d{1,3})daysAgo$/;
const RELATIVE_DAYS: Readonly<Record<string, number>> = { today: 0, yesterday: 1 };

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export const daysFromCivil = ({ year, month, day }: CivilDate): number => {
  const shiftedYear = month <= JANUARY_FEBRUARY ? year - 1 : year;
  const era = Math.floor(shiftedYear / YEARS_PER_ERA);
  const yearOfEra = shiftedYear - era * YEARS_PER_ERA;
  const marchMonth = (month + MONTHS_PER_YEAR - MARCH_BASED_SHIFT) % MONTHS_PER_YEAR;
  const dayOfYear =
    Math.floor((MONTH_DAYS_FACTOR * marchMonth + MONTH_DAYS_OFFSET) / MONTH_DAYS_DIVISOR) + day - 1;
  const dayOfEra =
    yearOfEra * DAYS_PER_YEAR +
    Math.floor(yearOfEra / LEAP_EVERY) -
    Math.floor(yearOfEra / CENTURY) +
    dayOfYear;
  return era * DAYS_PER_ERA + dayOfEra - EPOCH_SHIFT_DAYS;
};

export const civilFromDays = (days: number): CivilDate => {
  const shifted = days + EPOCH_SHIFT_DAYS;
  const era = Math.floor(shifted / DAYS_PER_ERA);
  const dayOfEra = shifted - era * DAYS_PER_ERA;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / DAYS_PER_FOUR_YEARS) +
      Math.floor(dayOfEra / DAYS_PER_CENTURY) -
      Math.floor(dayOfEra / LAST_DAY_OF_ERA)) /
      DAYS_PER_YEAR,
  );
  const dayOfYear =
    dayOfEra -
    (DAYS_PER_YEAR * yearOfEra +
      Math.floor(yearOfEra / LEAP_EVERY) -
      Math.floor(yearOfEra / CENTURY));
  const marchMonth = Math.floor(
    (MONTH_DAYS_DIVISOR * dayOfYear + MONTH_DAYS_OFFSET) / MONTH_DAYS_FACTOR,
  );
  const day =
    dayOfYear -
    Math.floor((MONTH_DAYS_FACTOR * marchMonth + MONTH_DAYS_OFFSET) / MONTH_DAYS_DIVISOR) +
    1;
  const month = ((marchMonth + MARCH_BASED_SHIFT - 1) % MONTHS_PER_YEAR) + 1;
  return {
    year: yearOfEra + era * YEARS_PER_ERA + (month <= JANUARY_FEBRUARY ? 1 : 0),
    month,
    day,
  };
};

const parseIso = (value: string): CivilDate | undefined => {
  const match = ISO_DATE.exec(value);
  return match === null
    ? undefined
    : { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
};

const resolveRangeEnd = (value: string, todayDays: number): CivilDate | undefined => {
  const relative = RELATIVE_DAYS[value] ?? Number(DAYS_AGO.exec(value)?.[1] ?? Number.NaN);
  if (Number.isFinite(relative)) {
    return civilFromDays(todayDays - relative);
  }
  return parseIso(value);
};

export const requestedReportDates = (
  sources: readonly string[],
  kyivToday: string,
): ReadonlySet<string> => {
  const today = parseIso(kyivToday);
  if (today === undefined) {
    return new Set();
  }
  const todayDays = daysFromCivil(today);
  return new Set(
    sources.flatMap((source) =>
      [...source.matchAll(RANGE_END)].flatMap((match) => {
        const date = resolveRangeEnd(match[1] ?? '', todayDays);
        return date === undefined ? [] : dateKeysOf(date.day, date.month, date.year);
      }),
    ),
  );
};
