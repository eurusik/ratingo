export const SourceState = {
  OK: 'ok',
  UNAVAILABLE: 'unavailable',
} as const;
export type SourceState = (typeof SourceState)[keyof typeof SourceState];

export type SourceReading<T> =
  | { state: typeof SourceState.OK; data: T }
  | { state: typeof SourceState.UNAVAILABLE; reason: string };

export const available = <T>(data: T): SourceReading<T> => ({ state: SourceState.OK, data });

export const unavailable = <T>(reason: string): SourceReading<T> => ({
  state: SourceState.UNAVAILABLE,
  reason,
});
