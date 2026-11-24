import { sanitizeJsonSchema } from '../../../schema/json-schema-sanitizer';
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

function isUnsupported(keyword: string, value: unknown): boolean {
  if (UNSUPPORTED_KEYWORDS.has(keyword)) {
    return true;
  }
  return keyword === MIN_ITEMS && typeof value === 'number' && value > MAX_SUPPORTED_MIN_ITEMS;
}

export function sanitizeStructuredOutputSchema(schema: JsonSchema): JsonSchema {
  return sanitizeJsonSchema(schema, { drop: isUnsupported });
}
