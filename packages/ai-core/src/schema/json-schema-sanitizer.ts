import type { JsonSchema } from '../model/model.types';

type JsonSchemaKeywordFilter = (keyword: string, value: unknown) => boolean;
type JsonSchemaValueMapper = (keyword: string, value: unknown) => unknown;

export interface JsonSchemaSanitizerRules {
  drop: JsonSchemaKeywordFilter;
  mapValue?: JsonSchemaValueMapper;
}

const SCHEMA_MAP_KEYWORDS: ReadonlySet<string> = new Set([
  'properties',
  'patternProperties',
  '$defs',
  'definitions',
]);

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function sanitizeNode(node: unknown, rules: JsonSchemaSanitizerRules): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => sanitizeNode(item, rules));
  }
  if (!isRecord(node)) {
    return node;
  }
  return Object.fromEntries(
    Object.entries(node)
      .filter(([keyword, value]) => !rules.drop(keyword, value))
      .map(([keyword, value]) => [keyword, sanitizeValue(keyword, value, rules)]),
  );
}

function sanitizeValue(keyword: string, value: unknown, rules: JsonSchemaSanitizerRules): unknown {
  if (SCHEMA_MAP_KEYWORDS.has(keyword) && isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([name, sub]) => [name, sanitizeNode(sub, rules)]),
    );
  }
  const mapped = rules.mapValue === undefined ? value : rules.mapValue(keyword, value);
  return sanitizeNode(mapped, rules);
}

export function sanitizeJsonSchema(
  schema: JsonSchema,
  rules: JsonSchemaSanitizerRules,
): JsonSchema {
  return sanitizeNode(schema, rules) as JsonSchema;
}
