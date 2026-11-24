import { z } from 'zod';

import { defineTool, type Tool } from '@ratingo/ai-core';

import {
  MAX_READ_FILE_BYTES,
  MAX_READ_FILE_LINES,
} from '../../domain/constants/review-limits.constants';
import type { ChangedFile, PullRequest } from '../../domain/entities/pull-request';
import { isSafePath } from '../../domain/policies/safe-path';
import type { RepoRule } from '../../domain/policies/rule-selector';
import { findRulesByTopic } from '../../domain/policies/rule-selector';
import type { CodeHostPort } from '../../domain/ports/code-host.port';

const FileRef = { BASE: 'base', HEAD: 'head' } as const;
const RULE_BODY_PREVIEW_CHARS = 6_000;
const TOOL_OUTPUT_CAP_CHARS = 24_000;

export interface ReviewToolContext {
  host: CodeHostPort;
  pr: PullRequest;
  files: readonly ChangedFile[];
  rules: readonly RepoRule[];
}

const numberLines = (content: string, start: number, end: number): string =>
  content
    .split('\n')
    .slice(start - 1, end)
    .map((line, offset) => `${start + offset}: ${line}`)
    .join('\n');

const createReadFileTool = ({ host, pr }: ReviewToolContext): Tool =>
  defineTool({
    name: 'read_file',
    description: `Read a file from the repository, with line numbers. ref "head" is the PR branch, ref "base" is the target branch before the PR. At most ${MAX_READ_FILE_LINES} lines per call.`,
    readOnly: true,
    maxOutputChars: TOOL_OUTPUT_CAP_CHARS,
    inputSchema: z.object({
      path: z.string().min(1).max(300),
      ref: z.enum([FileRef.BASE, FileRef.HEAD]).default(FileRef.HEAD),
      startLine: z.number().int().min(1).default(1),
      endLine: z.number().int().min(1).optional(),
    }),
    handler: async ({ path, ref, startLine, endLine }) => {
      if (!isSafePath(path)) {
        return 'This path cannot be read.';
      }
      const sha = ref === FileRef.BASE ? pr.baseSha : pr.headSha;
      const content = await host.readFile(pr.ref, path, sha, { maxBytes: MAX_READ_FILE_BYTES });
      if (content === null) {
        return `File ${path} does not exist at ${ref}.`;
      }
      const lastAllowed = startLine + MAX_READ_FILE_LINES - 1;
      return numberLines(content, startLine, Math.min(endLine ?? lastAllowed, lastAllowed));
    },
  });

const createListChangedFilesTool = ({ files }: ReviewToolContext): Tool =>
  defineTool({
    name: 'list_changed_files',
    description: 'List every file changed by the pull request with its status and line counts.',
    readOnly: true,
    inputSchema: z.object({}),
    handler: async () =>
      files
        .map((file) => `${file.status} ${file.path} +${file.additions} -${file.deletions}`)
        .join('\n'),
  });

const createGetRulesTool = ({ rules }: ReviewToolContext): Tool =>
  defineTool({
    name: 'get_rules',
    description:
      'Look up the repository rules (CLAUDE.md and .claude/rules) from the base branch by topic, for example "migrations" or "domain layer".',
    readOnly: true,
    maxOutputChars: TOOL_OUTPUT_CAP_CHARS,
    inputSchema: z.object({ topic: z.string().min(1).max(100) }),
    handler: async ({ topic }) => {
      const matches = findRulesByTopic(rules, topic);
      return matches.length === 0
        ? `No rule mentions "${topic}".`
        : matches
            .map((rule) => `## ${rule.path}\n${rule.body.slice(0, RULE_BODY_PREVIEW_CHARS)}`)
            .join('\n\n');
    },
  });

export const createReviewTools = (context: ReviewToolContext): Tool[] => [
  createReadFileTool(context),
  createListChangedFilesTool(context),
  createGetRulesTool(context),
];
