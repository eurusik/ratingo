import { requestIdSchema, submissionSchema } from './submission.schema';

const valid = { requestId: 'tg1000001', question: 'Why does sync-show time out?' };

describe('submissionSchema', () => {
  it('accepts a request and defaults the ref to main', () => {
    expect(submissionSchema.parse(valid)).toEqual({ ...valid, ref: 'main' });
  });

  it('trims the question and keeps its newlines', () => {
    expect(submissionSchema.parse({ ...valid, question: '  why?\nand how?  ' }).question).toBe(
      'why?\nand how?',
    );
  });

  it.each([
    ['no request id', { question: 'q' }],
    ['a short request id', { ...valid, requestId: 'abc' }],
    ['a request id with a slash', { ...valid, requestId: 'tg1000001/../x' }],
    ['an empty question', { ...valid, question: '   ' }],
    ['a question over 1000 characters', { ...valid, question: 'x'.repeat(1001) }],
    ['a question with a control character', { ...valid, question: 'why\u0000?' }],
    ['a ref that is not allowed', { ...valid, ref: 'feature/x' }],
    ['an extra field', { ...valid, budget: 5 }],
    ['a number as the question', { ...valid, question: 5 }],
  ])('refuses %s', (_name, body) => {
    expect(submissionSchema.safeParse(body).success).toBe(false);
  });

  it('accepts a question of exactly 1000 characters', () => {
    expect(submissionSchema.safeParse({ ...valid, question: 'x'.repeat(1000) }).success).toBe(true);
  });

  it('checks request ids in the URL with the same pattern', () => {
    expect(requestIdSchema.safeParse('tg1000001').success).toBe(true);
    expect(requestIdSchema.safeParse('..%2f..').success).toBe(false);
  });
});
