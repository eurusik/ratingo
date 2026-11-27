import { z } from 'zod';

export const jobFailuresInput = z.object({
  job: z
    .string()
    .optional()
    .describe('Part of a job or scheduler name such as sync-show or trending'),
  queue: z.string().optional().describe('Queue name such as ingestion or stats-queue'),
  window: z
    .string()
    .optional()
    .describe('How far back to look, such as 6h, 24h or 7d (at most 7d). Default 24h'),
});

export type JobFailuresInput = z.infer<typeof jobFailuresInput>;
