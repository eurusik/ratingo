import type { JsonSchema } from '../../model.types';

const UNSUPPORTED_KEYWORDS: ReadonlySet<string> = new Set([
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'maxItems',
  'minProperties',
  'maxProperties',
]);

const MAX_SUPPORTED_MIN_ITEMS = 1;
const MIN_ITEMS = 'minItems';
const SCHEMA_MAP_KEYWORDS: ReadonlySet<string> = new Set([
  'properties',
  'patternProperties',
  '$defs',
  'definitions',
]);

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function sanitizeValue(keyword: string, value: unknown): unknown {
  if (SCHEMA_MAP_KEYWORDS.has(keyword) && isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([name, sub]) => [name, sanitizeNode(sub)]),
    );
  }
  return sanitizeNode(value);
}

function isUnsupported(keyword: string, value: unknown): boolean {
  if (UNSUPPORTED_KEYWORDS.has(keyword)) {
    return true;
  }
  return keyword === MIN_ITEMS && typeof value === 'number' && value > MAX_SUPPORTED_MIN_ITEMS;
}

function sanitizeNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(sanitizeNode);
  }
  if (!isRecord(node)) {
    return node;
  }
  return Object.fromEntries(
    Object.entries(node)
      .filter(([keyword, value]) => !isUnsupported(keyword, value))
      .map(([keyword, value]) => [keyword, sanitizeValue(keyword, value)]),
  );
}

export function sanitizeStructuredOutputSchema(schema: JsonSchema): JsonSchema {
  return sanitizeNode(schema) as JsonSchema;
}
