import { GITHUB_WEB_ORIGIN } from '../constants/dume.constants';
import type { DumeCitation } from '../entities/dume';

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const PATH_PATTERN = /^[A-Za-z0-9_.@+-]+(?:\/[A-Za-z0-9_.@+-]+)*$/;
const PARENT_SEGMENT = '..';

export const isCommitSha = (value: string): boolean => COMMIT_PATTERN.test(value);

export const codeLink = (
  repository: string,
  commit: string,
  citation: DumeCitation,
): string | null => {
  const { path, startLine, endLine } = citation;
  const valid =
    REPOSITORY_PATTERN.test(repository) &&
    COMMIT_PATTERN.test(commit) &&
    PATH_PATTERN.test(path) &&
    !path.split('/').includes(PARENT_SEGMENT) &&
    Number.isInteger(startLine) &&
    Number.isInteger(endLine) &&
    startLine >= 1 &&
    endLine >= startLine;
  if (!valid) return null;
  const lines = endLine === startLine ? `L${startLine}` : `L${startLine}-L${endLine}`;
  return `${GITHUB_WEB_ORIGIN}/${repository}/blob/${commit}/${path}#${lines}`;
};
