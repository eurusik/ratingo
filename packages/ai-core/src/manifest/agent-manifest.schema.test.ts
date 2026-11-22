import {
  DEFAULT_CALL_TIMEOUT_MS,
  DEFAULT_MAX_TOKENS_PER_CALL,
  DEFAULT_MAX_TURNS,
  DEFAULT_RUN_TIMEOUT_MS,
  agentManifestSchema,
} from './agent-manifest.schema';
import { taskFrontmatterSchema } from './task.schema';

const validManifest = {
  name: 'veronica',
  models: { default: 'fast' },
  tools: ['prom_query'],
  skills: ['ratingo-queues'],
  mcp: [],
  budgets: { perRunUsd: 0.05, perDayUsd: 0.5 },
};

describe('agentManifestSchema', () => {
  it('accepts the manifest from the architecture decision record', () => {
    expect(agentManifestSchema.safeParse(validManifest).success).toBe(true);
  });

  it('fills limits and list defaults', () => {
    const parsed = agentManifestSchema.parse({
      name: 'happy',
      models: { default: 'review' },
      budgets: { perRunUsd: 1, perDayUsd: 5 },
    });

    expect(parsed.tools).toEqual([]);
    expect(parsed.limits).toEqual({
      maxTurns: DEFAULT_MAX_TURNS,
      timeoutMs: DEFAULT_RUN_TIMEOUT_MS,
      maxTokensPerCall: DEFAULT_MAX_TOKENS_PER_CALL,
      callTimeoutMs: DEFAULT_CALL_TIMEOUT_MS,
    });
  });

  it.each([
    ['an unknown key', { ...validManifest, tooling: [] }],
    ['a bad name', { ...validManifest, name: 'Veronica Bot' }],
    ['no default model', { ...validManifest, models: { review: 'review' } }],
    ['a non-positive budget', { ...validManifest, budgets: { perRunUsd: 0, perDayUsd: 1 } }],
    ['a missing day budget', { ...validManifest, budgets: { perRunUsd: 1 } }],
    [
      'an unknown budget key',
      { ...validManifest, budgets: { perRunUsd: 1, perDayUsd: 1, perYearUsd: 9 } },
    ],
    ['a path-like skill name', { ...validManifest, skills: ['../escape'] }],
    ['a fractional turn limit', { ...validManifest, limits: { maxTurns: 1.5 } }],
  ])('rejects %s', (_label, manifest) => {
    expect(agentManifestSchema.safeParse(manifest).success).toBe(false);
  });
});

describe('taskFrontmatterSchema', () => {
  it('accepts the task from the architecture decision record', () => {
    const parsed = taskFrontmatterSchema.safeParse({
      schedule: '0 9 * * *',
      timezone: 'Europe/Kyiv',
      model: 'fast',
      budgetUsd: 0.02,
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts an unscheduled task', () => {
    expect(taskFrontmatterSchema.safeParse({}).success).toBe(true);
  });

  it.each([
    ['a schedule without timezone', { schedule: '0 9 * * *' }],
    ['a cron with garbage fields', { schedule: 'a b c d !', timezone: 'Europe/Kyiv' }],
    ['a cron with the wrong field count', { schedule: '0 9 * *', timezone: 'Europe/Kyiv' }],
    ['an unknown timezone', { schedule: '0 9 * * *', timezone: 'Mars/Olympus' }],
    ['a negative budget', { budgetUsd: -1 }],
    ['an unknown key', { cron: '0 9 * * *' }],
  ])('rejects %s', (_label, frontmatter) => {
    expect(taskFrontmatterSchema.safeParse(frontmatter).success).toBe(false);
  });
});
