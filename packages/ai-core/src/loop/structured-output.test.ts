import { z } from 'zod';
import {
  NOT_JSON_ISSUE,
  buildRepairPrompt,
  toResponseSchema,
  validateStructuredOutput,
} from './structured-output';

const schema = z.object({ headline: z.string(), actions: z.array(z.string()) });

describe('structured output', () => {
  it('accepts valid JSON', () => {
    expect(validateStructuredOutput(schema, '{"headline":"ok","actions":[]}')).toEqual({
      ok: true,
      value: { headline: 'ok', actions: [] },
    });
  });

  it('accepts JSON wrapped in a code fence', () => {
    const outcome = validateStructuredOutput(
      schema,
      '```json\n{"headline":"ok","actions":["a"]}\n```',
    );
    expect(outcome).toEqual({ ok: true, value: { headline: 'ok', actions: ['a'] } });
  });

  it('reports text that is not JSON', () => {
    expect(validateStructuredOutput(schema, 'sure, here you go')).toEqual({
      ok: false,
      issues: NOT_JSON_ISSUE,
    });
  });

  it('lists the schema violations', () => {
    expect(validateStructuredOutput(schema, '{"headline":1}')).toMatchObject({
      ok: false,
      issues: expect.stringMatching(/headline.*actions/s),
    });
  });

  it('builds a JSON schema without the $schema marker', () => {
    const responseSchema = toResponseSchema('digest', schema);
    expect(responseSchema.name).toBe('digest');
    expect(responseSchema.jsonSchema).toMatchObject({ type: 'object' });
    expect(responseSchema.jsonSchema).not.toHaveProperty('$schema');
  });

  it('puts the violations into the repair prompt', () => {
    expect(buildRepairPrompt('headline: required')).toContain('headline: required');
  });
});
