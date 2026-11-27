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

export interface LineMatcher {
  test(line: string): boolean;
  maxLineChars: number;
}

export type PatternResult = { ok: true; matcher: LineMatcher } | { ok: false; message: string };

const SIMPLE_ESCAPES = new Set(['d', 'D', 'w', 'W', 's', 'S', 'b', 'B', 't', 'n', 'r']);
const QUANTIFIER_CHARS = new Set(['*', '+', '?']);
const DIGITS = /^\d+$/;

const invalid = (message: string): PatternResult => ({ ok: false, message });

interface ScanState {
  index: number;
  groupDepth: number;
  unbounded: number;
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
    } else if (char === ']' && index > from + 1) {
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

const scanBraces = (pattern: string, from: number, state: ScanState): number | string => {
  const close = pattern.indexOf('}', from);
  if (close === -1) return 'unterminated {n,m} repeat';
  const body = pattern.slice(from + 1, close);
  const parts = body.split(',');
  const [low, high] = parts;
  if (parts.length > 2 || !DIGITS.test(low ?? '') || (parts.length === 2 && high !== '' && !DIGITS.test(high ?? ''))) {
    return 'malformed {n,m} repeat';
  }
  const upper = parts.length === 1 ? Number(low) : high === '' ? Infinity : Number(high);
  if (upper === Infinity) state.unbounded += 1;
  else if (upper > SearchLimits.MAX_BOUNDED_REPEAT) return `a repeat count above ${SearchLimits.MAX_BOUNDED_REPEAT} is not allowed`;
  return close;
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
  if (char === '*' || char === '+') state.unbounded += 1;
  if (char === '{') {
    const close = scanBraces(pattern, state.index, state);
    if (typeof close === 'string') return close;
    state.index = close;
  }
  state.index += 1;
  state.previous = 'quantifier';
  return undefined;
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
    if (pattern.slice(state.index, state.index + 3) !== '(?:') return 'lookaheads, lookbehinds and named groups are not supported';
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
  const state: ScanState = { index: 0, groupDepth: 0, unbounded: 0, previous: 'start' };
  while (state.index < pattern.length) {
    const problem = scanToken(pattern, state);
    if (problem !== undefined) return problem;
  }
  if (state.groupDepth !== 0) return 'unbalanced parenthesis';
  if (state.unbounded > SearchLimits.MAX_UNBOUNDED_QUANTIFIERS) {
    return `at most ${SearchLimits.MAX_UNBOUNDED_QUANTIFIERS} open-ended repeats (*, + or {n,}) are allowed`;
  }
  return undefined;
};

export const compileSearchPattern = (request: SearchPatternRequest): PatternResult => {
  if (request.pattern === '') return invalid('the pattern is empty');
  if (request.pattern.length > SearchLimits.MAX_PATTERN_CHARS) {
    return invalid(`the pattern is longer than ${SearchLimits.MAX_PATTERN_CHARS} characters`);
  }
  if (request.mode === SearchMode.TEXT) {
    const needle = request.ignoreCase ? request.pattern.toLowerCase() : request.pattern;
    return {
      ok: true,
      matcher: {
        maxLineChars: Infinity,
        test: (line) => (request.ignoreCase ? line.toLowerCase() : line).includes(needle),
      },
    };
  }
  const problem = validateRegex(request.pattern);
  if (problem !== undefined) return invalid(`regex rejected: ${problem}`);
  try {
    const expression = new RegExp(request.pattern, request.ignoreCase ? 'i' : '');
    return {
      ok: true,
      matcher: { maxLineChars: SearchLimits.MAX_REGEX_LINE_CHARS, test: (line) => expression.test(line) },
    };
  } catch {
    return invalid('regex rejected: the pattern does not compile');
  }
};
