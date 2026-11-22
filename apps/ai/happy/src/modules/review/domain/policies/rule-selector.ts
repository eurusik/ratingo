import type { RepoRuleFile } from '../entities/pull-request';

import { matchesAnyGlob } from './glob-match';

export interface RepoRule {
  name: string;
  path: string;
  scopes: string[];
  body: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const PATHS_KEY = /^paths\s*:\s*$/;
const LIST_ITEM = /^\s*-\s*["']?(.+?)["']?\s*$/;
const TOP_LEVEL_KEY = /^\S/;
const RULE_FILE_EXTENSION = /\.md$/;

const parseScopes = (frontmatter: string): string[] => {
  const scopes: string[] = [];
  let inPaths = false;
  for (const line of frontmatter.split(/\r?\n/)) {
    if (PATHS_KEY.test(line)) {
      inPaths = true;
    } else if (inPaths && TOP_LEVEL_KEY.test(line)) {
      inPaths = false;
    } else if (inPaths) {
      const item = LIST_ITEM.exec(line)?.[1];
      if (item !== undefined) scopes.push(item);
    }
  }
  return scopes;
};

const ruleName = (path: string): string =>
  (path.split('/').pop() ?? path).replace(RULE_FILE_EXTENSION, '');

export const parseRule = (file: RepoRuleFile): RepoRule => {
  const match = FRONTMATTER.exec(file.content);
  return {
    name: ruleName(file.path),
    path: file.path,
    scopes: match === null ? [] : parseScopes(match[1] ?? ''),
    body: (match === null ? file.content : (match[2] ?? '')).trim(),
  };
};

export const selectRules = (
  rules: readonly RepoRule[],
  focusFiles: readonly string[],
  topics: readonly string[] = [],
): RepoRule[] => {
  const wanted = new Set(topics.map((topic) => topic.toLowerCase()));
  return rules.filter(
    (rule) =>
      rule.scopes.length === 0 ||
      wanted.has(rule.name.toLowerCase()) ||
      focusFiles.some((file) => matchesAnyGlob(rule.scopes, file)),
  );
};

export const findRulesByTopic = (rules: readonly RepoRule[], topic: string): RepoRule[] => {
  const needle = topic.trim().toLowerCase();
  return rules.filter(
    (rule) =>
      needle.length > 0 &&
      (rule.name.toLowerCase().includes(needle) || rule.body.toLowerCase().includes(needle)),
  );
};
