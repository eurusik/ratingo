import type {
  MatchOutcome,
  PatternMatcherPort,
  PatternSession,
} from '../../domain/ports/pattern-matcher.port';
import { SearchMode, type CompiledPattern } from '../../domain/policies/search-pattern';

const lineTesterFor = (pattern: CompiledPattern): ((line: string) => boolean) => {
  if (pattern.mode === SearchMode.REGEX) {
    const expression = new RegExp(pattern.source, pattern.flags);
    return (line) => expression.test(line);
  }
  const ignoreCase = pattern.flags.includes('i');
  const needle = ignoreCase ? pattern.source.toLowerCase() : pattern.source;
  return (line) => (ignoreCase ? line.toLowerCase() : line).includes(needle);
};

export class InProcessPatternSession implements PatternSession {
  private readonly test: (line: string) => boolean;

  constructor(pattern: CompiledPattern) {
    this.test = lineTesterFor(pattern);
  }

  match(lines: readonly string[]): Promise<MatchOutcome> {
    const indices = lines.flatMap((line, index) => (this.test(line) ? [index] : []));
    return Promise.resolve({ timedOut: false, indices });
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

export class InProcessPatternMatcher implements PatternMatcherPort {
  open(pattern: CompiledPattern): PatternSession {
    return new InProcessPatternSession(pattern);
  }
}
