import { Module, forwardRef } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

import { ReviewRepliesService } from './application/review-replies.service';
import { ReviewVotesService } from './application/review-votes.service';
import { ReviewsService } from './application/reviews.service';
import { REVIEW_REPLY_REPOSITORY } from './domain/repositories/review-reply.repository.interface';
import { REVIEW_VOTE_REPOSITORY } from './domain/repositories/review-vote.repository.interface';
import { REVIEW_REPOSITORY } from './domain/repositories/review.repository.interface';
import { DrizzleReviewReplyRepository } from './infrastructure/repositories/drizzle-review-reply.repository';
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
 * - Replies (nested comments)
 * - Spoiler warnings
 * - Privacy-aware display
 */
@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
  providers: [
    ReviewsService,
    ReviewVotesService,
    ReviewRepliesService,
    {
      provide: REVIEW_REPOSITORY,
      useClass: DrizzleReviewRepository,
    },
    {
      provide: REVIEW_VOTE_REPOSITORY,
      useClass: DrizzleReviewVoteRepository,
    },
    {
      provide: REVIEW_REPLY_REPOSITORY,
      useClass: DrizzleReviewReplyRepository,
    },
  ],
  controllers: [ReviewsController, UserReviewsController],
  exports: [ReviewsService, ReviewVotesService, ReviewRepliesService],
})
export class ReviewsModule {}
