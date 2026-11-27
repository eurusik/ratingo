const BLOCK_BYTES = 512;
const MAX_METADATA_BYTES = 1_000_000;
const NAME_END = 100;
const SIZE_START = 124;
const SIZE_END = 136;
const CHECKSUM_START = 148;
const CHECKSUM_END = 156;
const TYPE_OFFSET = 156;
const MAGIC_START = 257;
const MAGIC_END = 262;
const PREFIX_START = 345;
const PREFIX_END = 500;
const ASCII_SPACE = 0x20;
const USTAR_MAGIC = 'ustar';
const NUL = '\u0000';

export const TarEntryType = {
  FILE: 'file',
  DIRECTORY: 'directory',
  SYMLINK: 'symlink',
  HARDLINK: 'hardlink',
  OTHER: 'other',
} as const;
export type TarEntryType = (typeof TarEntryType)[keyof typeof TarEntryType];

export interface TarEntry {
  path: string;
  size: number;
  type: TarEntryType;
}

type TarDecision = 'read' | 'skip';

export interface TarVisitor {
  decide(entry: TarEntry): TarDecision;
  receive(entry: TarEntry, body: Buffer): Promise<void> | void;
}

export class TarLimitError extends Error {
  constructor(reason: string) {
    super(`Tar archive over its limit: ${reason}`);
    this.name = 'TarLimitError';
  }
}

export class InvalidTarError extends Error {
  constructor(reason: string) {
    super(`Invalid tar archive: ${reason}`);
    this.name = 'InvalidTarError';
  }
}

class ByteQueue {
  private chunks: Buffer[] = [];
  private length = 0;

  get size(): number {
    return this.length;
  }

  push(chunk: Uint8Array): void {
    this.chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
    this.length += chunk.byteLength;
  }

  take(count: number): Buffer {
    const joined = this.chunks.length === 1 ? this.chunks[0] : Buffer.concat(this.chunks);
    const taken = joined.subarray(0, count);
    const rest = joined.subarray(count);
    this.chunks = rest.length === 0 ? [] : [rest];
    this.length -= count;
    return taken;
  }
}

const textOf = (block: Buffer, start: number, end: number): string => {
  const raw = block.toString('utf8', start, end);
  const terminator = raw.indexOf(NUL);
  return terminator === -1 ? raw : raw.slice(0, terminator);
};

const octalOf = (block: Buffer, start: number, end: number): number => {
  const text = textOf(block, start, end).trim();
  if (text === '') return 0;
  if (!/^[0-7]+$/.test(text)) throw new InvalidTarError('a size field is not octal');
  return parseInt(text, 8);
};

const checksumMatches = (block: Buffer): boolean => {
  let sum = 0;
  for (let index = 0; index < BLOCK_BYTES; index += 1) {
    sum += index >= CHECKSUM_START && index < CHECKSUM_END ? ASCII_SPACE : (block[index] as number);
  }
  return sum === octalOf(block, CHECKSUM_START, CHECKSUM_END);
};

const entryTypeOf = (flag: string): TarEntryType => {
  switch (flag) {
    case '0':
    case NUL:
    case '':
      return TarEntryType.FILE;
    case '5':
      return TarEntryType.DIRECTORY;
    case '2':
      return TarEntryType.SYMLINK;
    case '1':
      return TarEntryType.HARDLINK;
    default:
      return TarEntryType.OTHER;
  }
};

const parsePaxRecords = (body: Buffer): Map<string, string> => {
  const records = new Map<string, string>();
  let position = 0;
  while (position < body.length) {
    const space = body.indexOf(0x20, position);
    if (space === -1) break;
    const length = parseInt(body.toString('utf8', position, space), 10);
    if (!Number.isFinite(length) || length <= space - position) break;
    const record = body.toString('utf8', space + 1, position + length - 1);
    const equals = record.indexOf('=');
    if (equals > 0) records.set(record.slice(0, equals), record.slice(equals + 1));
    position += length;
  }
  return records;
};

interface PendingOverrides {
  path?: string;
  size?: number;
}

const padding = (size: number): number => (BLOCK_BYTES - (size % BLOCK_BYTES)) % BLOCK_BYTES;

export interface TarLimits {
  maxEntries: number;
  maxStreamBytes: number;
}

