import { MAX_EXTRA_CHECKS, MAX_SELECTED_CHECKS } from '../constants/review-limits.constants';
import type { Check, ExtraCheckRequest } from '../entities/check';

import { matchesAnyGlob } from './glob-match';

export interface SelectableFile {
  path: string;
  addedLines: readonly string[];
}

const compiledTriggers = new Map<string, RegExp>();

const triggerRegex = (source: string): RegExp => {
  let regex = compiledTriggers.get(source);
  if (regex === undefined) {
    regex = new RegExp(source);
    compiledTriggers.set(source, regex);
  }
  return regex;
};

export const hitsInFile = (check: Check, file: SelectableFile): number => {
  if (!matchesAnyGlob(check.paths, file.path)) return 0;
  if (check.triggers.length === 0) return 1;
  const regexes = check.triggers.map(triggerRegex);
  return file.addedLines.filter((line) => regexes.some((regex) => regex.test(line))).length;
};

const byId = (left: Check, right: Check): number => left.id.localeCompare(right.id);

export const selectChecks = (
  catalog: readonly Check[],
  files: readonly SelectableFile[],
  cap: number = MAX_SELECTED_CHECKS,
): Check[] =>
  catalog
    .map((check) => ({
      check,
      hits: files.reduce((sum, file) => sum + hitsInFile(check, file), 0),
    }))
    .filter(({ hits }) => hits > 0)
    .sort((left, right) => right.hits - left.hits || byId(left.check, right.check))
    .slice(0, cap)
    .map(({ check }) => check)
    .sort(byId);

export const addExtraChecks = (
  selected: readonly Check[],
  catalog: readonly Check[],
  requests: readonly ExtraCheckRequest[],
  changedPaths: readonly string[],
  cap: number = MAX_SELECTED_CHECKS,
): Check[] => {
  const known = new Map(catalog.map((check) => [check.id, check]));
  const changed = new Set(changedPaths);
  const result = new Map(selected.map((check) => [check.id, check]));
  let added = 0;
  for (const request of requests) {
    const check = known.get(request.id);
    if (
      check !== undefined &&
      !result.has(check.id) &&
      changed.has(request.file) &&
      added < MAX_EXTRA_CHECKS &&
      result.size < cap
    ) {
      result.set(check.id, check);
      added += 1;
    }
  }
  return [...result.values()].sort(byId);
};
