import type { ClockPort } from '@ratingo/ai-core';

import { ListLimits, SearchLimits } from '../../domain/constants/investigation.constants';
import type { CodeSnapshot } from '../../domain/entities/code-snapshot';
import { listDirectoryLevel, type ListedEntry } from '../../domain/policies/directory-listing';
import { extensionOf, isUnderDirectory } from '../../domain/policies/repo-path';
import type { PatternMatcherPort } from '../../domain/ports/pattern-matcher.port';
import type { CompiledPattern } from '../../domain/policies/search-pattern';

export interface SearchFilter {
  pathPrefix: string;
  extensions: readonly string[];
}

export interface SearchMatch {
  path: string;
  line: number;
  text: string;
}

export interface SearchOutcome {
  matches: SearchMatch[];
  filesSearched: number;
  filesInScope: number;
  matchesCapped: boolean;
  stoppedForTime: boolean;
  longLinesNotChecked: number;
}

export interface ReadOutcome {
  lines: readonly string[];
}

export interface ListOutcome {
  entries: ListedEntry[];
  tooMany: boolean;
}

const inScope = (path: string, filter: SearchFilter): boolean =>
  isUnderDirectory(path, filter.pathPrefix) &&
  (filter.extensions.length === 0 || filter.extensions.includes(extensionOf(path)));

export class CodeBrowser {
  constructor(
    private readonly clock: ClockPort,
    private readonly matcher: PatternMatcherPort,
  ) {}

  async search(
    snapshot: CodeSnapshot,
    pattern: CompiledPattern,
    filter: SearchFilter,
  ): Promise<SearchOutcome> {
    const startedMs = this.clock.nowMs();
    const scope = snapshot.files().filter((file) => inScope(file.path, filter));
    const outcome: SearchOutcome = {
      matches: [],
      filesSearched: 0,
      filesInScope: scope.length,
      matchesCapped: false,
      stoppedForTime: false,
      longLinesNotChecked: 0,
    };
    const session = this.matcher.open(pattern);
    try {
      for (const file of scope) {
        const timeLeftMs = SearchLimits.TIME_BUDGET_MS - (this.clock.nowMs() - startedMs);
        if (timeLeftMs <= 0) {
          outcome.stoppedForTime = true;
          break;
        }
        const lines = await snapshot.readLines(file.path);
        if (lines === undefined) continue;
        outcome.filesSearched += 1;
        const checked = lines.flatMap((text, index) =>
          text.length > pattern.maxLineChars ? [] : [{ text, index }],
        );
        outcome.longLinesNotChecked += lines.length - checked.length;
        const result = await session.match(
          checked.map((line) => line.text),
          Math.min(timeLeftMs, SearchLimits.MATCH_CALL_TIMEOUT_MS),
        );
        if (result.timedOut) {
          outcome.stoppedForTime = true;
          break;
        }
        for (const matched of result.indices) {
          const line = checked[matched] as { text: string; index: number };
          outcome.matches.push({ path: file.path, line: line.index + 1, text: line.text });
          if (outcome.matches.length >= SearchLimits.MAX_MATCHES_COLLECTED) {
            outcome.matchesCapped = true;
            return outcome;
          }
        }
      }
    } finally {
      await session.close();
    }
    return outcome;
  }

  async read(snapshot: CodeSnapshot, path: string): Promise<ReadOutcome | undefined> {
    const lines = await snapshot.readLines(path);
    return lines === undefined ? undefined : { lines };
  }

  list(snapshot: CodeSnapshot, directory: string): ListOutcome {
    const entries = listDirectoryLevel(snapshot.files(), directory);
    return {
      entries: entries.slice(0, ListLimits.MAX_ENTRIES),
      tooMany: entries.length > ListLimits.MAX_ENTRIES,
    };
  }
}