export const readTarStream = async (
  source: AsyncIterable<Uint8Array>,
  visitor: TarVisitor,
  limits: TarLimits,
): Promise<void> => {
  let entriesSeen = 0;
  let streamBytes = 0;
  const queue = new ByteQueue();
  let pending: PendingOverrides = {};
  let current: {
    entry: TarEntry;
    flag: string;
    remaining: number;
    keep: boolean;
    chunks: Buffer[];
  } | null = null;
  let skipping = 0;
  let sawEnd = false;

  const finishBody = async (): Promise<void> => {
    if (current === null) return;
    const finished = current;
    current = null;
    const body = Buffer.concat(finished.chunks);
    if (finished.flag === 'x') {
      const records = parsePaxRecords(body);
      const path = records.get('path');
      const size = records.get('size');
      const parsedSize = size === undefined ? undefined : Number(size);
      if (parsedSize !== undefined && !(Number.isSafeInteger(parsedSize) && parsedSize >= 0)) {
        throw new InvalidTarError('a pax size is not a whole number');
      }
      pending = {
        ...pending,
        ...(path === undefined ? {} : { path }),
        ...(parsedSize === undefined ? {} : { size: parsedSize }),
      };
    } else if (finished.flag === 'L') {
      pending = { ...pending, path: textOf(body, 0, body.length) };
    } else if (
      finished.keep &&
      (finished.flag === '0' || finished.flag === NUL || finished.flag === '')
    ) {
      await visitor.receive(finished.entry, body);
    }
    skipping = padding(finished.entry.size);
  };

  const startEntry = async (block: Buffer): Promise<void> => {
    if (block.every((byte) => byte === 0)) {
      sawEnd = true;
      return;
    }
    if (!checksumMatches(block)) throw new InvalidTarError('a header checksum does not match');
    entriesSeen += 1;
    if (entriesSeen > limits.maxEntries) throw new TarLimitError('too many entries');
    const flag = String.fromCharCode(block[TYPE_OFFSET] as number);
    const headerSize = octalOf(block, SIZE_START, SIZE_END);
    const isUstar = textOf(block, MAGIC_START, MAGIC_END) === USTAR_MAGIC;
    const prefix = isUstar ? textOf(block, PREFIX_START, PREFIX_END) : '';
    const name = textOf(block, 0, NAME_END);
    const isMetadata = flag === 'x' || flag === 'g' || flag === 'L' || flag === 'K';
    const entry: TarEntry = {
      path: pending.path ?? (prefix === '' ? name : `${prefix}/${name}`),
      size: isMetadata ? headerSize : (pending.size ?? headerSize),
      type: entryTypeOf(flag),
    };
    if (isMetadata) {
      if (headerSize > MAX_METADATA_BYTES)
        throw new InvalidTarError('a metadata record is too large');
      const keep = flag === 'x' || flag === 'L';
      current = { entry, flag, remaining: headerSize, keep, chunks: [] };
    } else {
      pending = {};
      const keep = entry.type === TarEntryType.FILE && visitor.decide(entry) === 'read';
      current = { entry, flag, remaining: entry.size, keep, chunks: [] };
    }
    if (current.remaining === 0) await finishBody();
  };

  const pump = async (): Promise<void> => {
    for (;;) {
      if (sawEnd) return;
      if (skipping > 0) {
        if (queue.size === 0) return;
        const dropped = Math.min(skipping, queue.size);
        queue.take(dropped);
        skipping -= dropped;
        continue;
      }
      if (current === null) {
        if (queue.size < BLOCK_BYTES) return;
        await startEntry(queue.take(BLOCK_BYTES));
        continue;
      }
      if (queue.size === 0) return;
      const wanted = Math.min(current.remaining, queue.size);
      const piece = queue.take(wanted);
      if (current.keep) current.chunks.push(piece);
      current.remaining -= wanted;
      if (current.remaining === 0) await finishBody();
    }
  };

  for await (const chunk of source) {
    streamBytes += chunk.byteLength;
    if (streamBytes > limits.maxStreamBytes)
      throw new TarLimitError('too many bytes after decompression');
    queue.push(chunk);
    await pump();
    if (sawEnd) return;
  }
  if (current !== null || skipping > 0)
    throw new InvalidTarError('the archive ends in the middle of an entry');
};
