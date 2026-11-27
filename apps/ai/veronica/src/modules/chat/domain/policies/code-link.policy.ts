import { GITHUB_WEB_ORIGIN } from '../constants/dume.constants';
import type { DumeCitation } from '../entities/dume';

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const MAX_PATH_CHARS = 300;
const BACKSLASH = 92;
const FIRST_PRINTABLE = 32;
const FIRST_C1_CONTROL = 127;
const LAST_C1_CONTROL = 159;
const RESERVED_SEGMENTS: readonly string[] = ['', '.', '..'];
const SUB_DELIMITERS = /[!'()*]/g;

export const isCommitSha = (value: string): boolean => COMMIT_PATTERN.test(value);

const encodeSegment = (segment: string): string =>
  encodeURIComponent(segment).replace(
    SUB_DELIMITERS,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const isForbiddenPathCharacter = (character: string): boolean => {
  const code = character.charCodeAt(0);
  return (
    code === BACKSLASH ||
    code < FIRST_PRINTABLE ||
    (code >= FIRST_C1_CONTROL && code <= LAST_C1_CONTROL)
  );
};

const isLinkablePath = (path: string): boolean =>
  path.length > 0 &&
  path.length <= MAX_PATH_CHARS &&
  ![...path].some(isForbiddenPathCharacter) &&
  !path.split('/').some((segment) => RESERVED_SEGMENTS.includes(segment));

export const codeLink = (
  repository: string,
  commit: string,
  citation: DumeCitation,
): string | null => {
  const { path, startLine, endLine } = citation;
  const valid =
    REPOSITORY_PATTERN.test(repository) &&
    COMMIT_PATTERN.test(commit) &&
    isLinkablePath(path) &&
    Number.isInteger(startLine) &&
    Number.isInteger(endLine) &&
    startLine >= 1 &&
    endLine >= startLine;
  if (!valid) return null;
  const lines = endLine === startLine ? `L${startLine}` : `L${startLine}-L${endLine}`;
  const encodedPath = path.split('/').map(encodeSegment).join('/');
  return `${GITHUB_WEB_ORIGIN}/${repository}/blob/${commit}/${encodedPath}#${lines}`;
};
