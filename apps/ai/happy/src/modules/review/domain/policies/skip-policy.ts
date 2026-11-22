import {
  BOT_AUTHOR_SUFFIX,
  DOCS_FILE_PATTERNS,
  IGNORED_FILE_PATTERNS,
  MIN_REVIEWABLE_CHANGED_LINES,
  SkipReason,
} from '../constants/skip-patterns.constants';
import type { ChangedFile, PullRequest } from '../entities/pull-request';
import { formatRepository } from '../entities/pull-request';

import { matchesAnyGlob } from './glob-match';

export interface SkipConfig {
  allowedAuthors: readonly string[];
  minChangedLines: number;
}

const DEFAULT_SKIP_CONFIG: SkipConfig = {
  allowedAuthors: [],
  minChangedLines: MIN_REVIEWABLE_CHANGED_LINES,
};

export const isIgnoredFile = (path: string): boolean => matchesAnyGlob(IGNORED_FILE_PATTERNS, path);

const isDocsFile = (path: string): boolean => matchesAnyGlob(DOCS_FILE_PATTERNS, path);

export const reviewableFiles = (files: readonly ChangedFile[]): ChangedFile[] =>
  files.filter((file) => !isIgnoredFile(file.path) && !isDocsFile(file.path));

const isBot = (author: string): boolean => author.toLowerCase().endsWith(BOT_AUTHOR_SUFFIX);

const isTrustedOrigin = (pr: PullRequest, config: SkipConfig): boolean =>
  pr.headRepository?.toLowerCase() === formatRepository(pr.ref).toLowerCase() ||
  config.allowedAuthors.includes(pr.author);

const changedLines = (files: readonly ChangedFile[]): number =>
  files.reduce((sum, file) => sum + file.additions + file.deletions, 0);

export const decideSkip = (
  pr: PullRequest,
  files: readonly ChangedFile[],
  config: SkipConfig = DEFAULT_SKIP_CONFIG,
): SkipReason | null => {
  if (pr.isDraft) return SkipReason.DRAFT;
  if (!isTrustedOrigin(pr, config)) return SkipReason.UNTRUSTED_FORK;
  if (isBot(pr.author)) return SkipReason.BOT_AUTHOR;
  const candidates = files.filter((file) => !isIgnoredFile(file.path));
  if (candidates.length === 0) return SkipReason.NOTHING_TO_REVIEW;
  const code = reviewableFiles(files);
  if (code.length === 0) return SkipReason.DOCS_ONLY;
  if (changedLines(code) < config.minChangedLines) return SkipReason.TRIVIAL;
  return null;
};
