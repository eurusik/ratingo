/**
 * Validation schemas for review forms.
 */

import { z } from 'zod';
import type { getDictionary } from '@/shared/i18n';

type Dict = ReturnType<typeof getDictionary>;

export const REVIEW_FORM_MODE = {
  CREATE: 'create',
  EDIT: 'edit',
} as const;

export type ReviewFormMode = (typeof REVIEW_FORM_MODE)[keyof typeof REVIEW_FORM_MODE];

const MAX_CONTENT_LENGTH = 280;
const MIN_RATING = 0;
const MAX_RATING = 100;

/** Creates review form schema with i18n messages. */
export function createReviewSchema(_dict: Dict) {
  return z.object({
    content: z
      .string()
      .min(1, 'Required')
      .max(MAX_CONTENT_LENGTH, `Max ${MAX_CONTENT_LENGTH} characters`),
    rating: z.number().min(MIN_RATING).max(MAX_RATING),
    hasSpoiler: z.boolean(),
  });
}

export type ReviewFormData = z.infer<ReturnType<typeof createReviewSchema>>;

export { MAX_CONTENT_LENGTH, MIN_RATING, MAX_RATING };
