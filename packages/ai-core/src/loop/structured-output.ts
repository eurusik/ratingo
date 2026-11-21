import type { ZodType } from 'zod';
import type { ResponseSchema } from '../model/model.types';
import { formatZodIssues } from '../schema/format-zod-issues';
import { zodToJsonSchema } from '../schema/zod-json-schema';

export type StructuredOutputOutcome = { ok: true; value: unknown } | { ok: false; issues: string };

export const NOT_JSON_ISSUE = 'the reply is not valid JSON';

const JSON_FENCE_PATTERN = /^```(?:json)?\s*([\s\S]*?)\s*```$/;

export function toResponseSchema(name: string, schema: ZodType): ResponseSchema {
  return { name, jsonSchema: zodToJsonSchema(schema) };
}

function parseJson(text: string): { ok: true; value: unknown } | { ok: false } {
  const trimmed = text.trim();
  const json = JSON_FENCE_PATTERN.exec(trimmed)?.[1] ?? trimmed;
  try {
    return { ok: true, value: JSON.parse(json) };
  } catch {
    return { ok: false };
  }
}

export function validateStructuredOutput(schema: ZodType, text: string): StructuredOutputOutcome {
  const json = parseJson(text);
  if (!json.ok) {
    return { ok: false, issues: NOT_JSON_ISSUE };
  }
  const parsed = schema.safeParse(json.value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, issues: formatZodIssues(parsed.error).join('; ') };
}

export function buildRepairPrompt(issues: string): string {
  return `Your previous reply did not match the required JSON schema: ${issues}. Reply again with only the corrected JSON.`;
}
