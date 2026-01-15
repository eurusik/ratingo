import { Module, forwardRef } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

import { ReviewVotesService } from './application/review-votes.service';
import { ReviewsService } from './application/reviews.service';
import { REVIEW_VOTE_REPOSITORY } from './domain/repositories/review-vote.repository.interface';
import { REVIEW_REPOSITORY } from './domain/repositories/review.repository.interface';
import { DrizzleReviewVoteRepository } from './infrastructure/repositories/drizzle-review-vote.repository';
import { DrizzleReviewRepository } from './infrastructure/repositories/drizzle-review.repository';
import { ReviewsController } from './presentation/controllers/reviews.controller';
import { UserReviewsController } from './presentation/controllers/user-reviews.controller';

/**
 * Reviews module - User reviews system.
 *
 * Handles:
 * - Short reviews (280 chars) with ratings
 * - Like/dislike voting
 * - Spoiler warnings
 * - Privacy-aware display
 */
@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
  providers: [
    ReviewsService,
    ReviewVotesService,
    {
      provide: REVIEW_REPOSITORY,
      useClass: DrizzleReviewRepository,
    },
    {
      provide: REVIEW_VOTE_REPOSITORY,
      useClass: DrizzleReviewVoteRepository,
    },
  ],
  controllers: [ReviewsController, UserReviewsController],
  exports: [ReviewsService, ReviewVotesService],
})
export class ReviewsModule {}
