import { ApiProperty } from '@nestjs/swagger';

import {
  type VerdictType,
  type VerdictHintKey,
  type MovieVerdictMessageKey,
  type ShowQualityVerdictKey,
  type ShowStatusHintKey,
} from '../../../shared/verdict';

class BaseVerdictDto {
  @ApiProperty({
    enum: ['warning', 'release', 'quality', 'popularity', 'general'],
    example: 'quality',
    description: 'Verdict type for UI styling',
  })
  type: VerdictType;

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
 * Verdict DTO returned to clients for movie details.
 * Clients use messageKey for i18n lookup.
 */
export class MovieVerdictDto extends BaseVerdictDto {
  @ApiProperty({
    example: 'strongRatings',
    nullable: true,
    description: 'Message key for i18n lookup on client (details.verdict.movie.*)',
  })
  messageKey: MovieVerdictMessageKey;
}

/**
 * Show verdict DTO - answers "is it worth it?"
 */
export class ShowVerdictDto extends BaseVerdictDto {
  @ApiProperty({
    example: 'IMDb: 8.2',
    nullable: true,
    required: false,
    description: 'Additional context to display with verdict',
  })
  declare context?: string | null;

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
