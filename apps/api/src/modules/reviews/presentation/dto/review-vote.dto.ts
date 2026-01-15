import { ApiProperty } from '@nestjs/swagger';

import { IsIn } from 'class-validator';

import {
  VOTE_TYPE,
  VOTE_TYPE_VALUES,
  type VoteType,
} from '../../domain/constants/review.constants';

/**
 * DTO for voting on a review.
 */
export class ReviewVoteDto {
  @ApiProperty({
    enum: VOTE_TYPE_VALUES,
    example: VOTE_TYPE.LIKE,
    description: 'Vote type: like or dislike',
  })
  @IsIn(VOTE_TYPE_VALUES)
  voteType: VoteType;
}

/**
 * Response DTO for vote result.
 */
export class VoteResultDto {
  @ApiProperty({
    enum: ['added', 'changed', 'removed'],
    example: 'added',
    description: 'Action taken',
  })
  action: 'added' | 'changed' | 'removed';

  @ApiProperty({
    example: VOTE_TYPE.LIKE,
    nullable: true,
    description: 'Current vote type (null if removed)',
  })
  currentVote: VoteType | null;
}
