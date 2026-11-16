const BYTE_ORDER_MARK = /^\uFEFF/;
const QUOTE = '"';

export type CsvRecord = Record<string, string>;

export interface CsvTable {
  headers: string[];
  records: CsvRecord[];
}

function readRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let isQuoted = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (isQuoted) {
      if (char !== QUOTE) cell += char;
      else if (text[index + 1] === QUOTE) {
        cell += QUOTE;
        index++;
      } else isQuoted = false;
    } else if (char === QUOTE) isQuoted = true;
    else if (char === ',') endCell();
    else if (char === '\n') endRow();
    else if (char !== '\r') cell += char;
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

const isBlank = (row: readonly string[]) => row.every((cell) => cell.trim() === '');

export function readCsvTable(text: string): CsvTable {
  const [headerRow = [], ...rows] = readRows(text.replace(BYTE_ORDER_MARK, ''));
  const headers = headerRow.map((header) => header.trim().toLowerCase());
  const records = rows
    .filter((row) => !isBlank(row))
    .map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() ?? ''])),
    );
  return { headers, records };
}
