import { ReadLimits } from '../constants/investigation.constants';

export const RangeRejection = {
  START_BEYOND_END_OF_FILE: 'start_beyond_end_of_file',
  END_BEFORE_START: 'end_before_start',
  EMPTY_FILE: 'empty_file',
} as const;
export type RangeRejection = (typeof RangeRejection)[keyof typeof RangeRejection];

export type LineRangeResult =
  | { ok: true; startLine: number; endLine: number; cappedByLimit: boolean }
  | { ok: false; reason: RangeRejection };

export const resolveLineRange = (
  request: { startLine?: number; endLine?: number },
  totalLines: number,
): LineRangeResult => {
  if (totalLines === 0) return { ok: false, reason: RangeRejection.EMPTY_FILE };
  const startLine = request.startLine ?? 1;
  if (startLine > totalLines) return { ok: false, reason: RangeRejection.START_BEYOND_END_OF_FILE };
  const wantedEnd = request.endLine ?? startLine + ReadLimits.DEFAULT_LINES - 1;
  if (wantedEnd < startLine) return { ok: false, reason: RangeRejection.END_BEFORE_START };
  const fileEnd = Math.min(wantedEnd, totalLines);
  const limitEnd = startLine + ReadLimits.MAX_LINES_REQUESTED - 1;
  return {
    ok: true,
    startLine,
    endLine: Math.min(fileEnd, limitEnd),
    cappedByLimit: fileEnd > limitEnd,
  };
};
