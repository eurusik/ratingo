import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { type MediaType } from '../../../../common/enums/media-type.enum';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../catalog-policy/public';
import { type PersonCreditTypeValue } from '../../domain/constants/person.constants';
import {
  type PersonCreditItem,
  type PersonCreditsResult,
} from '../../domain/entities/person.entity';
import { type PersonCreditsQueryOptions } from '../../domain/repositories/person.repository.interface';

interface CreditRow {
  mediaItemId: string;
  type: MediaType;
  tmdbId: number;
  title: string;
  slug: string;
  posterPath: string | null;
  releaseDate: Date | null;
  ratingoScore: number | null;
  character: string | null;
  jobs: string[] | null;
}

/**
 * Lists a person's works (one row per title), restricted to catalog-eligible
 * media items.
 *
 * Reuses the catalog eligibility join (active policy + `context = catalog` +
 * `status = eligible`) so the returned works always have a real catalog page.
 * Cast and crew contributions on the same title are merged into one row.
 */
@Injectable()
export class PersonCreditsQuery {
  private readonly logger = new Logger(PersonCreditsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async execute(
    personId: string,
    options: PersonCreditsQueryOptions,
  ): Promise<PersonCreditsResult> {
    const { limit, offset, creditType } = options;

    return withDbError('list person credits', this.logger, async () => {
      const conditions = this.buildConditions(personId, creditType);

      const rows = (await this.db
        .select({
          mediaItemId: schema.mediaItems.id,
          type: schema.mediaItems.type,
          tmdbId: schema.mediaItems.tmdbId,
          title: schema.mediaItems.title,
          slug: schema.mediaItems.slug,
          posterPath: schema.mediaItems.posterPath,
          releaseDate: schema.mediaItems.releaseDate,
          ratingoScore: schema.mediaStats.ratingoScore,
          // Merge a person's cast + crew contributions on the same title.
          character: sql<
            string | null
          >`max(${schema.mediaCredits.character}) filter (where ${schema.mediaCredits.creditType} = 'cast')`,
          jobs: sql<
            string[]
          >`coalesce(array_remove(array_agg(distinct ${schema.mediaCredits.job}) filter (where ${schema.mediaCredits.creditType} = 'crew'), null), '{}')`,
        })
        .from(schema.mediaCredits)
        .innerJoin(schema.mediaItems, eq(schema.mediaCredits.mediaItemId, schema.mediaItems.id))
        .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
        .innerJoin(
          schema.mediaCatalogEvaluations,
          and(
            eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
            eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
            eq(schema.mediaCatalogEvaluations.context, EvaluationContext.CATALOG),
            eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
          ),
        )
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(and(...conditions))
        .groupBy(
          schema.mediaItems.id,
          schema.mediaItems.type,
          schema.mediaItems.tmdbId,
          schema.mediaItems.title,
          schema.mediaItems.slug,
          schema.mediaItems.posterPath,
          schema.mediaItems.releaseDate,
          schema.mediaStats.ratingoScore,
        )
        .orderBy(
          sql`${schema.mediaStats.ratingoScore} DESC NULLS LAST`,
          sql`${schema.mediaItems.releaseDate} DESC NULLS LAST`,
        )
        .limit(limit)
        .offset(offset)) as CreditRow[];

      const total = await this.countTotal(conditions);

      return { items: rows.map((r) => this.mapItem(r)), total };
    });
  }

  private buildConditions(personId: string, creditType?: PersonCreditTypeValue): SQL[] {
    const conditions: SQL[] = [
      eq(schema.mediaCredits.personId, personId),
      eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
      isNull(schema.mediaItems.deletedAt),
    ];

    if (creditType) {
      conditions.push(eq(schema.mediaCredits.creditType, creditType));
    }

    return conditions;
  }

  private async countTotal(conditions: SQL[]): Promise<number> {
    const [row] = await this.db
      .select({ total: sql<number>`count(distinct ${schema.mediaItems.id})` })
      .from(schema.mediaCredits)
      .innerJoin(schema.mediaItems, eq(schema.mediaCredits.mediaItemId, schema.mediaItems.id))
      .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
      .innerJoin(
        schema.mediaCatalogEvaluations,
        and(
          eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
          eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
          eq(schema.mediaCatalogEvaluations.context, EvaluationContext.CATALOG),
          eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
        ),
      )
      .where(and(...conditions));

    return Number(row?.total ?? 0);
  }

  private mapItem(row: CreditRow): PersonCreditItem {
    return {
      mediaItemId: row.mediaItemId,
      type: row.type,
      tmdbId: row.tmdbId,
      title: row.title,
      slug: row.slug,
      posterPath: row.posterPath,
      releaseDate: row.releaseDate,
      ratingoScore: row.ratingoScore,
      character: row.character,
      jobs: row.jobs ?? [],
    };
  }
}
