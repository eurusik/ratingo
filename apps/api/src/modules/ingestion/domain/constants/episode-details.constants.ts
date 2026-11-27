import { SAME_AIRING_MAX_GAP_DAYS } from '@/modules/shared/contracts';

export const SPECIALS_SEASON_NUMBER = 0;
export const MAX_PAIRED_AIR_DATE_GAP_DAYS = SAME_AIRING_MAX_GAP_DAYS;
export const TMDB_AIR_DATE_SETTLE_DAYS = 2;
export const EPISODE_DETAILS_CHECK_COOLDOWN_DAYS = 28;
export const FILLED_ONCE_AIRED = ['runtime', 'stillPath', 'rating'] as const;

export type FilledOnceAiredField = (typeof FILLED_ONCE_AIRED)[number];
