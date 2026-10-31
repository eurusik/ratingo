/**
 * Admin Reviews Controller
 *
 * Endpoints for review moderation: manage reports, force delete reviews.
 */

import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../auth/public';
import { AdminJwtGuard } from '../../../auth/public';
import { ReviewReportsService } from '../../application/review-reports.service';
import { ReviewsService } from '../../application/reviews.service';
import {
  AdminReportQueryDto,
  AdminReportListResponseDto,
  ReportWithReviewDto,
  ResolveReportDto,
} from '../dto';

/** Default page limit for reports list */
const DEFAULT_REPORTS_LIMIT = 20;

@ApiTags('Admin: Reviews')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly reportsService: ReviewReportsService,
  ) {}

  /**
   * List reports for moderation.
   */
  @Get('reports')
  @ApiOperation({
    summary: 'List reports',
    description: 'Returns paginated list of reports for moderation queue.',
  })
  @ApiOkResponse({
    type: AdminReportListResponseDto,
    description: 'Paginated reports list',
  })
  async listReports(@Query() query: AdminReportQueryDto): Promise<AdminReportListResponseDto> {
    const { data, total } = await this.reportsService.listForModeration({
      status: query.status,
      limit: query.limit ?? DEFAULT_REPORTS_LIMIT,
      offset: query.offset ?? 0,
    });

    return {
      data: data.map((report) => this.mapToReportDto(report)),
      total,
    };
  }

  /**
   * Resolve a report.
   */
  @Patch('reports/:reportId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve report',
    description: 'Resolves a report with given status. Can optionally hide the review.',
  })
  @ApiParam({ name: 'reportId', description: 'Report UUID' })
  @ApiOkResponse({
    description: 'Report resolved',
    schema: { type: 'object', properties: { success: { type: 'boolean' } } },
  })
  async resolveReport(
    @Param('reportId', ParseUUIDPipe) reportId: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: { id: string },
  ): Promise<{ success: boolean }> {
    await this.reportsService.resolve({
      reportId,
      moderatorId: user.id,
      status: dto.status,
      moderatorNotes: dto.moderatorNotes,
      hideReview: dto.hideReview,
    });

    return { success: true };
  }

  /**
   * Force delete a review (admin action).
   */
  @Delete(':reviewId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Force delete review',
    description: 'Soft deletes a review regardless of ownership.',
  })
  @ApiParam({ name: 'reviewId', description: 'Review UUID' })
  @ApiOkResponse({
    description: 'Review deleted',
    schema: { type: 'object', properties: { success: { type: 'boolean' } } },
  })
  async forceDeleteReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ): Promise<{ success: boolean }> {
    await this.reviewsService.forceDelete(reviewId);
    return { success: true };
  }

  private mapToReportDto(report: {
    id: string;
    reviewId: string;
    reason: string;
    details: string | null;
    status: string;
    createdAt: Date;
    moderatorId: string | null;
    moderatorNotes: string | null;
    resolvedAt: Date | null;
    review: {
      id: string;
      content: string;
      hasSpoiler: boolean;
      isDeleted: boolean;
      author: { id: string; username: string };
    };
    reporter: { id: string; username: string };
  }): ReportWithReviewDto {
    return {
      id: report.id,
      reviewId: report.reviewId,
      reason: report.reason as ReportWithReviewDto['reason'],
      details: report.details,
      status: report.status as ReportWithReviewDto['status'],
      createdAt: report.createdAt,
      moderatorId: report.moderatorId,
      moderatorNotes: report.moderatorNotes,
      resolvedAt: report.resolvedAt,
      review: {
        id: report.review.id,
        content: report.review.content,
        hasSpoiler: report.review.hasSpoiler,
        isDeleted: report.review.isDeleted,
        author: {
          id: report.review.author.id,
          username: report.review.author.username,
        },
      },
      reporter: {
        id: report.reporter.id,
        username: report.reporter.username,
      },
    };
  }
}
