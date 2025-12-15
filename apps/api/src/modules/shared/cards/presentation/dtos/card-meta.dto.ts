import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BADGE_KEY_VALUES,
  CARD_LIST_CONTEXT_VALUES,
  PRIMARY_CTA_VALUES,
  type BadgeKey,
  type CardListContext,
  type PrimaryCta,
} from '../../domain/card.constants';

/**
 * Continue point payload for "Continue" UX.
 */
export class ContinuePointDto {
  @ApiProperty({ example: 2 })
  season!: number;

  @ApiProperty({ example: 5 })
  episode!: number;
}

/**
 * Presentation metadata for a media card (badge + CTA).
 */
export class CardMetaDto {
  @ApiPropertyOptional({ enum: BADGE_KEY_VALUES, nullable: true })
  badgeKey!: BadgeKey | null;

  @ApiPropertyOptional({ enum: CARD_LIST_CONTEXT_VALUES, required: false })
  listContext?: CardListContext;

  @ApiProperty({ enum: PRIMARY_CTA_VALUES })
  primaryCta!: PrimaryCta;

  @ApiPropertyOptional({ type: ContinuePointDto, nullable: true })
  continue!: ContinuePointDto | null;
}
