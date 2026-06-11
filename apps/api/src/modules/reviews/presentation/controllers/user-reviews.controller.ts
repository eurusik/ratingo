import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiParam,
} from '@nestjs/swagger';

import { CurrentUser } from '../../../auth/public';
import { JwtAuthGuard } from '../../../auth/public';
import { ReviewRepliesService } from '../../application/review-replies.service';
import { ReviewReportsService } from '../../application/review-reports.service';
import { ReviewVotesService } from '../../application/review-votes.service';
import { ReviewsService } from '../../application/reviews.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewVoteDto,
  VoteResultDto,
  ReviewMutationResponseDto,
  CreateReplyDto,
  ReplyMutationResponseDto,
  CreateReportDto,
  ReportResponseDto,
} from '../dto';

/**
 * Authenticated endpoints for user reviews (CRUD + voting).
 */
@ApiTags('User: Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me/reviews')
export class UserReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly votesService: ReviewVotesService,
    private readonly repliesService: ReviewRepliesService,
    private readonly reportsService: ReviewReportsService,
  ) {}

  /**
   * Creates a new review.
   * One review per user per media item.
   */
  @Post()
  @ApiOperation({ summary: 'Create a review (auth: Bearer)' })
  @ApiCreatedResponse({ type: ReviewMutationResponseDto, description: 'Review created' })
  async create(
    @CurrentUser() user: { id: string },
    @Body() body: CreateReviewDto,
  ): Promise<ReviewMutationResponseDto> {
    const review = await this.reviewsService.create({
      userId: user.id,
      mediaItemId: body.mediaItemId,
      content: body.content,
      rating: body.rating,
      hasSpoiler: body.hasSpoiler,
      mediaType: body.mediaType,
    });

    return this.toMutationResponse(review);
  }

  /**
   * Gets the current user's review for a media item.
   */
  @Get('media/:mediaItemId')
  @ApiOperation({ summary: 'Get my review for a media item (auth: Bearer)' })
  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiOkResponse({ type: ReviewMutationResponseDto, description: 'Review found' })
  async getMyReviewForMedia(
    @CurrentUser() user: { id: string },
    @Param('mediaItemId') mediaItemId: string,
  ): Promise<ReviewMutationResponseDto | null> {
    const review = await this.reviewsService.getUserReviewForMedia(user.id, mediaItemId);

    if (!review) {
      return null;
    }

    return this.toMutationResponse(review);
  }

  /**
   * Updates an existing review.
   * Only the author can update.
   */
  @Patch(':reviewId')
  @ApiOperation({ summary: 'Update my review (auth: Bearer)' })
  @ApiParam({ name: 'reviewId', type: String, description: 'Review UUID' })
  @ApiOkResponse({ type: ReviewMutationResponseDto, description: 'Review updated' })
  async update(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
    @Body() body: UpdateReviewDto,
  ): Promise<ReviewMutationResponseDto> {
    const review = await this.reviewsService.update(reviewId, user.id, {
      content: body.content,
      rating: body.rating,
      hasSpoiler: body.hasSpoiler,
    });

    return this.toMutationResponse(review);
  }

  /**
   * Deletes a review.
   * Only the author can delete.
   */
  @Delete(':reviewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete my review (auth: Bearer)' })
  @ApiParam({ name: 'reviewId', type: String, description: 'Review UUID' })
  @ApiNoContentResponse({ description: 'Review deleted' })
  async delete(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
  ): Promise<void> {
    await this.reviewsService.delete(reviewId, user.id);
  }

  /**
   * Votes on a review (like or dislike).
   */
  @Post(':reviewId/vote')
  @ApiOperation({ summary: 'Vote on a review (auth: Bearer)' })
  @ApiParam({ name: 'reviewId', type: String, description: 'Review UUID' })
  @ApiCreatedResponse({ type: VoteResultDto, description: 'Vote registered' })
  async vote(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
    @Body() body: ReviewVoteDto,
  ): Promise<VoteResultDto> {
    const result = await this.votesService.vote(user.id, reviewId, body.voteType);

    return {
      action: result.action,
      currentVote: result.newVote?.voteType ?? null,
    };
  }

  /**
   * Removes a vote from a review.
   */
  @Delete(':reviewId/vote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove vote from a review (auth: Bearer)' })
  @ApiParam({ name: 'reviewId', type: String, description: 'Review UUID' })
  @ApiOkResponse({ type: VoteResultDto, description: 'Vote removed' })
  async unvote(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
  ): Promise<VoteResultDto> {
    const result = await this.votesService.unvote(user.id, reviewId);

    return {
      action: result.action,
      currentVote: null,
    };
  }

  // ============================================================================
  // Replies
  // ============================================================================

  /**
   * Creates a reply to a review.
   */
  @Post(':reviewId/replies')
  @ApiOperation({ summary: 'Create a reply to a review (auth: Bearer)' })
  @ApiParam({ name: 'reviewId', type: String, description: 'Review UUID' })
  @ApiCreatedResponse({ type: ReplyMutationResponseDto, description: 'Reply created' })
  async createReply(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
    @Body() body: CreateReplyDto,
  ): Promise<ReplyMutationResponseDto> {
    const reply = await this.repliesService.create({
      userId: user.id,
      reviewId,
      parentReplyId: body.parentReplyId,
      replyToUsername: body.replyToUsername,
      content: body.content,
    });

    return {
      id: reply.id,
      reviewId: reply.reviewId,
      parentReplyId: reply.parentReplyId,
      replyToUsername: reply.replyToUsername,
      content: reply.content,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
    };
  }

  /**
   * Deletes a reply.
   * Only the author can delete their reply.
   */
  @Delete('replies/:replyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete my reply (auth: Bearer)' })
  @ApiParam({ name: 'replyId', type: String, description: 'Reply UUID' })
  @ApiNoContentResponse({ description: 'Reply deleted' })
  async deleteReply(
    @CurrentUser() user: { id: string },
    @Param('replyId') replyId: string,
  ): Promise<void> {
    await this.repliesService.delete(replyId, user.id);
  }

  // ============================================================================
  // Reports
  // ============================================================================

  /**
   * Reports a review for moderation.
   * One report per user per review.
   */
  @Post(':reviewId/report')
  @ApiOperation({ summary: 'Report a review (auth: Bearer)' })
  @ApiParam({ name: 'reviewId', type: String, description: 'Review UUID' })
  @ApiCreatedResponse({ type: ReportResponseDto, description: 'Report submitted' })
  async report(
    @CurrentUser() user: { id: string },
    @Param('reviewId') reviewId: string,
    @Body() body: CreateReportDto,
  ): Promise<ReportResponseDto> {
    const report = await this.reportsService.create({
      userId: user.id,
      reviewId,
      reason: body.reason,
      details: body.details,
    });

    return {
      id: report.id,
      reviewId: report.reviewId,
      reason: report.reason,
      details: report.details,
      status: report.status,
      createdAt: report.createdAt,
    };
  }

  private toMutationResponse(review: {
    id: string;
    mediaItemId: string;
    content: string;
    rating: number;
    hasSpoiler: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): ReviewMutationResponseDto {
    return {
      id: review.id,
      mediaItemId: review.mediaItemId,
      content: review.content,
      rating: review.rating,
      hasSpoiler: review.hasSpoiler,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
    };
  }
}
