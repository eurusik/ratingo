import { Injectable, Inject } from '@nestjs/common';

import { eq, and, asc, sql, gte } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { reviewReports, reviews, users } from '../../../../database/schema';
import type { ReportStatus } from '../../domain/constants/review.constants';
import type {
  ReviewReport,
  ReviewReportWithReview,
  CreateReportInput,
} from '../../domain/entities/review-report.entity';
import type { IReviewReportRepository } from '../../domain/repositories/review-report.repository.interface';

@Injectable()
export class DrizzleReviewReportRepository implements IReviewReportRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findById(id: string): Promise<ReviewReport | null> {
    const rows = await this.db
      .select()
      .from(reviewReports)
      .where(eq(reviewReports.id, id))
      .limit(1);

    return rows[0] ?? null;
  }

  async existsByUserAndReview(userId: string, reviewId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: reviewReports.id })
      .from(reviewReports)
      .where(and(eq(reviewReports.reporterId, userId), eq(reviewReports.reviewId, reviewId)))
      .limit(1);

    return rows.length > 0;
  }

  async create(input: CreateReportInput): Promise<ReviewReport> {
    const [report] = await this.db
      .insert(reviewReports)
      .values({
        reviewId: input.reviewId,
        reporterId: input.reporterId,
        reason: input.reason,
        details: input.details ?? null,
        status: 'pending',
        createdAt: new Date(),
      })
      .returning();

    return report;
  }

  async findForModeration(params: {
    status?: ReportStatus;
    limit?: number;
    offset?: number;
  }): Promise<ReviewReportWithReview[]> {
    const { status, limit = 20, offset = 0 } = params;

    // Alias for reporter user
    const reporterUser = schema.users;

    const conditions = status ? [eq(reviewReports.status, status)] : [];

    const rows = await this.db
      .select({
        // Report fields
        id: reviewReports.id,
        reviewId: reviewReports.reviewId,
        reporterId: reviewReports.reporterId,
        reason: reviewReports.reason,
        details: reviewReports.details,
        status: reviewReports.status,
        moderatorId: reviewReports.moderatorId,
        moderatorNotes: reviewReports.moderatorNotes,
        resolvedAt: reviewReports.resolvedAt,
        createdAt: reviewReports.createdAt,
        // Review fields
        reviewContent: reviews.content,
        reviewHasSpoiler: reviews.hasSpoiler,
        reviewIsDeleted: reviews.isDeleted,
        reviewAuthorId: reviews.userId,
        // Author username (need to join users again)
        reviewAuthorUsername: users.username,
        // Reporter username
        reporterUsername: reporterUser.username,
      })
      .from(reviewReports)
      .innerJoin(reviews, eq(reviewReports.reviewId, reviews.id))
      .innerJoin(users, eq(reviews.userId, users.id))
      .innerJoin(reporterUser, eq(reviewReports.reporterId, reporterUser.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(reviewReports.createdAt))
      .limit(limit)
      .offset(offset);

    return rows.map((row) => ({
      id: row.id,
      reviewId: row.reviewId,
      reporterId: row.reporterId,
      reason: row.reason,
      details: row.details,
      status: row.status,
      moderatorId: row.moderatorId,
      moderatorNotes: row.moderatorNotes,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
      review: {
        id: row.reviewId,
        content: row.reviewContent,
        hasSpoiler: row.reviewHasSpoiler,
        isDeleted: row.reviewIsDeleted,
        author: {
          id: row.reviewAuthorId,
          username: row.reviewAuthorUsername,
        },
      },
      reporter: {
        id: row.reporterId,
        username: row.reporterUsername,
      },
    }));
  }

  async countByStatus(status?: ReportStatus): Promise<number> {
    const conditions = status ? [eq(reviewReports.status, status)] : [];

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewReports)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result?.count ?? 0;
  }

  async updateStatus(params: {
    reportId: string;
    status: ReportStatus;
    moderatorId: string;
    moderatorNotes?: string;
  }): Promise<void> {
    await this.db
      .update(reviewReports)
      .set({
        status: params.status,
        moderatorId: params.moderatorId,
        moderatorNotes: params.moderatorNotes ?? null,
        resolvedAt: new Date(),
      })
      .where(eq(reviewReports.id, params.reportId));
  }

  async countUserReportsToday(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewReports)
      .where(and(eq(reviewReports.reporterId, userId), gte(reviewReports.createdAt, today)));

    return result?.count ?? 0;
  }
}
