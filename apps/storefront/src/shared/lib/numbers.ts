const PERCENT_PER_POINT = 10;

const scoreFormats = new Map<string, Intl.NumberFormat>();
const countFormats = new Map<string, Intl.NumberFormat>();

export function positiveNumber(value: number | null | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function yearFromDate(date: string | null | undefined): number | undefined {
  return positiveNumber(date ? Number.parseInt(date.slice(0, 4), 10) : undefined);
}

export function scoreFromPercent(percent: number | null | undefined): number | undefined {
  const positive = positiveNumber(percent);
  return positive === undefined ? undefined : positive / PERCENT_PER_POINT;
}

export function formatScore(locale: string, score: number): string {
  let format = scoreFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    scoreFormats.set(locale, format);
  }
  return format.format(score);
}

export function formatCompactCount(locale: string, count: number): string {
  let format = countFormats.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
    countFormats.set(locale, format);
  }
  return format.format(count);
}
