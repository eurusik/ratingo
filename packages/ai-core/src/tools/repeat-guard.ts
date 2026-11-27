const MAX_TRACKED_RUNS = 64;
const MAX_CALLS_PER_RUN = 200;

export const RepeatReason = {
  FAILED: 'failed',
  EMPTY: 'empty',
} as const;
export type RepeatReason = (typeof RepeatReason)[keyof typeof RepeatReason];

export interface RememberedCall {
  reason: RepeatReason;
  content: string;
}

const sortKeysDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, sortKeysDeep(entry)]),
    );
  }
  return value;
};

export const callKey = (toolName: string, input: unknown): string =>
  `${toolName}\u0000${JSON.stringify(sortKeysDeep(input)) ?? ''}`;

export const repeatNote = (reason: RepeatReason): string =>
  reason === RepeatReason.FAILED
    ? '[repeated call: this exact call already failed earlier in this run, so it was not run again. The earlier result follows. Change the input or take another approach.]'
    : '[repeated call: this exact call already returned nothing earlier in this run, so it was not run again. The earlier result follows. Change the input or take another approach.]';

export class RepeatGuard {
  private readonly runs = new Map<string, Map<string, RememberedCall>>();

  recall(runId: string, key: string): RememberedCall | undefined {
    return this.runs.get(runId)?.get(key);
  }

  remember(runId: string, key: string, call: RememberedCall): void {
    const calls = this.callsOf(runId);
    if (calls.size < MAX_CALLS_PER_RUN) calls.set(key, call);
  }

  private callsOf(runId: string): Map<string, RememberedCall> {
    const existing = this.runs.get(runId);
    if (existing !== undefined) return existing;
    if (this.runs.size >= MAX_TRACKED_RUNS) {
      const oldest = this.runs.keys().next();
      if (oldest.done !== true) this.runs.delete(oldest.value);
    }
    const created = new Map<string, RememberedCall>();
    this.runs.set(runId, created);
    return created;
  }
}
