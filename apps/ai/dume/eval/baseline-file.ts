import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { BASELINE_VERSION, type Baseline } from './baseline-diff';

const JSON_INDENT = 2;
const NOT_FOUND_CODE = 'ENOENT';

export const readBaselineFile = async (file: string): Promise<Baseline | null> => {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as Baseline;
    if (parsed.version !== BASELINE_VERSION)
      throw new Error(`Unsupported baseline version ${String(parsed.version)} in ${file}`);
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === NOT_FOUND_CODE) return null;
    throw error;
  }
};

export const writeBaselineFile = async (file: string, baseline: Baseline): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(baseline, null, JSON_INDENT)}\n`);
};
