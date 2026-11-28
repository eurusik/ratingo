import { z } from 'zod';

export const dbSchemaInput = z.object({
  table: z
    .string()
    .optional()
    .describe(
      'Part of a table name such as saved or media. Without it, every readable table is listed with its column names; with it, the matching tables are listed with column types',
    ),
});

export type DbSchemaInput = z.infer<typeof dbSchemaInput>;
