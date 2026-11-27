import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

import { z } from 'zod';

import { BASELINE_VERSION, type Baseline } from './baseline-diff';

const JSON_INDENT = 2;
const NOT_FOUND_CODE = 'ENOENT';

const baselineEntrySchema = z.object({
  passes: z.number().int().min(0),
  runs: z.number().int().min(1),
  passed: z.boolean(),
  flaky: z.boolean(),
});

const baselineSchema = z.object({
  version: z.literal(BASELINE_VERSION),
  savedAtMs: z.number(),
  model: z.string().min(1),
  judgeModel: z.string().min(1),
  runs: z.number().int().min(1),
  passAt: z.number().int().min(1),
  cases: z.record(z.string(), baselineEntrySchema),
});

export class InvalidBaselineError extends Error {
  constructor(file: string, issues: string) {
    super(`The baseline at ${file} is not valid: ${issues}`);
    this.name = 'InvalidBaselineError';
  }
}

export const readBaselineFile = async (file: string): Promise<Baseline | null> => {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === NOT_FOUND_CODE) return null;
    throw error;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new InvalidBaselineError(file, 'it is not JSON');
  }
  const parsed = baselineSchema.safeParse(json);
  if (!parsed.success) {
    throw new InvalidBaselineError(
      file,
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    );
  }
  return parsed.data;
};

export const writeBaselineFile = async (file: string, baseline: Baseline): Promise<void> => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(baseline, null, JSON_INDENT)}\n`);
};
