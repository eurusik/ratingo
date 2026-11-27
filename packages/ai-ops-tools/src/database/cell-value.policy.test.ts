import { DB_QUERY_CELL_MAX_CHARS } from './database.constants';
import { cellOf, rowOf } from './cell-value.policy';

describe('cellOf', () => {
  it('keeps short text, numbers, booleans and null as they are', () => {
    expect([cellOf('Alpha'), cellOf(3), cellOf(true), cellOf(null)]).toEqual([
      'Alpha',
      3,
      true,
      null,
    ]);
  });

  it('turns a bigint into a number and binary data into a short description', () => {
    expect([cellOf(BigInt(42)), cellOf(new Uint8Array(3))]).toEqual([42, '[binary, 3 bytes]']);
  });

  it('cuts a long text and says how long it was', () => {
    const cut = String(cellOf('x'.repeat(DB_QUERY_CELL_MAX_CHARS + 500)));

    expect(cut.startsWith('x'.repeat(DB_QUERY_CELL_MAX_CHARS))).toBe(true);
    expect(cut).toContain(`[text cut, ${DB_QUERY_CELL_MAX_CHARS + 500} characters in total]`);
  });

  it('keeps a small json value as it is and cuts a large one', () => {
    const small = { a: 1 };
    const large = { items: 'y'.repeat(DB_QUERY_CELL_MAX_CHARS * 2) };

    expect(cellOf(small)).toBe(small);
    expect(String(cellOf(large))).toContain('[json cut, ');
  });
});

describe('rowOf', () => {
  it('converts every cell of a row', () => {
    expect(rowOf({ n: BigInt(7), label: 'ok' })).toEqual({ n: 7, label: 'ok' });
  });
});
