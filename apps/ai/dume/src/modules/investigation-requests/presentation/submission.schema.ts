import { z } from 'zod';

import { ALLOWED_REFS, DEFAULT_REF, MAX_QUESTION_CHARS } from '../../investigation/public';
import { REQUEST_ID_PATTERN } from '../domain/constants/request.constants';

const ALLOWED_WHITESPACE_CODES: readonly number[] = [9, 10, 13];
const FIRST_C1_CONTROL = 127;
const LAST_C1_CONTROL = 159;
const FIRST_PRINTABLE = 32;

const hasForbiddenControlCharacter = (text: string): boolean =>
  [...text].some((character) => {
    const code = character.charCodeAt(0);
    const isControl = code < FIRST_PRINTABLE || (code >= FIRST_C1_CONTROL && code <= LAST_C1_CONTROL);
    return isControl && !ALLOWED_WHITESPACE_CODES.includes(code);
  });

export const submissionSchema = z
  .object({
    requestId: z.string().regex(REQUEST_ID_PATTERN),
    question: z
      .string()
      .trim()
      .min(1)
      .max(MAX_QUESTION_CHARS)
      .refine((text) => !hasForbiddenControlCharacter(text), {
        message: 'question has control characters',
      }),
    ref: z.enum(ALLOWED_REFS).default(DEFAULT_REF),
  })
  .strict();

export const requestIdSchema = z.string().regex(REQUEST_ID_PATTERN);
