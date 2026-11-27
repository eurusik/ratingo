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

  mapRows<U>(map: (row: T, index: number) => U): RowList<U> {
    return new RowList(this.rows.map(map), this.hint, this.frame as unknown as RowFrame<U>);
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

export const countRowsThatFit = <T>(list: RowList<T>, maxChars: number): number => {
  if (fitsAfterRedaction(serializedWithFirst(list, list.rows.length), maxChars)) {
    return list.rows.length;
  }
  let fitting = 0;
  let tooMany = list.rows.length;
  while (tooMany - fitting > 1) {
    const middle = Math.floor((fitting + tooMany) / 2);
    if (fitsAfterRedaction(serializedWithFirst(list, middle), maxChars)) fitting = middle;
    else tooMany = middle;
  }
  return fitting;
};

export const fitRowList = <T>(list: RowList<T>, maxChars: number): string =>
  serializedWithFirst(list, countRowsThatFit(list, maxChars));
