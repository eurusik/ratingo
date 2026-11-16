import fc from 'fast-check';
import { readCsvTable } from './csv-table';

function quoteCell(cell: string): string {
  return `"${cell.replaceAll('"', '""')}"`;
}

describe('readCsvTable', () => {
  it('lowercases and trims headers', () => {
    expect(readCsvTable(' Const ,Your Rating\ntt1,8').headers).toEqual(['const', 'your rating']);
  });

  it('strips a byte order mark', () => {
    expect(readCsvTable('\uFEFFa,b\n1,2').records).toEqual([{ a: '1', b: '2' }]);
  });

  it('keeps commas, escaped quotes and newlines inside quoted cells', () => {
    const table = readCsvTable('title,genres\n"Say ""hi""","Crime, Drama\nNoir"');
    expect(table.records).toEqual([{ title: 'Say "hi"', genres: 'Crime, Drama\nNoir' }]);
  });

  it('reads Windows line endings', () => {
    expect(readCsvTable('a,b\r\n1,2\r\n').records).toEqual([{ a: '1', b: '2' }]);
  });

  it('drops blank lines and fills missing cells with empty strings', () => {
    expect(readCsvTable('a,b\n\n1\n,\n').records).toEqual([{ a: '1', b: '' }]);
  });

  it('returns no records for a header-only file', () => {
    expect(readCsvTable('a,b').records).toEqual([]);
  });

  it('reads back any quoted table it is given', () => {
    const cell = fc.string({ unit: 'grapheme', maxLength: 12 }).map((value) => value.trim());
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 4 }),
        fc.array(fc.array(cell, { minLength: 4, maxLength: 4 }), { maxLength: 5 }),
        (headers, rows) => {
          const filled = rows
            .map((row) => row.slice(0, headers.length))
            .filter((row) => row.some((value) => value !== ''));
          const text = [headers, ...filled].map((row) => row.map(quoteCell).join(',')).join('\n');
          const expected = filled.map((row) =>
            Object.fromEntries(headers.map((header, index) => [header, row[index]])),
          );
          expect(readCsvTable(text).records).toEqual(expected);
        },
      ),
    );
  });
});
