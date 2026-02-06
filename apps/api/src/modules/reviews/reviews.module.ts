import { Module, forwardRef } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { UserMediaModule } from '../user-media/user-media.module';

import { ReviewRepliesService } from './application/review-replies.service';
import { ReviewReportsService } from './application/review-reports.service';
import { ReviewVotesService } from './application/review-votes.service';
import { ReviewsService } from './application/reviews.service';
import { REVIEW_REPLY_REPOSITORY } from './domain/repositories/review-reply.repository.interface';
import { REVIEW_REPORT_REPOSITORY } from './domain/repositories/review-report.repository.interface';
import { REVIEW_VOTE_REPOSITORY } from './domain/repositories/review-vote.repository.interface';
import { REVIEW_REPOSITORY } from './domain/repositories/review.repository.interface';
import { DrizzleReviewReplyRepository } from './infrastructure/repositories/drizzle-review-reply.repository';
import { DrizzleReviewReportRepository } from './infrastructure/repositories/drizzle-review-report.repository';
import { DrizzleReviewVoteRepository } from './infrastructure/repositories/drizzle-review-vote.repository';
import { DrizzleReviewRepository } from './infrastructure/repositories/drizzle-review.repository';
import { AdminReviewsController } from './presentation/controllers/admin-reviews.controller';
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
  imports: [DatabaseModule, forwardRef(() => AuthModule), UserMediaModule],
  providers: [
    ReviewsService,
    ReviewVotesService,
    ReviewRepliesService,
    ReviewReportsService,
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
    {
      provide: REVIEW_REPORT_REPOSITORY,
      useClass: DrizzleReviewReportRepository,
    },
  ],
  controllers: [ReviewsController, UserReviewsController, AdminReviewsController],
  exports: [ReviewsService, ReviewVotesService, ReviewRepliesService, ReviewReportsService],
})
export class ReviewsModule {}
