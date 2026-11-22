import { SENSITIVE_PATH_PATTERNS } from '../constants/skip-patterns.constants';

import { matchesAnyGlob } from './glob-match';

export const isSafePath = (path: string): boolean =>
  !path.startsWith('/') &&
  !path.split('/').includes('..') &&
  !matchesAnyGlob(SENSITIVE_PATH_PATTERNS, path);
