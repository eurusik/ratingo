import {
  CHECK_MATCH_EXCLUDED_TIERS,
  CORE_FILE_TIERS,
  DEFAULT_FILE_TIER,
  FILE_TIER_PRIORITY,
  FileTier,
  PATH_TIER_RULES,
} from '../constants/file-priority.constants';
import type { Check } from '../entities/check';
import { FileStatus, type ChangedFile } from '../entities/pull-request';

import { hitsInFile } from './check-selector';
import { addedLineTexts } from './diff-hunks';
import { matchesAnyGlob } from './glob-match';

export interface RankedFile {
  file: ChangedFile;
  tier: FileTier;
}

export interface FocusLimits {
  maxFiles: number;
  maxInlineChangedLines: number;
}

const tierIndex = (tier: FileTier): number => FILE_TIER_PRIORITY.indexOf(tier);

export const changedLinesOf = (file: ChangedFile): number => file.additions + file.deletions;

export const isCoreTier = (tier: FileTier): boolean => CORE_FILE_TIERS.includes(tier);

const pathTier = (path: string): FileTier =>
  PATH_TIER_RULES.find((rule) => matchesAnyGlob(rule.patterns, path))?.tier ?? DEFAULT_FILE_TIER;

const hitsAnyCheck = (file: ChangedFile, checks: readonly Check[]): boolean => {
  const selectable = {
    path: file.path,
    addedLines: file.patch === null ? [] : addedLineTexts(file.patch),
  };
  return checks.some((check) => hitsInFile(check, selectable) > 0);
};

export const tierOf = (file: ChangedFile, checks: readonly Check[]): FileTier => {
  const byPath = pathTier(file.path);
  if (CHECK_MATCH_EXCLUDED_TIERS.includes(byPath)) return byPath;
  return hitsAnyCheck(file, checks) ? FileTier.CHECK_MATCH : byPath;
};

const isNewFile = (file: ChangedFile): boolean => file.status === FileStatus.ADDED;

const compareRanked = (left: RankedFile, right: RankedFile): number =>
  tierIndex(left.tier) - tierIndex(right.tier) ||
  Number(isNewFile(right.file)) - Number(isNewFile(left.file)) ||
  changedLinesOf(right.file) - changedLinesOf(left.file) ||
  left.file.path.localeCompare(right.file.path);

export const rankFiles = (files: readonly ChangedFile[], checks: readonly Check[]): RankedFile[] =>
  files.map((file) => ({ file, tier: tierOf(file, checks) })).sort(compareRanked);

const orderBySuggestion = (
  ranked: readonly RankedFile[],
  suggested: readonly string[],
): RankedFile[] => {
  const position = new Map(suggested.map((path, index) => [path, index]));
  const rankOf = new Map(ranked.map((entry, index) => [entry.file.path, index]));
  const suggestedAt = (entry: RankedFile): number =>
    position.get(entry.file.path) ?? suggested.length;
  return [...ranked].sort(
    (left, right) =>
      tierIndex(left.tier) - tierIndex(right.tier) ||
      suggestedAt(left) - suggestedAt(right) ||
      (rankOf.get(left.file.path) ?? 0) - (rankOf.get(right.file.path) ?? 0),
  );
};

export const selectFocusFiles = (
  ranked: readonly RankedFile[],
  suggested: readonly string[],
  limits: FocusLimits,
): string[] => {
  const selected: string[] = [];
  let lines = 0;
  for (const entry of orderBySuggestion(ranked, suggested)) {
    if (selected.length >= limits.maxFiles) break;
    const size = changedLinesOf(entry.file);
    const fits = selected.length === 0 || lines + size <= limits.maxInlineChangedLines;
    if (!isCoreTier(entry.tier) && !fits) continue;
    selected.push(entry.file.path);
    lines += size;
  }
  return selected;
};
