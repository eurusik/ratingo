import { z } from 'zod';
import {
  RowList,
  ToolInputError,
  countRowsThatFit,
  defineTool,
  wrapUntrusted,
  type Tool,
} from '@ratingo/ai-core';

import {
  OutputBudgets,
  ReadLimits,
  SearchLimits,
  UNTRUSTED_CODE_LABEL,
} from '../../domain/constants/investigation.constants';
import { SnapshotLimits } from '../../domain/constants/snapshot.constants';
import type { CodeSnapshot } from '../../domain/entities/code-snapshot';
import type { EvidenceLedger } from '../../domain/policies/evidence-ledger';
import { resolveLineRange } from '../../domain/policies/line-range';
import { normalizeDirectoryPath, normalizeFilePath } from '../../domain/policies/repo-path';
import { SearchMode, compileSearchPattern } from '../../domain/policies/search-pattern';
import type { CodeBrowser, SearchMatch } from '../services/code-browser.service';

export const CODE_SEARCH_TOOL = 'code_search';
export const CODE_READ_TOOL = 'code_read';
export const CODE_LIST_TOOL = 'code_list';

const COVERAGE_TEXT =
  'Covers only the tracked text files of the one commit named in `commit`: source, config, docs, SQL migrations and workflow files. It does not cover git history, other branches or commits, untracked or ignored files, files made at build time (dist, node_modules, .env), binary files, files over ' +
  `${SnapshotLimits.MAX_FILE_BYTES / 1000} KB (for example package-lock.json) or files with a line over ${SnapshotLimits.MAX_LINE_CHARS} characters.`;

const SEARCH_DESCRIPTION = [
  'Search the repository line by line at one commit.',
  COVERAGE_TEXT,
  'text mode (default) finds the pattern as a substring of one line, ignoring case unless ignoreCase is false. regex mode accepts a safe subset only: literals, ".", character classes, \\d \\w \\s \\b, ^ $, "|", groups without a repeat on the group, repeats * + ? {n,m} with at most two open-ended ones, and it checks only lines up to ' +
    `${SearchLimits.MAX_REGEX_LINE_CHARS} characters (the reply counts the longer lines it did not check).`,
  `Returns whole matching lines as {path, line, text}, sorted by path then line, from at most ${SearchLimits.MAX_MATCHES_COLLECTED} matches. \`omitted\` and \`hint\` say how many matches did not fit in the reply and how to narrow the search (pathPrefix, extensions, a more specific pattern); \`coverage\` says how many files were searched.`,
  'An empty `matches` list means that no searched line contains the pattern. It does not prove the code lacks the behaviour: try other spellings or names, a related identifier, or code_list.',
  'A line returned here can be cited; use code_read for the lines around it.',
].join(' ');

const READ_DESCRIPTION = [
  'Read whole numbered lines of one file at the commit, from startLine to endLine (1-based, inclusive).',
  `Without a range it returns the first ${ReadLimits.DEFAULT_LINES} lines. At most ${ReadLimits.MAX_LINES_REQUESTED} lines can be requested; the reply is cut by whole lines to fit about ${OutputBudgets.READ_CHARS / 1000} KB and \`nextStartLine\` says where to continue.`,
  COVERAGE_TEXT,
  'A path that is not in the commit, or is skipped (binary, too large, minified), is an error that says why.',
  'Only lines returned by code_read or code_search can be cited in the final answer.',
].join(' ');

const LIST_DESCRIPTION = [
  'List one directory level of the commit, without going deeper: subdirectories first with the number of readable files below them, then files with their line counts. path "" is the repository root.',
  COVERAGE_TEXT,
  'A directory with no readable file below it is an error, so an empty result never occurs.',
].join(' ');

const untrustedOverhead = wrapUntrusted(UNTRUSTED_CODE_LABEL, '').length;

export interface CodeToolsDependencies {
  browser: CodeBrowser;
  snapshot: CodeSnapshot;
  ledger: EvidenceLedger;
}

