import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import traktConfig from '@/config/trakt.config';

import { TRAKT_LISTS_PORT } from './domain/ports/trakt-lists.port';
import { TRAKT_RATE_LIMIT_PORT } from './domain/ports/trakt-rate-limit.port';
import { TRAKT_RATINGS_PORT } from './domain/ports/trakt-ratings.port';
import { SharedTraktRateLimitAdapter } from './infrastructure/adapters/shared-trakt-rate-limit.adapter';
import { TraktListsAdapter } from './infrastructure/adapters/trakt-lists.adapter';
import { TraktRatingsAdapter } from './infrastructure/adapters/trakt-ratings.adapter';

/**
 * Leaf module for the Trakt external API.
 * Provides ratings, trending-lists and shared rate-limit ports — no dependencies on other feature modules.
 */
@Module({
  imports: [ConfigModule.forFeature(traktConfig)],
  providers: [
    {
      provide: TRAKT_RATINGS_PORT,
      useClass: TraktRatingsAdapter,
    },
    {
      provide: TRAKT_LISTS_PORT,
      useClass: TraktListsAdapter,
    },
    {
      provide: TRAKT_RATE_LIMIT_PORT,
      useClass: SharedTraktRateLimitAdapter,
    },
  ],
  exports: [TRAKT_RATINGS_PORT, TRAKT_LISTS_PORT, TRAKT_RATE_LIMIT_PORT],
})
export class TraktModule {}
