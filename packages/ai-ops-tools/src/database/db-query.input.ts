import { z } from 'zod';

export const dbQueryInput = z.object({
  sql: z
    .string()
    .describe(
      'One SELECT or WITH statement in PostgreSQL syntax, without a trailing second statement',
    ),
  explain: z
    .boolean()
    .optional()
    .describe('true returns the query plan without running the query. Default false'),
});

export type DbQueryInput = z.infer<typeof dbQueryInput>;
