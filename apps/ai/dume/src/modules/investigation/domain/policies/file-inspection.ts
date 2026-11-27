import { SkipReason, SnapshotLimits } from '../constants/snapshot.constants';

export type FileInspection =
  { kind: 'text'; lines: readonly string[] } | { kind: 'skipped'; reason: SkipReason };

const NUL_BYTE = 0;
const LINE_FEED = '\n';
const CARRIAGE_RETURN = '\r';

export const splitLines = (text: string): string[] => {
  if (text === '') return [];
  const lines = text
    .split(LINE_FEED)
    .map((line) => (line.endsWith(CARRIAGE_RETURN) ? line.slice(0, -1) : line));
  if (text.endsWith(LINE_FEED)) lines.pop();
  return lines;
};

const looksBinary = (body: Uint8Array): boolean =>
  body.subarray(0, SnapshotLimits.BINARY_SNIFF_BYTES).includes(NUL_BYTE);

export const inspectFileBody = (body: Uint8Array): FileInspection => {
  if (body.byteLength > SnapshotLimits.MAX_FILE_BYTES) {
    return { kind: 'skipped', reason: SkipReason.TOO_LARGE };
  }
  if (looksBinary(body)) return { kind: 'skipped', reason: SkipReason.BINARY };
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return { kind: 'skipped', reason: SkipReason.NOT_UTF8 };
  }
  const lines = splitLines(text);
  if (lines.some((line) => line.length > SnapshotLimits.MAX_LINE_CHARS)) {
    return { kind: 'skipped', reason: SkipReason.LONG_LINES };
  }
  return { kind: 'text', lines };
};
