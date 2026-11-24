import {
  MAX_INLINE_DIFF_CHANGED_LINES,
  MAX_PROMPT_PATCH_CHARS,
  MAX_RECHECK_PROMPT_MESSAGE_CHARS,
  SHORT_SHA_LENGTH,
  MAX_RULES_CHARS,
} from '../../domain/constants/review-limits.constants';
import type { Check } from '../../domain/entities/check';
import type { ChangedFile, PullRequest } from '../../domain/entities/pull-request';
import type { TrackedFinding } from '../../domain/entities/tracked-finding';
import { parseDiffLines, toLineRanges } from '../../domain/policies/diff-hunks';
import type { RepoRule } from '../../domain/policies/rule-selector';
import { wrapUntrusted } from '../../domain/policies/untrusted-content';

const RULES_HEADING = '# Repository rules (trusted, from the base branch)';
const CHECKS_HEADING =
  '# Checks for this change (trusted). A finding that follows one of these checks sets checkId to its id; any other finding sets checkId to null. For each check, first compare the code with its "Do not report" and "Looks risky but fine" sections; when the code matches them, report nothing for that check.';
const TRUNCATED_RULES_NOTE = '\n[rules truncated; use get_rules for the rest]';

export const DiffMode = {
  INLINE: 'inline',
  FILE_LIST: 'file_list',
} as const;
export type DiffMode = (typeof DiffMode)[keyof typeof DiffMode];

export type RuleSections = ReadonlyMap<string, string>;

const renderCheck = (check: Check, sections: RuleSections): string => {
  const rule = sections.get(check.id);
  const ruleBlock =
    rule === undefined || check.rule === null
      ? ''
      : `\n\nRepository rule ${check.rule.file}${check.rule.heading === null ? '' : `#${check.rule.heading}`}:\n${rule}`;
  return `## Check ${check.id} (highest severity: ${check.severityCap})\n${check.body}${ruleBlock}`;
};

export const buildReviewSystem = (
  basePrompt: string,
  rules: readonly RepoRule[],
  checks: readonly Check[] = [],
  sections: RuleSections = new Map(),
): string => {
  const joined = rules.map((rule) => `## ${rule.path}\n${rule.body}`).join('\n\n');
  const body =
    joined.length > MAX_RULES_CHARS
      ? `${joined.slice(0, MAX_RULES_CHARS)}${TRUNCATED_RULES_NOTE}`
      : joined;
  const checkBlock =
    checks.length === 0
      ? ''
      : `\n\n${CHECKS_HEADING}\n${[...checks]
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((check) => renderCheck(check, sections))
          .join('\n\n')}`;
  return `${basePrompt}\n\n${RULES_HEADING}\n${body}${checkBlock}`;
};

const renderPatch = (file: ChangedFile): string =>
  file.patch === null
    ? `### ${file.path} (${file.status})\nNo diff available; read the file with read_file.`
    : `### ${file.path} (${file.status} +${file.additions} -${file.deletions})\n\`\`\`diff\n${file.patch}\n\`\`\``;

const renderListEntry = (file: ChangedFile): string => {
  const ranges =
    file.patch === null ? '' : ` changed lines ${toLineRanges(parseDiffLines(file.patch).added)}`;
  return `- ${file.path} (${file.status} +${file.additions} -${file.deletions})${ranges}`;
};

const focusedFiles = (
  files: readonly ChangedFile[],
  focusFiles: readonly string[],
): ChangedFile[] => {
  const byPath = new Map(files.map((file) => [file.path, file]));
  return focusFiles.flatMap((path) => byPath.get(path) ?? []);
};

export const chooseDiffMode = (
  files: readonly ChangedFile[],
  focusFiles: readonly string[],
): DiffMode => {
  const focused = focusedFiles(files, focusFiles);
  const chars = focused.reduce((sum, file) => sum + renderPatch(file).length, 0);
  const lines = focused.reduce((sum, file) => sum + file.additions + file.deletions, 0);
  return chars > MAX_PROMPT_PATCH_CHARS || lines > MAX_INLINE_DIFF_CHANGED_LINES
    ? DiffMode.FILE_LIST
    : DiffMode.INLINE;
};

interface IncrementalPrompt {
  baseSha: string;
  totalChangedFiles: number;
}

export interface PromptHistory {
  incremental: IncrementalPrompt | null;
  previous: readonly TrackedFinding[];
  recheck: readonly TrackedFinding[];
}

const NO_HISTORY: PromptHistory = { incremental: null, previous: [], recheck: [] };

const renderTrackedFinding = (finding: TrackedFinding): string =>
  `- ${finding.fingerprint} ${finding.severity} ${finding.category} ${finding.file}:${finding.line} ${finding.message.slice(0, MAX_RECHECK_PROMPT_MESSAGE_CHARS)} | code: ${finding.excerpt}`;

const incrementalNote = (incremental: IncrementalPrompt, headSha: string): string =>
  `This is an incremental review of the commits ${incremental.baseSha.slice(0, SHORT_SHA_LENGTH)}..${headSha.slice(0, SHORT_SHA_LENGTH)}, added since the last review. Review only the diffs below and report findings only on lines they change. The pull request changes ${incremental.totalChangedFiles} files in total; the rest is read-only context, available through list_changed_files and read_file.`;

const previousNote = (previous: readonly TrackedFinding[]): string[] =>
  previous.length === 0
    ? []
    : [
        'Findings reported by earlier reviews are listed below. Do not report them again, even reworded.',
        wrapUntrusted('earlier findings', previous.map(renderTrackedFinding).join('\n')),
      ];

const recheckNote = (recheck: readonly TrackedFinding[]): string[] =>
  recheck.length === 0
    ? []
    : [
        'For every earlier finding below, read the current code and add one entry to recheck: {fingerprint, verdict}. Use verdict "resolved" when the problem no longer exists at the head commit and "still_open" when it does.',
        wrapUntrusted('findings to recheck', recheck.map(renderTrackedFinding).join('\n')),
      ];

export const buildReviewPrompt = (
  pr: PullRequest,
  files: readonly ChangedFile[],
  focusFiles: readonly string[],
  mode: DiffMode,
  history: PromptHistory = NO_HISTORY,
): string => {
  const focused = focusedFiles(files, focusFiles);
  const changes =
    mode === DiffMode.INLINE
      ? wrapUntrusted('focus diffs', focused.map(renderPatch).join('\n\n'))
      : `The diff is too large to include. Focus files with their changed line ranges (new file line numbers); read them with read_file:\n${wrapUntrusted('focus files', focused.map(renderListEntry).join('\n'))}`;
  return [
    wrapUntrusted('pull request title', pr.title),
    wrapUntrusted('pull request description', pr.body.slice(0, 4_000)),
    ...(history.incremental === null ? [] : [incrementalNote(history.incremental, pr.headSha)]),
    `Changed files: ${files.length}. Focus files below; the others are available through list_changed_files and read_file.`,
    ...previousNote(history.previous),
    ...recheckNote(history.recheck),
    changes,
  ].join('\n\n');
};
