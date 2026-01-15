import { ApiProperty } from '@nestjs/swagger';

import type { VoteType } from '../../domain/constants/review.constants';

/**
 * Author information in review response.
 */
export class ReviewAuthorDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'user123' })
  username: string;

  @ApiProperty({
    example: 'https://example.com/avatar.jpg',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the author shows their ratings publicly',
  })
  showRatings: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether the author profile is public',
  })
  isProfilePublic: boolean;
}

/**
 * Response DTO for a single review.
 */
export class ReviewResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mediaItemId: string;

  @ApiProperty({ example: 'Чудовий фільм! Візуальні ефекти на висоті.' })
  content: string;

  @ApiProperty({
    example: 85,
    nullable: true,
    description: 'Rating 0-100, null if author has showRatings=false',
  })
  rating: number | null;

  @ApiProperty({ example: false })
  hasSpoiler: boolean;

  @ApiProperty({ example: 42 })
  likesCount: number;

  @ApiProperty({ example: 3 })
  dislikesCount: number;

  @ApiProperty({ example: 5 })
  repliesCount: number;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ type: ReviewAuthorDto })
  author: ReviewAuthorDto;

  @ApiProperty({
    example: 'like',
    nullable: true,
    description: 'Current user vote (null if not voted or not authenticated)',
  })
  currentUserVote?: VoteType | null;
}

/**
 * Response DTO for review list with pagination.
 */
export class ReviewListResponseDto {
  @ApiProperty({ type: [ReviewResponseDto] })
  data: ReviewResponseDto[];

  @ApiProperty({
    example: { total: 100, limit: 20, offset: 0 },
  })
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Response DTO for review creation/update.
 */
export class ReviewMutationResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mediaItemId: string;

  @ApiProperty({ example: 'Чудовий фільм!' })
  content: string;

  @ApiProperty({ example: 85 })
  rating: number;

  @ApiProperty({ example: false })
  hasSpoiler: boolean;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z' })
  updatedAt: Date;
}
