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

import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { ReviewVotesService } from '../../application/review-votes.service';
import { ReviewsService } from '../../application/reviews.service';
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewVoteDto,
  VoteResultDto,
  ReviewMutationResponseDto,
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
