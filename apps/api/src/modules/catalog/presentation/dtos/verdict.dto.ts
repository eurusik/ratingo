import { ApiProperty } from '@nestjs/swagger';
import {
  VerdictType,
  VerdictHintKey,
  MovieVerdictMessageKey,
} from '../../domain/utils/movie-verdict.utils';
import { ShowQualityVerdictKey, ShowStatusHintKey } from '../../domain/utils/show-verdict.utils';

/**
 * Verdict DTO returned to clients for movie details.
 * Clients use messageKey for i18n lookup.
 */
export class MovieVerdictDto {
  @ApiProperty({
    enum: ['warning', 'release', 'quality', 'popularity', 'general'],
    example: 'quality',
    description: 'Verdict type for UI styling',
  })
  type: VerdictType;

  @ApiProperty({
    example: 'strongRatings',
    nullable: true,
    description: 'Message key for i18n lookup on client (details.verdict.movie.*)',
  })
  messageKey: MovieVerdictMessageKey;

  @ApiProperty({
    example: 'IMDb: 6.3',
    nullable: true,
    required: false,
    description: 'Additional context to display with verdict',
  })
  context?: string | null;

  @ApiProperty({
    enum: [
      'newEpisodes',
      'afterAllEpisodes',
      'whenOnStreaming',
      'notifyNewEpisode',
      'general',
      'forLater',
      'notifyRelease',
      'decideToWatch',
    ],
    example: 'forLater',
    description: 'Hint key for CTA suggestions',
  })
  hintKey: VerdictHintKey;
}

/**
 * Show verdict DTO - answers "is it worth it?"
 */
export class ShowVerdictDto {
  @ApiProperty({
    enum: ['warning', 'release', 'quality', 'popularity', 'general'],
    example: 'quality',
    description: 'Verdict type for UI styling',
  })
  type: VerdictType;

  @ApiProperty({
    enum: [
      'cancelled',
      'poorRatings',
      'belowAverage',
      'criticsLoved',
      'strongRatings',
      'decentRatings',
      'longRunning',
      'trendingNow',
      'risingHype',
      'earlyReviews',
      'mixedReviews',
    ],
    example: 'strongRatings',
    nullable: true,
    description: 'Message key for i18n lookup on client (details.verdict.show.*)',
  })
  messageKey: ShowQualityVerdictKey;

  @ApiProperty({
    example: 'IMDb: 8.2',
    nullable: true,
    required: false,
    description: 'Additional context to display with verdict',
  })
  context?: string | null;

  @ApiProperty({
    enum: [
      'newEpisodes',
      'afterAllEpisodes',
      'whenOnStreaming',
      'notifyNewEpisode',
      'general',
      'forLater',
      'notifyRelease',
      'decideToWatch',
    ],
    example: 'forLater',
    description: 'Hint key for CTA suggestions',
  })
  hintKey: VerdictHintKey;
}

/**
 * Show status hint DTO - explains "why now?" (secondary, optional)
 */
export class ShowStatusHintDto {
  @ApiProperty({
    enum: ['newSeason', 'seriesFinale'],
    example: 'newSeason',
    nullable: true,
    description: 'Message key for i18n lookup on client (details.verdict.showStatusHint.*)',
  })
  messageKey: ShowStatusHintKey;
}
