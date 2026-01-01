/**
 * Show Verdict - Domain Types
 *
 * Types for show verdict computation.
 */

import { type ShowStatus } from '../../../../common/enums/show-status.enum';

import type { PopularitySignal } from './popularity-signal';
import { type ExternalRatings, type BaseVerdict } from './verdict.types';

/**
 * Quality verdict message keys - answer "is it worth it?"
 */
export type ShowQualityVerdictKey =
  | 'cancelled'
  | 'poorRatings'
  | 'belowAverage'
  | 'criticsLoved'
  | 'strongRatings'
  | 'decentRatings'
  | 'longRunning'
  | 'trendingNow'
  | 'risingHype'
  | 'earlyReviews'
  | 'mixedReviews'
  | 'noConsensusYet'
  // Age-aware verdicts for older content
  | 'steadyInterest'
  | 'classicSeries'
  | 'timelessFavorite'
  | null;

/**
 * Status hint message keys - explain "why now?"
 */
export type ShowStatusHintKey = 'newSeason' | 'seriesFinale' | null;

/**
 * Input data for show verdict computation.
 */
export interface ShowVerdictInput {
  status?: ShowStatus | null;
  externalRatings?: ExternalRatings | null;
  /** Popularity signal (trending/hit/rising) */
  popularitySignal?: PopularitySignal;
  popularity?: number | null;
  totalSeasons?: number | null;
  lastAirDate?: Date | null;
  /** First air date for age-aware verdicts */
  firstAirDate?: Date | null;
}

/**
 * Main verdict - answers "is it worth it?"
 */
export type ShowVerdict = BaseVerdict<ShowQualityVerdictKey>;

/**
 * Status hint - explains "why now?" (secondary, optional)
 */
export interface ShowStatusHint {
  messageKey: ShowStatusHintKey;
}

/**
 * Full verdict result with optional status hint.
 */
export interface ShowVerdictResult {
  verdict: ShowVerdict;
  statusHint: ShowStatusHint | null;
}