const searchSchema = z.object({
  pattern: z
    .string()
    .min(1)
    .max(SearchLimits.MAX_PATTERN_CHARS)
    .describe('Text to find, or a regex in regex mode'),
  mode: z.enum([SearchMode.TEXT, SearchMode.REGEX]).default(SearchMode.TEXT),
  ignoreCase: z.boolean().default(true),
  pathPrefix: z
    .string()
    .max(SnapshotLimits.MAX_PATH_CHARS)
    .default('')
    .describe('Only files under this directory, for example "apps/api/src"'),
  extensions: z
    .array(z.string().min(1).max(SearchLimits.MAX_EXTENSION_CHARS))
    .max(8)
    .default([])
    .describe('Only files with one of these extensions, without the dot, for example ["ts"]'),
});

const readSchema = z.object({
  path: z.string().min(1).max(SnapshotLimits.MAX_PATH_CHARS),
  startLine: z.number().int().min(1).optional(),
  endLine: z.number().int().min(1).optional(),
});

const listSchema = z.object({
  path: z.string().max(SnapshotLimits.MAX_PATH_CHARS).default(''),
});

const invalidInput = (tool: string, message: string): ToolInputError =>
  new ToolInputError(tool, message);

const similarPaths = (snapshot: CodeSnapshot, path: string): string[] => {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  return snapshot
    .files()
    .filter((file) => file.path.slice(file.path.lastIndexOf('/') + 1).toLowerCase() === name)
    .slice(0, 5)
    .map((file) => file.path);
};

const missingFileMessage = (snapshot: CodeSnapshot, path: string): string => {
  const skipped = snapshot.skippedReasonOf(path);
  if (skipped !== undefined)
    return `"${path}" exists in commit ${snapshot.sha} but is not readable here: ${skipped}`;
  const similar = similarPaths(snapshot, path);
  return `"${path}" is not in commit ${snapshot.sha}.${similar.length > 0 ? ` Files with the same name: ${similar.join(', ')}.` : ' Use code_search or code_list to find the path.'}`;
};

const createSearchTool = ({ browser, snapshot, ledger }: CodeToolsDependencies): Tool =>
  defineTool({
    name: CODE_SEARCH_TOOL,
    description: SEARCH_DESCRIPTION,
    inputSchema: searchSchema,
    readOnly: true,
    maxOutputChars: OutputBudgets.SEARCH_CHARS,
    untrustedLabel: UNTRUSTED_CODE_LABEL,
    async handler(input) {
      const compiled = compileSearchPattern({
        pattern: input.pattern,
        mode: input.mode,
        ignoreCase: input.ignoreCase,
      });
      if (!compiled.ok) throw invalidInput(CODE_SEARCH_TOOL, compiled.message);
      const prefix = normalizeDirectoryPath(input.pathPrefix);
      if (!prefix.ok) throw invalidInput(CODE_SEARCH_TOOL, `pathPrefix rejected: ${prefix.reason}`);
      const outcome = await browser.search(snapshot, compiled.matcher, {
        pathPrefix: prefix.path,
        extensions: input.extensions.map((extension) => extension.replace(/^\./, '').toLowerCase()),
      });
      const hint =
        'Narrow the search with pathPrefix or extensions, or use a more specific pattern; code_read shows the lines around a match.';
      const list = RowList.of<SearchMatch>(outcome.matches, hint, (rows, omission) => ({
        commit: snapshot.sha,
        coverage: {
          filesInScope: outcome.filesInScope,
          filesSearched: outcome.filesSearched,
          longLinesNotChecked: outcome.longLinesNotChecked,
          matchesCapped: outcome.matchesCapped,
          stoppedForTime: outcome.stoppedForTime,
        },
        matches: rows,
        ...omission,
      }));
      const shown = countRowsThatFit(list, OutputBudgets.SEARCH_CHARS - untrustedOverhead);
      for (const match of outcome.matches.slice(0, shown))
        ledger.record(match.path, match.line, match.line);
      return list;
    },
  });

interface ReadFrame {
  snapshot: CodeSnapshot;
  path: string;
  totalLines: number;
  startLine: number;
  cappedByLimit: boolean;
}

