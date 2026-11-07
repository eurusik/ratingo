import { type MediaScoreDataWithTmdbId } from '@/modules/catalog/public';
import { type ScoreInput } from '@/modules/shared/score-calculator';

/**
 * Maps media score data to ScoreCalculator input format.
 * Centralizes the mapping logic to avoid duplication across services.
 *
 * @param scoreData - Media score data from repository
 * @param liveWatchers - Optional live watchers count (overrides scoreData.watchersCount)
 * @returns ScoreInput ready for ScoreCalculatorService
 */
export function toScoreInput(
  scoreData: MediaScoreDataWithTmdbId,
  liveWatchers?: number | null,
): ScoreInput {
  return {
    tmdbPopularity: scoreData.popularity ?? 0,
    traktTotalWatchers: scoreData.totalWatchers ?? 0,
    traktLiveWatchers: liveWatchers ?? scoreData.watchersCount,
    imdbRating: scoreData.ratingImdb,
    traktRating: scoreData.ratingTrakt,
    metacriticRating: scoreData.ratingMetacritic,
    rottenTomatoesRating: scoreData.ratingRottenTomatoes,
    imdbVotes: scoreData.voteCountImdb,
    traktVotes: scoreData.voteCountTrakt,
    releaseDate: scoreData.releaseDate,
    lastAirDate: scoreData.lastAirDate,
  };
}
