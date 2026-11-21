import { z } from 'zod';

const AGENT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const DEFAULT_MODEL_KEY = 'default';
export const DEFAULT_MAX_TURNS = 8;
export const DEFAULT_RUN_TIMEOUT_MS = 120_000;
export const DEFAULT_MAX_TOKENS_PER_CALL = 4_096;
export const DEFAULT_CALL_TIMEOUT_MS = 60_000;

const positiveUsd = z.number().positive();
const positiveInt = z.number().int().positive();
const NAME_ENTRY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const nameList = z.array(z.string().regex(NAME_ENTRY_PATTERN)).default([]);

const limitsSchema = z.strictObject({
  maxTurns: positiveInt.default(DEFAULT_MAX_TURNS),
  timeoutMs: positiveInt.default(DEFAULT_RUN_TIMEOUT_MS),
  maxTokensPerCall: positiveInt.default(DEFAULT_MAX_TOKENS_PER_CALL),
  callTimeoutMs: positiveInt.default(DEFAULT_CALL_TIMEOUT_MS),
});

export const agentManifestSchema = z.strictObject({
  name: z.string().regex(AGENT_NAME_PATTERN),
  models: z
    .record(z.string().min(1), z.string().min(1))
    .refine((models) => DEFAULT_MODEL_KEY in models, {
      message: `models must define "${DEFAULT_MODEL_KEY}"`,
    }),
  tools: nameList,
  skills: nameList,
  mcp: nameList,
  budgets: z.strictObject({
    perRunUsd: positiveUsd,
    perDayUsd: positiveUsd,
    perTaskUsd: positiveUsd.optional(),
    perCallUsd: positiveUsd.optional(),
  }),
  limits: limitsSchema.prefault({}),
});

export type AgentManifest = z.infer<typeof agentManifestSchema>;
