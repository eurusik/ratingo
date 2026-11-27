import type { CompiledPattern } from '../policies/search-pattern';

export type MatchOutcome = { timedOut: false; indices: readonly number[] } | { timedOut: true };

export interface PatternSession {
  match(lines: readonly string[], timeoutMs: number): Promise<MatchOutcome>;
  close(): Promise<void>;
}

export interface PatternMatcherPort {
  open(pattern: CompiledPattern): PatternSession;
}

export const PATTERN_MATCHER_PORT = Symbol('PATTERN_MATCHER_PORT');
