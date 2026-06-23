/**
 * Person module domain constants.
 */

/** Re-enrich biography/details from TMDB once they are older than this. */
export const PERSON_DETAILS_TTL_DAYS = 30;

/** Default page size for a person's credits list. */
export const PERSON_CREDITS_DEFAULT_LIMIT = 20;

/** Hard cap on a person's credits page size (mirrors catalog Max 50). */
export const PERSON_CREDITS_MAX_LIMIT = 50;

/** Credit role discriminator. */
export const PersonCreditType = {
  CAST: 'cast',
  CREW: 'crew',
} as const;

export type PersonCreditTypeValue = (typeof PersonCreditType)[keyof typeof PersonCreditType];
