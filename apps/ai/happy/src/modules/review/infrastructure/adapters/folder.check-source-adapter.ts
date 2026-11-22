import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { parse } from 'yaml';
import { z } from 'zod';

import { MAX_CHECK_BODY_WORDS } from '../../domain/constants/review-limits.constants';
import { FINDING_SEVERITIES } from '../../domain/constants/severity.constants';
import type { Check } from '../../domain/entities/check';
import { parseRuleReference } from '../../domain/policies/rule-section';
import type { CheckSourcePort } from '../../domain/ports/check-source.port';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
const CHECK_FILE_SUFFIX = '.md';
const WORDS = /\S+/g;
const SUMMARY_CHARS = 160;
export const REQUIRED_CHECK_SECTIONS: readonly string[] = [
  '## What to verify',
  '## Evidence required',
  '## Report only when',
  '## Do not report',
  '## Real bug example',
  '## Looks risky but fine',
];

const isRegex = (source: string): boolean => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
};

const frontmatterSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    paths: z.array(z.string().min(1)).min(1),
    triggers: z
      .array(z.string().min(1).refine(isRegex, 'not a valid regular expression'))
      .default([]),
    rule: z
      .string()
      .refine((value) => parseRuleReference(value) !== null, 'expected file.md or file.md#heading')
      .optional(),
    severity_cap: z.enum(FINDING_SEVERITIES),
  })
  .strict();

class CheckCatalogError extends Error {
  constructor(file: string, detail: string) {
    super(`Invalid check ${file}: ${detail}`);
    this.name = 'CheckCatalogError';
  }
}

const summaryOf = (body: string): string => {
  const section = body.split('## What to verify')[1] ?? '';
  const first = section
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('#'));
  return (first ?? '').slice(0, SUMMARY_CHARS);
};

const parseCheck = (file: string, area: string, content: string): Check => {
  const match = FRONTMATTER.exec(content);
  if (match === null) throw new CheckCatalogError(file, 'missing frontmatter');
  let raw: unknown;
  try {
    raw = parse(match[1] ?? '');
  } catch (error) {
    throw new CheckCatalogError(file, error instanceof Error ? error.message : 'unreadable yaml');
  }
  const parsed = frontmatterSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CheckCatalogError(
      file,
      parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; '),
    );
  }
  const body = (match[2] ?? '').trim();
  const missing = REQUIRED_CHECK_SECTIONS.filter((section) => !body.includes(section));
  if (missing.length > 0)
    throw new CheckCatalogError(file, `missing sections: ${missing.join(', ')}`);
  if ((body.match(WORDS)?.length ?? 0) > MAX_CHECK_BODY_WORDS) {
    throw new CheckCatalogError(file, `body is longer than ${MAX_CHECK_BODY_WORDS} words`);
  }
  if (path.basename(file, CHECK_FILE_SUFFIX) !== parsed.data.id) {
    throw new CheckCatalogError(file, 'id must equal the file name');
  }
  return {
    id: parsed.data.id,
    area,
    summary: summaryOf(body),
    paths: parsed.data.paths,
    triggers: parsed.data.triggers,
    rule: parsed.data.rule === undefined ? null : parseRuleReference(parsed.data.rule),
    severityCap: parsed.data.severity_cap,
    body,
  };
};

export class FolderCheckSourceAdapter implements CheckSourcePort {
  private constructor(private readonly checks: readonly Check[]) {}

  static async load(directory: string): Promise<FolderCheckSourceAdapter> {
    const areas = (await readdir(directory, { withFileTypes: true })).filter((entry) =>
      entry.isDirectory(),
    );
    const checks: Check[] = [];
    for (const area of areas) {
      const files = (await readdir(path.join(directory, area.name))).filter((name) =>
        name.endsWith(CHECK_FILE_SUFFIX),
      );
      for (const name of files.sort()) {
        const file = `${area.name}/${name}`;
        checks.push(
          parseCheck(
            file,
            area.name,
            await readFile(path.join(directory, area.name, name), 'utf8'),
          ),
        );
      }
    }
    const ids = checks.map((check) => check.id);
    const duplicate = ids.find((id, index) => ids.indexOf(id) !== index);
    if (duplicate !== undefined) throw new CheckCatalogError(duplicate, 'duplicate check id');
    return new FolderCheckSourceAdapter(
      checks.sort((left, right) => left.id.localeCompare(right.id)),
    );
  }

  list(): readonly Check[] {
    return this.checks;
  }
}
