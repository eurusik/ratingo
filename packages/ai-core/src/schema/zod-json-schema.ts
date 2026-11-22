import { z } from 'zod';
import type { ZodType } from 'zod';
import type { JsonSchema } from '../model/model.types';

export function zodToJsonSchema(schema: ZodType): JsonSchema {
  const { $schema: _schemaUri, ...jsonSchema } = z.toJSONSchema(schema) as JsonSchema;
  return jsonSchema;
}
