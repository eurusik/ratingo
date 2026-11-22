import {
  MAX_PROMPT_PATCH_CHARS,
  MAX_RULES_CHARS,
} from '../../domain/constants/review-limits.constants';
import type { ChangedFile, PullRequest } from '../../domain/entities/pull-request';
import type { RepoRule } from '../../domain/policies/rule-selector';
import { wrapUntrusted } from '../../domain/policies/untrusted-content';

const RULES_HEADING = '# Repository rules (trusted, from the base branch)';
const TRUNCATED_RULES_NOTE = '\n[rules truncated; use get_rules for the rest]';

export const buildReviewSystem = (basePrompt: string, rules: readonly RepoRule[]): string => {
  const joined = rules.map((rule) => `## ${rule.path}\n${rule.body}`).join('\n\n');
  const body =
    joined.length > MAX_RULES_CHARS
      ? `${joined.slice(0, MAX_RULES_CHARS)}${TRUNCATED_RULES_NOTE}`
      : joined;
  return `${basePrompt}\n\n${RULES_HEADING}\n${body}`;
};

const renderPatch = (file: ChangedFile): string =>
  file.patch === null
    ? `### ${file.path} (${file.status})\nNo diff available; read the file with read_file.`
    : `### ${file.path} (${file.status} +${file.additions} -${file.deletions})\n\`\`\`diff\n${file.patch}\n\`\`\``;

interface PatchSelection {
  text: string;
  omitted: string[];
}

const selectPatches = (
  files: readonly ChangedFile[],
  focusFiles: readonly string[],
  limitChars: number = MAX_PROMPT_PATCH_CHARS,
): PatchSelection => {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const parts: string[] = [];
  const omitted: string[] = [];
  let used = 0;
  for (const path of focusFiles) {
    const file = byPath.get(path);
    if (file === undefined) continue;
    const rendered = renderPatch(file);
    if (used + rendered.length > limitChars) {
      omitted.push(path);
    } else {
      used += rendered.length;
      parts.push(rendered);
    }
  }
  return { text: parts.join('\n\n'), omitted };
};

export const buildReviewPrompt = (
  pr: PullRequest,
  files: readonly ChangedFile[],
  focusFiles: readonly string[],
): string => {
  const patches = selectPatches(files, focusFiles);
  const sections = [
    wrapUntrusted('pull request title', pr.title),
    wrapUntrusted('pull request description', pr.body.slice(0, 4_000)),
    `Changed files: ${files.length}. Focus files below; the others are available through list_changed_files and read_file.`,
    wrapUntrusted('focus diffs', patches.text),
  ];
  if (patches.omitted.length > 0) {
    sections.push(
      `Diffs omitted for size, read them with read_file: ${patches.omitted.join(', ')}`,
    );
  }
  return sections.join('\n\n');
};
