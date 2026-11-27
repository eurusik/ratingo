import { SnapshotLimits } from '../constants/snapshot.constants';

export const PathRejection = {
  EMPTY: 'empty',
  TOO_LONG: 'too_long',
  TOO_DEEP: 'too_deep',
  ABSOLUTE: 'absolute',
  PARENT_SEGMENT: 'parent_segment',
  FORBIDDEN_CHARACTER: 'forbidden_character',
  GIT_METADATA: 'git_metadata',
} as const;
export type PathRejection = (typeof PathRejection)[keyof typeof PathRejection];

export type RepoPathResult = { ok: true; path: string } | { ok: false; reason: PathRejection };

const SEPARATOR = '/';
const CURRENT_SEGMENT = '.';
const PARENT_SEGMENT = '..';
const GIT_SEGMENT = '.git';
const BACKSLASH = '\\';
const LAST_CONTROL_CODE = 31;
const DELETE_CODE = 127;

const hasForbiddenCharacter = (text: string): boolean =>
  [...text].some((char) => {
    const code = char.charCodeAt(0);
    return code <= LAST_CONTROL_CODE || code === DELETE_CODE || char === BACKSLASH;
  });

const reject = (reason: PathRejection): RepoPathResult => ({ ok: false, reason });

const normalizeRepoPath = (raw: string, options: { allowRoot: boolean }): RepoPathResult => {
  if (raw.length > SnapshotLimits.MAX_PATH_CHARS) return reject(PathRejection.TOO_LONG);
  if (hasForbiddenCharacter(raw)) return reject(PathRejection.FORBIDDEN_CHARACTER);
  if (raw.startsWith(SEPARATOR)) return reject(PathRejection.ABSOLUTE);
  const segments = raw
    .split(SEPARATOR)
    .map((segment) => segment.trim())
    .filter((segment) => segment !== '' && segment !== CURRENT_SEGMENT);
  if (segments.includes(PARENT_SEGMENT)) return reject(PathRejection.PARENT_SEGMENT);
  if (segments.includes(GIT_SEGMENT)) return reject(PathRejection.GIT_METADATA);
  if (segments.length > SnapshotLimits.MAX_PATH_SEGMENTS) return reject(PathRejection.TOO_DEEP);
  if (segments.length === 0 && !options.allowRoot) return reject(PathRejection.EMPTY);
  return { ok: true, path: segments.join(SEPARATOR) };
};

export const normalizeFilePath = (raw: string): RepoPathResult =>
  normalizeRepoPath(raw, { allowRoot: false });

export const normalizeDirectoryPath = (raw: string): RepoPathResult =>
  normalizeRepoPath(raw, { allowRoot: true });

export const extensionOf = (path: string): string => {
  const name = path.slice(path.lastIndexOf(SEPARATOR) + 1);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
};

export const isUnderDirectory = (path: string, directory: string): boolean =>
  directory === '' || path === directory || path.startsWith(`${directory}${SEPARATOR}`);
