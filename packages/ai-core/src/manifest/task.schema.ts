import { z } from 'zod';

const CRON_FIELD_COUNT = 5;
const CRON_FIELD_PATTERN = /^[0-9A-Za-z*/,?-]+$/;

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

const cronExpression = z.string().refine(
  (value) => {
    const fields = value.trim().split(/\s+/);
    return (
      fields.length === CRON_FIELD_COUNT && fields.every((field) => CRON_FIELD_PATTERN.test(field))
    );
  },
  { message: `schedule must be a cron expression with ${CRON_FIELD_COUNT} valid fields` },
);

export const taskFrontmatterSchema = z
  .strictObject({
    schedule: cronExpression.optional(),
    timezone: z.string().refine(isValidTimezone, { message: 'unknown IANA timezone' }).optional(),
    model: z.string().min(1).optional(),
    budgetUsd: z.number().positive().optional(),
    maxTurns: z.number().int().positive().optional(),
  })
  .refine((task) => task.schedule === undefined || task.timezone !== undefined, {
    message: 'a scheduled task must set timezone explicitly',
    path: ['timezone'],
  });

export type TaskFrontmatter = z.infer<typeof taskFrontmatterSchema>;
