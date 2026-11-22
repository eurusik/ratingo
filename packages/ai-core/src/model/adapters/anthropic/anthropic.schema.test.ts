import * as fc from 'fast-check';
import { z } from 'zod';
import { zodToJsonSchema } from '../../../schema/zod-json-schema';
import type { JsonSchema } from '../../model.types';
import { sanitizeStructuredOutputSchema } from './anthropic.schema';

const UNSUPPORTED = [
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
];

const digestReplySchema = z.object({
  headline: z.string().min(1).max(80),
  actions: z.array(z.object({ id: z.string(), text: z.string().min(1).max(200) })).max(20),
  interesting: z.string().min(1).max(200).optional(),
  score: z.number().int().min(0).max(10).optional(),
  tags: z.array(z.string()).min(2).optional(),
});

function collectKeywords(node: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) {
    node.forEach((child) => collectKeywords(child, found));
  } else if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      found.add(key);
      collectKeywords(value, found);
    }
  }
  return found;
}

describe('sanitizeStructuredOutputSchema', () => {
  it('strips every unsupported keyword from the digest reply schema', () => {
    const sanitized = sanitizeStructuredOutputSchema(zodToJsonSchema(digestReplySchema));

    const keywords = collectKeywords(sanitized);
    for (const keyword of UNSUPPORTED) {
      expect(keywords.has(keyword)).toBe(false);
    }
    expect(collectKeywords(sanitized).has('minItems')).toBe(false);
  });

  it('keeps structure, types, required and additionalProperties', () => {
    const sanitized = sanitizeStructuredOutputSchema(zodToJsonSchema(digestReplySchema));

    expect(sanitized).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'actions'],
      properties: {
        headline: { type: 'string' },
        actions: { type: 'array', items: { type: 'object', additionalProperties: false } },
      },
    });
  });

  it('keeps minItems of 0 or 1 and drops larger values', () => {
    const sanitized = sanitizeStructuredOutputSchema({
      type: 'object',
      properties: {
        one: { type: 'array', minItems: 1, items: { type: 'string' } },
        zero: { type: 'array', minItems: 0, items: { type: 'string' } },
        many: { type: 'array', minItems: 3, items: { type: 'string' } },
      },
    });

    expect(sanitized).toEqual({
      type: 'object',
      properties: {
        one: { type: 'array', minItems: 1, items: { type: 'string' } },
        zero: { type: 'array', minItems: 0, items: { type: 'string' } },
        many: { type: 'array', items: { type: 'string' } },
      },
    });
  });

  it('does not treat a property named like a keyword as a constraint', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { maxItems: { type: 'string', maxLength: 5 }, minimum: { type: 'number' } },
      required: ['maxItems'],
    };

    expect(sanitizeStructuredOutputSchema(schema)).toEqual({
      type: 'object',
      properties: { maxItems: { type: 'string' }, minimum: { type: 'number' } },
      required: ['maxItems'],
    });
  });

  it('does not mutate its input', () => {
    const schema = zodToJsonSchema(digestReplySchema);
    const before = JSON.stringify(schema);

    sanitizeStructuredOutputSchema(schema);

    expect(JSON.stringify(schema)).toBe(before);
  });

  it('leaves no unsupported keyword at any depth', () => {
    const constrained = fc.letrec((tie) => ({
      node: fc.oneof(
        { depthSize: 'small' },
        fc.constant({ type: 'string', maxLength: 3, minLength: 1 }),
        fc.constant({ type: 'integer', minimum: 0, maximum: 9, multipleOf: 3 }),
        tie('node').map((items) => ({ type: 'array', minItems: 4, maxItems: 5, items })),
        tie('node').map((child) => ({
          type: 'object',
          maxProperties: 2,
          properties: { child },
          anyOf: [child],
        })),
      ),
    })).node;

    fc.assert(
      fc.property(constrained, (schema) => {
        const keywords = collectKeywords(sanitizeStructuredOutputSchema(schema as JsonSchema));
        return UNSUPPORTED.every((keyword) => !keywords.has(keyword)) && !keywords.has('minItems');
      }),
    );
  });

  it('leaves the original zod schema enforcing the stripped constraints', () => {
    const tooMany = {
      headline: 'h',
      actions: Array.from({ length: 21 }, () => ({ id: 'a', text: 't' })),
    };

    expect(digestReplySchema.safeParse(tooMany).success).toBe(false);
  });
});
