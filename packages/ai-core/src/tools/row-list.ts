import { redactSecrets } from './redact';

export interface RowOmission {
  omitted: number;
  hint: string;
}

export type RowFrame<T> = (rows: readonly T[], omission: RowOmission | undefined) => unknown;

const defaultFrame = <T>(rows: readonly T[], omission: RowOmission | undefined): unknown => ({
  rows,
  ...omission,
});

export class RowList<T = unknown> {
  private constructor(
    readonly rows: readonly T[],
    readonly hint: string,
    private readonly frame: RowFrame<T>,
  ) {}

  static of<T>(rows: readonly T[], hint: string, frame: RowFrame<T> = defaultFrame): RowList<T> {
    return new RowList(rows, hint, frame);
  }

  around(outer: (inner: unknown) => unknown): RowList<T> {
    return new RowList(this.rows, this.hint, (rows, omission) => outer(this.frame(rows, omission)));
  }

  withFirst(count: number): unknown {
    const omitted = this.rows.length - count;
    return this.frame(
      this.rows.slice(0, count),
      omitted > 0 ? { omitted, hint: this.hint } : undefined,
    );
  }

  withAllRows(): unknown {
    return this.withFirst(this.rows.length);
  }
}

const serializedWithFirst = <T>(list: RowList<T>, count: number): string =>
  JSON.stringify(list.withFirst(count)) ?? '';

const fitsAfterRedaction = (text: string, maxChars: number): boolean =>
  redactSecrets(text).length <= maxChars;

export const fitRowList = <T>(list: RowList<T>, maxChars: number): string => {
  const whole = serializedWithFirst(list, list.rows.length);
  if (fitsAfterRedaction(whole, maxChars)) return whole;
  let fitting = 0;
  let tooMany = list.rows.length;
  while (tooMany - fitting > 1) {
    const middle = Math.floor((fitting + tooMany) / 2);
    if (fitsAfterRedaction(serializedWithFirst(list, middle), maxChars)) fitting = middle;
    else tooMany = middle;
  }
  return serializedWithFirst(list, fitting);
};
