import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsString,
  IsEnum,
  IsOptional,
  MaxLength,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';

import {
  REPORT_REASON,
  REPORT_REASON_VALUES,
  REPORT_STATUS_VALUES,
  type ReportReason,
  type ReportStatus,
} from '../../domain/constants/review.constants';

/**
 * DTO for creating a report.
 */
export class CreateReportDto {
  @ApiProperty({
    description: 'Report reason',
    enum: REPORT_REASON_VALUES,
    example: REPORT_REASON.SPAM,
  })
  @IsEnum(REPORT_REASON_VALUES)
  reason!: ReportReason;

  @ApiPropertyOptional({
    description: 'Additional details about the report',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}

/**
 * Response DTO for a report.
 */
export class ReportResponseDto {
  @ApiProperty({ description: 'Report UUID' })
  id!: string;

  @ApiProperty({ description: 'Review UUID' })
  reviewId!: string;

  @ApiProperty({ description: 'Report reason', enum: REPORT_REASON_VALUES })
  reason!: ReportReason;

  @ApiPropertyOptional({ description: 'Additional details' })
  details!: string | null;

  @ApiProperty({ description: 'Report status', enum: REPORT_STATUS_VALUES })
  status!: ReportStatus;

  @ApiProperty({ description: 'When report was created' })
  createdAt!: Date;
}

/**
 * Review author info for moderation.
 */
export class ReportReviewAuthorDto {
  @ApiProperty({ description: 'Author UUID' })
  id!: string;

  @ApiProperty({ description: 'Author username' })
  username!: string;
}

/**
 * Review info in report response.
 */
export class ReportReviewDto {
  @ApiProperty({ description: 'Review UUID' })
  id!: string;

  @ApiProperty({ description: 'Review content' })
  content!: string;

  @ApiProperty({ description: 'Whether review contains spoilers' })
  hasSpoiler!: boolean;

  @ApiProperty({ description: 'Whether review is deleted' })
  isDeleted!: boolean;

  @ApiProperty({ description: 'Review author', type: ReportReviewAuthorDto })
  author!: ReportReviewAuthorDto;
}

/**
 * Reporter info.
 */
export class ReporterDto {
  @ApiProperty({ description: 'Reporter UUID' })
  id!: string;

  @ApiProperty({ description: 'Reporter username' })
  username!: string;
}

/**
 * Response DTO for moderation queue.
 */
export class ReportWithReviewDto extends ReportResponseDto {
  @ApiProperty({ description: 'Reported review', type: ReportReviewDto })
  review!: ReportReviewDto;

  @ApiProperty({ description: 'Reporter info', type: ReporterDto })
  reporter!: ReporterDto;

  @ApiPropertyOptional({ description: 'Moderator UUID who resolved' })
  moderatorId!: string | null;

  @ApiPropertyOptional({ description: 'Moderator notes' })
  moderatorNotes!: string | null;

  @ApiPropertyOptional({ description: 'When report was resolved' })
  resolvedAt!: Date | null;
}

/**
 * DTO for resolving a report (admin).
 */
export class ResolveReportDto {
  @ApiProperty({
    description: 'New status',
    enum: ['reviewed', 'dismissed', 'actioned'],
  })
  @IsEnum(['reviewed', 'dismissed', 'actioned'])
  status!: Exclude<ReportStatus, 'pending'>;

  @ApiPropertyOptional({ description: 'Moderator notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  moderatorNotes?: string;

  @ApiPropertyOptional({ description: 'Whether to hide the review (soft delete)' })
  @IsOptional()
  @IsBoolean()
  hideReview?: boolean;
}

/**
 * Query DTO for listing reports (admin).
 */
export class AdminReportQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: REPORT_STATUS_VALUES,
  })
  @IsOptional()
  @IsEnum(REPORT_STATUS_VALUES)
  status?: ReportStatus;

  @ApiPropertyOptional({ description: 'Limit', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Offset', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

/**
 * Response DTO for admin reports list.
 */
export class AdminReportListResponseDto {
  @ApiProperty({ description: 'Reports', type: [ReportWithReviewDto] })
  data!: ReportWithReviewDto[];

  @ApiProperty({ description: 'Total count' })
  total!: number;
}
