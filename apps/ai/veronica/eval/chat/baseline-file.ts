import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { z } from 'zod';

import { BASELINE_VERSION, type Baseline } from './baseline';

const JSON_INDENT = 2;

const baselineEntrySchema = z.object({
  passes: z.number().int().min(0),
  runs: z.number().int().min(1),
  passed: z.boolean(),
  flaky: z.boolean(),
});

const baselineSchema = z.object({
  version: z.literal(BASELINE_VERSION),
  savedAtMs: z.number().int(),
  model: z.string(),
  judgeModel: z.string(),
  runs: z.number().int().min(1),
  passAt: z.number().int().min(1),
  cases: z.record(z.string(), baselineEntrySchema),
});

export class InvalidBaselineError extends Error {
  constructor(reason: string) {
    super(`The baseline file is not usable: ${reason}`);
    this.name = 'InvalidBaselineError';
  }
}

export const parseBaseline = (json: string): Baseline => {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new InvalidBaselineError('it is not valid JSON');
  }
  const parsed = baselineSchema.safeParse(raw);
  if (!parsed.success) {
    throw new InvalidBaselineError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
};

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
