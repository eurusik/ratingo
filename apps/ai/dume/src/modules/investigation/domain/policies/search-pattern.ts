import { SearchLimits } from '../constants/investigation.constants';

export const SearchMode = {
  TEXT: 'text',
  REGEX: 'regex',
} as const;
export type SearchMode = (typeof SearchMode)[keyof typeof SearchMode];

export interface SearchPatternRequest {
  pattern: string;
  mode: SearchMode;
  ignoreCase: boolean;
}

export interface CompiledPattern {
  mode: SearchMode;
  source: string;
  flags: string;
  maxLineChars: number;
}

export type PatternResult = { ok: true; pattern: CompiledPattern } | { ok: false; message: string };

const SIMPLE_ESCAPES = new Set(['d', 'D', 'w', 'W', 's', 'S', 'b', 'B', 't', 'n', 'r']);
const QUANTIFIER_CHARS = new Set(['*', '+', '?']);
const DIGITS = /^\d+$/;

const invalid = (message: string): PatternResult => ({ ok: false, message });

interface ScanState {
  index: number;
  groupDepth: number;
  combinations: number;
  previous: 'start' | 'atom' | 'group_end' | 'quantifier' | 'lazy' | 'alternation' | 'group_start';
}

const isEscapableLiteral = (char: string): boolean => /[^A-Za-z0-9]/.test(char);

const scanClass = (pattern: string, from: number): number | string => {
  let index = from + 1;
  if (pattern[index] === '^') index += 1;
  let closed = false;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === '\\') {
      const next = pattern[index + 1];
      if (next === undefined || !(SIMPLE_ESCAPES.has(next) || isEscapableLiteral(next))) {
        return 'unsupported escape inside a character class';
      }
      index += 2;
    } else if (char === ']') {
      closed = true;
      break;
    } else if (char === '[') {
      return 'nested character classes are not supported';
    } else {
      index += 1;
    }
  }
  return closed ? index : 'unterminated character class';
};

const scanBraces = (pattern: string, from: number): { close: number; factor: number } | string => {
  const close = pattern.indexOf('}', from);
  if (close === -1) return 'unterminated {n,m} repeat';
  const parts = pattern.slice(from + 1, close).split(',');
  const [low, high] = parts;
  if (
    parts.length > 2 ||
    !DIGITS.test(low ?? '') ||
    (parts.length === 2 && high !== '' && !DIGITS.test(high ?? ''))
  ) {
    return 'malformed {n,m} repeat';
  }
  const lower = Number(low);
  if (parts.length === 1) return { close, factor: 1 };
  if (high === '') return { close, factor: SearchLimits.MAX_REGEX_LINE_CHARS };
  const upper = Number(high);
  if (upper > SearchLimits.MAX_BOUNDED_REPEAT) {
    return `a repeat count above ${SearchLimits.MAX_BOUNDED_REPEAT} is not allowed`;
  }
  return { close, factor: Math.max(1, upper - lower + 1) };
};

const OPTIONAL_FACTOR = 2;

const chargeRepeat = (state: ScanState, factor: number): string | undefined => {
  state.combinations *= factor;
  return state.combinations > SearchLimits.MAX_PATTERN_COMBINATIONS
    ? 'too many ways to match: use fewer or smaller repeats (*, +, ?, {n,m} all count)'
    : undefined;
};

const scanQuantifier = (pattern: string, state: ScanState): string | undefined => {
  const char = pattern[state.index] as string;
  if (state.previous === 'quantifier' && char === '?') {
    state.index += 1;
    state.previous = 'lazy';
    return undefined;
  }
  if (state.previous === 'group_end') {
    return 'a repeat after a group is not supported; repeat a single character or class instead';
  }
  if (state.previous !== 'atom') return 'a repeat needs a character, class or escape before it';
  let factor = char === '?' ? OPTIONAL_FACTOR : SearchLimits.MAX_REGEX_LINE_CHARS;
  if (char === '{') {
    const braces = scanBraces(pattern, state.index);
    if (typeof braces === 'string') return braces;
    state.index = braces.close;
    factor = braces.factor;
  }
  state.index += 1;
  state.previous = 'quantifier';
  return chargeRepeat(state, factor);
};

const checkEscape = (pattern: string, state: ScanState): string | undefined => {
  const next = pattern[state.index + 1];
  if (next === undefined) return 'a trailing backslash';
  if (!(SIMPLE_ESCAPES.has(next) || isEscapableLiteral(next))) {
    return `the escape \\${next} is not supported (no backreferences, unicode or hex escapes)`;
  }
  state.index += 2;
  state.previous = 'atom';
  return undefined;
};

const checkGroupStart = (pattern: string, state: ScanState): string | undefined => {
  if (pattern[state.index + 1] === '?') {
    if (pattern.slice(state.index, state.index + 3) !== '(?:')
      return 'lookaheads, lookbehinds and named groups are not supported';
    state.index += 3;
  } else {
    state.index += 1;
  }
  state.groupDepth += 1;
  if (state.groupDepth > SearchLimits.MAX_GROUP_DEPTH) return 'groups are nested too deeply';
  state.previous = 'group_start';
  return undefined;
};

const scanToken = (pattern: string, state: ScanState): string | undefined => {
  const char = pattern[state.index] as string;
  if (char === '\\') return checkEscape(pattern, state);
  if (char === '[') {
    const end = scanClass(pattern, state.index);
    if (typeof end === 'string') return end;
    state.index = end + 1;
    state.previous = 'atom';
    return undefined;
  }
  if (char === '(') return checkGroupStart(pattern, state);
  if (char === ')') {
    const unbalanced = state.groupDepth === 0 ? 'unbalanced parenthesis' : undefined;
    state.groupDepth -= 1;
    state.index += 1;
    state.previous = 'group_end';
    return unbalanced;
  }
  if (char === '|') {
    state.index += 1;
    state.previous = 'alternation';
    return undefined;
  }
  if (QUANTIFIER_CHARS.has(char) || char === '{') return scanQuantifier(pattern, state);
  state.index += 1;
  state.previous = char === '^' || char === '$' ? 'start' : 'atom';
  return undefined;
};

const validateRegex = (pattern: string): string | undefined => {
  const state: ScanState = { index: 0, groupDepth: 0, combinations: 1, previous: 'start' };
  while (state.index < pattern.length) {
    const problem = scanToken(pattern, state);
    if (problem !== undefined) return problem;
  }
  return state.groupDepth === 0 ? undefined : 'unbalanced parenthesis';
};

export const compileSearchPattern = (request: SearchPatternRequest): PatternResult => {
  if (request.pattern === '') return invalid('the pattern is empty');
  if (request.pattern.length > SearchLimits.MAX_PATTERN_CHARS) {
    return invalid(`the pattern is longer than ${SearchLimits.MAX_PATTERN_CHARS} characters`);
  }
  const flags = request.ignoreCase ? 'i' : '';
  if (request.mode === SearchMode.TEXT) {
    return {
      ok: true,
      pattern: { mode: SearchMode.TEXT, source: request.pattern, flags, maxLineChars: Infinity },
    };
  }
  const problem = validateRegex(request.pattern);
  if (problem !== undefined) return invalid(`regex rejected: ${problem}`);
  try {
    new RegExp(request.pattern, flags);
  } catch {
    return invalid('regex rejected: the pattern does not compile');
  }
  return {
    ok: true,
    pattern: {
      mode: SearchMode.REGEX,
      source: request.pattern,
      flags,
      maxLineChars: SearchLimits.MAX_REGEX_LINE_CHARS,
    },
  };
};
