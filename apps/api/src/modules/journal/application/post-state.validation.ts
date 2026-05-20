import { BadRequestException } from '@nestjs/common';

import { JOURNAL_ERRORS } from '../domain/constants/journal-errors';

/**
 * Valid post states:
 * - Draft: isDraft=true, publishedAt=null
 * - Published/Scheduled: isDraft=false, publishedAt!=null
 *
 * Invalid states (rejected):
 * - isDraft=false with publishedAt=null (published without date)
 * - isDraft=true with publishedAt!=null (draft with date)
 */
export interface PostStateInput {
  isDraft: boolean;
  publishedAt: Date | null;
}

export type PostState = 'draft' | 'published' | 'scheduled';

/**
 * Validates that a post's state is consistent.
 * Throws BadRequestException if the state is invalid.
 *
 * @param isDraft - Whether the post is a draft
 * @param publishedAt - The publication date (null for drafts)
 * @throws BadRequestException if state is invalid
 */
export function validatePostState(isDraft: boolean, publishedAt: Date | null): void {
  if (!isDraft && publishedAt === null) {
    throw new BadRequestException({
      code: JOURNAL_ERRORS.INVALID_POST_STATE,
      message: 'Published posts must have a publication date',
    });
  }

  if (isDraft && publishedAt !== null) {
    throw new BadRequestException({
      code: JOURNAL_ERRORS.INVALID_POST_STATE,
      message: 'Draft posts cannot have a publication date',
    });
  }
}

/**
 * Checks if a post state is valid without throwing.
 *
 * @param isDraft - Whether the post is a draft
 * @param publishedAt - The publication date (null for drafts)
 * @returns true if the state is valid, false otherwise
 */
export function isValidPostState(isDraft: boolean, publishedAt: Date | null): boolean {
  // Draft: isDraft=true, publishedAt=null
  if (isDraft && publishedAt === null) {
    return true;
  }

  // Published/Scheduled: isDraft=false, publishedAt!=null
  if (!isDraft && publishedAt !== null) {
    return true;
  }

  return false;
}

/**
 * Determines the post state based on isDraft and publishedAt.
 *
 * @param isDraft - Whether the post is a draft
 * @param publishedAt - The publication date
 * @returns The post state: 'draft', 'published', or 'scheduled'
 * @throws BadRequestException if state is invalid
 */
export function getPostState(
  isDraft: boolean,
  publishedAt: Date | null,
  now: Date = new Date(),
): PostState {
  if (!isValidPostState(isDraft, publishedAt)) {
    throw new BadRequestException({
      code: JOURNAL_ERRORS.INVALID_POST_STATE,
      message: 'Invalid post state',
    });
  }

  if (isDraft) {
    return 'draft';
  }

  return publishedAt! <= now ? 'published' : 'scheduled';
}
