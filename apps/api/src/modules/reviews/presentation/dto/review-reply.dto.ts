import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsUUID, IsOptional, MinLength, MaxLength } from 'class-validator';

import { REVIEW_LIMITS } from '../../domain/constants/review.constants';

/**
 * DTO for creating a reply to a review.
 */
export class CreateReplyDto {
  @ApiProperty({
    description: 'Reply content',
    minLength: 1,
    maxLength: REVIEW_LIMITS.MAX_CONTENT_LENGTH,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(REVIEW_LIMITS.MAX_CONTENT_LENGTH)
  content!: string;

  @ApiPropertyOptional({ description: 'Parent reply ID for nested replies', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  parentReplyId?: string;

  @ApiPropertyOptional({ description: 'Username of the person being replied to' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  replyToUsername?: string;
}

/**
 * Author info in reply response.
 */
export class ReplyAuthorDto {
  @ApiProperty({ description: 'Author UUID' })
  id!: string;

  @ApiProperty({ description: 'Author username' })
  username!: string;

  @ApiPropertyOptional({ description: 'Author avatar URL' })
  avatarUrl!: string | null;

  @ApiProperty({ description: 'Whether author profile is public' })
  isProfilePublic!: boolean;
}

/**
 * Response DTO for a reply.
 */
export class ReplyResponseDto {
  @ApiProperty({ description: 'Reply UUID' })
  id!: string;

  @ApiProperty({ description: 'Review UUID this reply belongs to' })
  reviewId!: string;

  @ApiPropertyOptional({ description: 'Parent reply UUID for nested replies' })
  parentReplyId!: string | null;

  @ApiPropertyOptional({ description: 'Username of the person being replied to' })
  replyToUsername!: string | null;

  @ApiProperty({ description: 'Reply content' })
  content!: string;

  @ApiProperty({ description: 'Reply author info', type: ReplyAuthorDto })
  author!: ReplyAuthorDto;

  @ApiProperty({ description: 'When reply was created' })
  createdAt!: Date;

  @ApiProperty({ description: 'When reply was last updated' })
  updatedAt!: Date;
}

/**
 * Response DTO for reply mutation (create).
 */
export class ReplyMutationResponseDto {
  @ApiProperty({ description: 'Reply UUID' })
  id!: string;

  @ApiProperty({ description: 'Review UUID' })
  reviewId!: string;

  @ApiPropertyOptional({ description: 'Parent reply UUID' })
  parentReplyId!: string | null;

  @ApiPropertyOptional({ description: 'Username of the person being replied to' })
  replyToUsername!: string | null;

  @ApiProperty({ description: 'Reply content' })
  content!: string;

  @ApiProperty({ description: 'When reply was created' })
  createdAt!: Date;

  @ApiProperty({ description: 'When reply was last updated' })
  updatedAt!: Date;
}
