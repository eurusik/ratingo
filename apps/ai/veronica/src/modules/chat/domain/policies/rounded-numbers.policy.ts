const PERCENT_SCALE = 100;
const RATE_MIN = 0;
const RATE_MAX = 1;

export interface WrittenNumber {
  candidates: readonly string[];
  percent: boolean;
}

const decimalsOf = (value: string): number => value.split('.')[1]?.length ?? 0;

export const knownDecimals = (known: ReadonlySet<string>): number[] =>
  [...known].filter((value) => decimalsOf(value) > 0).map(Number);

const roundsTo = (value: number, written: string): boolean =>
  value.toFixed(decimalsOf(written)) === Number(written).toFixed(decimalsOf(written));

const isRoundedDecimal = (written: string, decimals: readonly number[]): boolean =>
  decimals.some(
    (value) => decimalsOf(String(value)) > decimalsOf(written) && roundsTo(value, written),
  );

const isRoundedPercent = (written: string, decimals: readonly number[]): boolean =>
  decimals.some(
    (value) => value >= RATE_MIN && value <= RATE_MAX && roundsTo(value * PERCENT_SCALE, written),
  );

export const isRoundingOfKnown = (number: WrittenNumber, decimals: readonly number[]): boolean =>
  number.candidates.some(
    (written) =>
      isRoundedDecimal(written, decimals) ||
      (number.percent && isRoundedPercent(written, decimals)),
  );
