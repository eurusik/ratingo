const BLOCK = 512;

const field = (text: string, length: number): Buffer => {
  const buffer = Buffer.alloc(length);
  buffer.write(text, 0, 'utf8');
  return buffer;
};

const octal = (value: number, length: number): Buffer =>
  field(`${value.toString(8).padStart(length - 1, '0')}`, length);

export interface BuiltEntry {
  name: string;
  body?: Buffer | string;
  flag?: string;
  prefix?: string;
}

const header = ({ name, flag = '0', prefix = '' }: BuiltEntry, size: number): Buffer => {
  const block = Buffer.alloc(BLOCK);
  field(name, 100).copy(block, 0);
  octal(0o644, 8).copy(block, 100);
  octal(0, 8).copy(block, 108);
  octal(0, 8).copy(block, 116);
  octal(size, 12).copy(block, 124);
  octal(0, 12).copy(block, 136);
  Buffer.from('        ').copy(block, 148);
  block.write(flag, 156, 'ascii');
  block.write('ustar', 257, 'ascii');
  block.write('00', 263, 'ascii');
  field(prefix, 155).copy(block, 345);
  let sum = 0;
  for (const byte of block) sum += byte;
  Buffer.from(`${sum.toString(8).padStart(6, '0')}\u0000 `).copy(block, 148);
  return block;
};

const padded = (body: Buffer): Buffer =>
  Buffer.concat([body, Buffer.alloc((BLOCK - (body.length % BLOCK)) % BLOCK)]);

export const tarEntry = (entry: BuiltEntry): Buffer => {
  const body = Buffer.from(entry.body ?? '');
  return Buffer.concat([header(entry, body.length), padded(body)]);
};

export const paxRecords = (records: Record<string, string>): string =>
  Object.entries(records)
    .map(([key, value]) => {
      const rest = ` ${key}=${value}\n`;
      let length = rest.length + 1;
      while (`${length}${rest}`.length !== length) length = `${length}${rest}`.length;
      return `${length}${rest}`;
    })
    .join('');

export const buildTar = (entries: readonly Buffer[]): Buffer =>
  Buffer.concat([...entries, Buffer.alloc(BLOCK * 2)]);

export const chunked = async function* (data: Buffer, size: number): AsyncGenerator<Uint8Array> {
  for (let offset = 0; offset < data.length; offset += size) {
    yield data.subarray(offset, offset + size);
  }
};