const readFrame =
  (frame: ReadFrame) =>
  (rows: readonly string[], omission: unknown): unknown => {
    const lastShown = frame.startLine + rows.length - 1;
    return {
      commit: frame.snapshot.sha,
      path: frame.path,
      totalLines: frame.totalLines,
      startLine: frame.startLine,
      endLine: rows.length === 0 ? frame.startLine : lastShown,
      ...(omission !== undefined || frame.cappedByLimit ? { nextStartLine: lastShown + 1 } : {}),
      lines: rows,
    };
  };

const numberedLines = (lines: readonly string[], startLine: number, endLine: number): string[] =>
  lines.slice(startLine - 1, endLine).map((text, offset) => `${startLine + offset}: ${text}`);

const createReadTool = ({ browser, snapshot, ledger }: CodeToolsDependencies): Tool =>
  defineTool({
    name: CODE_READ_TOOL,
    description: READ_DESCRIPTION,
    inputSchema: readSchema,
    readOnly: true,
    maxOutputChars: OutputBudgets.READ_CHARS,
    untrustedLabel: UNTRUSTED_CODE_LABEL,
    isEmpty: () => false,
    async handler(input) {
      const path = normalizeFilePath(input.path);
      if (!path.ok) throw invalidInput(CODE_READ_TOOL, `path rejected: ${path.reason}`);
      const file = snapshot.fileAt(path.path);
      if (file === undefined)
        throw invalidInput(CODE_READ_TOOL, missingFileMessage(snapshot, path.path));
      const range = resolveLineRange(
        { startLine: input.startLine, endLine: input.endLine },
        file.lineCount,
      );
      if (!range.ok)
        throw invalidInput(
          CODE_READ_TOOL,
          `${path.path} has ${file.lineCount} lines: ${range.reason}`,
        );
      const read = await browser.read(snapshot, path.path);
      if (read === undefined)
        throw invalidInput(
          CODE_READ_TOOL,
          `${path.path} could not be read from commit ${snapshot.sha}`,
        );
      const list = RowList.of<string>(
        numberedLines(read.lines, range.startLine, range.endLine),
        '',
        readFrame({
          snapshot,
          path: path.path,
          totalLines: file.lineCount,
          startLine: range.startLine,
          cappedByLimit: range.cappedByLimit,
        }),
      );
      const shown = countRowsThatFit(list, OutputBudgets.READ_CHARS - untrustedOverhead);
      if (shown > 0) ledger.record(path.path, range.startLine, range.startLine + shown - 1);
      return list;
    },
  });

const createListTool = ({ browser, snapshot }: CodeToolsDependencies): Tool =>
  defineTool({
    name: CODE_LIST_TOOL,
    description: LIST_DESCRIPTION,
    inputSchema: listSchema,
    readOnly: true,
    maxOutputChars: OutputBudgets.LIST_CHARS,
    untrustedLabel: UNTRUSTED_CODE_LABEL,
    handler(input) {
      const directory = normalizeDirectoryPath(input.path);
      if (!directory.ok) throw invalidInput(CODE_LIST_TOOL, `path rejected: ${directory.reason}`);
      const listing = browser.list(snapshot, directory.path);
      if (listing.entries.length === 0) {
        const reason =
          snapshot.fileAt(directory.path) === undefined
            ? 'not a directory with readable files'
            : 'a file, not a directory';
        throw invalidInput(
          CODE_LIST_TOOL,
          `"${directory.path}" is ${reason} in commit ${snapshot.sha}. List its parent to see what exists.`,
        );
      }
      return Promise.resolve(
        RowList.of(listing.entries, 'Use a deeper path to see the rest.', (rows, omission) => ({
          commit: snapshot.sha,
          path: directory.path,
          entries: rows,
          ...omission,
          ...(listing.tooMany ? { entriesBeyondListLimit: true } : {}),
        })),
      );
    },
  });

export const createCodeTools = (dependencies: CodeToolsDependencies): Tool[] => [
  createSearchTool(dependencies),
  createReadTool(dependencies),
  createListTool(dependencies),
];
