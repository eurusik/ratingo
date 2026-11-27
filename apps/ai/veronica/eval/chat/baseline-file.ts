import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { parseBaseline, type Baseline } from './baseline';

const JSON_INDENT = 2;

const isMissingFile = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

export const readBaselineFile = async (path: string): Promise<Baseline | null> => {
  try {
    return parseBaseline(await readFile(path, 'utf8'));
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
};

export const writeBaselineFile = async (path: string, baseline: Baseline): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(baseline, null, JSON_INDENT)}\n`);
};
