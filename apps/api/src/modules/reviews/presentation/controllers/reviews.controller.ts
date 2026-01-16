import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { DEFAULT_PAGE_SIZE } from '../../../../common/constants';
import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { OptionalJwtAuthGuard } from '../../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { ReviewRepliesService } from '../../application/review-replies.service';
import { ReviewVotesService } from '../../application/review-votes.service';
import { ReviewsService } from '../../application/reviews.service';
import type { VoteType } from '../../domain/constants/review.constants';
import type { ReviewReplyWithAuthor } from '../../domain/entities/review-reply.entity';
import type { ReviewVote } from '../../domain/entities/review-vote.entity';
import type { ReviewWithAuthor } from '../../domain/entities/review.entity';
import { ReviewQueryDto, ReviewResponseDto, ReviewListResponseDto, ReplyResponseDto } from '../dto';

/**
 * Public endpoints for reading reviews.
 * Authentication is optional - used for enriching with current user's vote.
 */
@ApiTags('Public: Reviews')
@UseGuards(OptionalJwtAuthGuard)
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly votesService: ReviewVotesService,
    private readonly repliesService: ReviewRepliesService,
  ) {}

  /**
   * Lists reviews for a media item with optional user vote enrichment.
   */
  @Get('media/:mediaItemId')
  @ApiOperation({
    summary: 'List reviews for a media item',
    description:
      'Returns reviews for a movie/show with author info and optional current user vote.',
  })
  @ApiParam({ name: 'mediaItemId', type: String, description: 'Media item UUID' })
  @ApiOkResponse({ type: ReviewListResponseDto })
  async listForMedia(
    @Param('mediaItemId') mediaItemId: string,
    @Query() query: ReviewQueryDto,
    @CurrentUser() user: { id: string } | null,
  ): Promise<ReviewListResponseDto> {
    const { reviews, total } = await this.reviewsService.listForMedia({
      mediaItemId,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
      hideSpoilers: query.hideSpoilers,
    });

    // Enrich with user's votes if authenticated
    let userVotesMap = new Map<string, ReviewVote>();
    if (user && reviews.length > 0) {
      const reviewIds = reviews.map((r) => r.id);
      userVotesMap = await this.votesService.getUserVotesForReviews(user.id, reviewIds);
    }

    return {
      data: reviews.map((review) => this.toResponseDto(review, userVotesMap)),
      meta: {
        total,
        limit: query.limit ?? DEFAULT_PAGE_SIZE,
        offset: query.offset ?? 0,
      },
    };
  }

  /**
   * Gets a single review by ID.
   */
  @Get(':reviewId')
  @ApiOperation({
    summary: 'Get a single review',
    description: 'Returns a single review with author info and optional current user vote.',
  })
  @ApiParam({ name: 'reviewId', type: String, description: 'Review UUID' })
  @ApiOkResponse({ type: ReviewResponseDto })
  async getById(
    @Param('reviewId') reviewId: string,
    @CurrentUser() user: { id: string } | null,
  ): Promise<ReviewResponseDto> {
    const review = await this.reviewsService.getById(reviewId);

    let currentUserVote = null;
    if (user) {
      const vote = await this.votesService.getUserVote(user.id, reviewId);
      currentUserVote = vote?.voteType ?? null;
    }

    return this.toResponseDto(review, new Map(), currentUserVote);
  }

  /**
   * Lists replies for a review.
   */
  @Get(':reviewId/replies')
  @ApiOperation({
    summary: 'List replies for a review',
    description: 'Returns all replies for a review with author info.',
  })
  @ApiParam({ name: 'reviewId', type: String, description: 'Review UUID' })
  @ApiOkResponse({ type: [ReplyResponseDto] })
  async listReplies(@Param('reviewId') reviewId: string): Promise<ReplyResponseDto[]> {
    const replies = await this.repliesService.listForReview(reviewId);

    return replies.map((reply) => this.toReplyResponseDto(reply));
  }

  private toReplyResponseDto(reply: ReviewReplyWithAuthor): ReplyResponseDto {
    return {
      id: reply.id,
      reviewId: reply.reviewId,
      parentReplyId: reply.parentReplyId,
      content: reply.content,
      author: {
        id: reply.author.id,
        username: reply.author.isProfilePublic ? reply.author.username : 'Анонім',
        avatarUrl: reply.author.isProfilePublic ? reply.author.avatarUrl : null,
        isProfilePublic: reply.author.isProfilePublic,
      },
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
    };
  }

  private toResponseDto(
    review: ReviewWithAuthor,
    userVotesMap: Map<string, ReviewVote>,
    explicitVote?: VoteType | null,
  ): ReviewResponseDto {
    const userVote = userVotesMap.get(review.id);

    return {
      id: review.id,
      mediaItemId: review.mediaItemId,
      content: review.content,
      // Respect privacy: hide rating if author has showRatings=false
      rating: review.author.showRatings ? review.rating : null,
      hasSpoiler: review.hasSpoiler,
      likesCount: review.likesCount,
      dislikesCount: review.dislikesCount,
      repliesCount: review.repliesCount,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      author: {
        id: review.author.id,
        username: review.author.isProfilePublic ? review.author.username : 'Анонім',
        avatarUrl: review.author.isProfilePublic ? review.author.avatarUrl : null,
        showRatings: review.author.showRatings,
        isProfilePublic: review.author.isProfilePublic,
      },
      currentUserVote: explicitVote !== undefined ? explicitVote : (userVote?.voteType ?? null),
    };
  }
}
