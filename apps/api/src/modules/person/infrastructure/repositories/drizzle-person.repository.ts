import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, inArray, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type Person, type PersonCreditsResult } from '../../domain/entities/person.entity';
import {
  type CreditSeed,
  type IPersonRepository,
  type PersonCreditsQueryOptions,
  type PersonDetailsUpdate,
  type PersonSeed,
} from '../../domain/repositories/person.repository.interface';
import { mapPerson, type PersonRow } from '../mappers/person.mapper';
import { PersonCreditsQuery } from '../queries/person-credits.query';

@Injectable()
export class DrizzlePersonRepository implements IPersonRepository {
  private readonly logger = new Logger(DrizzlePersonRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly personCreditsQuery: PersonCreditsQuery,
  ) {}

  async findByTmdbId(tmdbId: number): Promise<Person | null> {
    return withDbError(
      'find person by tmdbId',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.persons)
          .where(eq(schema.persons.tmdbId, tmdbId))
          .limit(1);

        return row ? mapPerson(row as PersonRow) : null;
      },
      { tmdbId },
    );
  }

  async writeMediaCredits(
    mediaItemId: string,
    persons: PersonSeed[],
    credits: CreditSeed[],
  ): Promise<void> {
    return withDbError(
      'write media credits',
      this.logger,
      async () => {
        await this.db.transaction(async (tx) => {
          // 1. Upsert persons by tmdbId. Biography block is left untouched —
          //    it is enriched lazily on the person page, not during ingest.
          if (persons.length > 0) {
            await tx
              .insert(schema.persons)
              .values(
                persons.map((p) => ({
                  tmdbId: p.tmdbId,
                  slug: p.slug,
                  name: p.name,
                  profilePath: p.profilePath,
                  knownForDepartment: p.knownForDepartment,
                })),
              )
              .onConflictDoUpdate({
                target: schema.persons.tmdbId,
                // Refresh identity fields, but never clobber lazily-enriched data
                // with the always-null seed values. COALESCE keeps the existing
                // value when the incoming credit field is null; knownForDepartment
                // is enriched-only, so it is left untouched here.
                set: {
                  slug: sqlExcluded('slug'),
                  name: sqlExcluded('name'),
                  profilePath: sql`coalesce(excluded.profile_path, ${schema.persons.profilePath})`,
                  updatedAt: new Date(),
                },
              });
          }

          // 2. Resolve tmdbId -> person uuid for this media's credits.
          const tmdbIds = [...new Set(credits.map((c) => c.personTmdbId))];
          const idRows = tmdbIds.length
            ? await tx
                .select({ id: schema.persons.id, tmdbId: schema.persons.tmdbId })
                .from(schema.persons)
                .where(inArrayTmdb(tmdbIds))
            : [];
          const idByTmdb = new Map(idRows.map((r) => [r.tmdbId, r.id]));

          // 3. Replace credits for this media item (delete-then-insert = idempotent).
          await tx
            .delete(schema.mediaCredits)
            .where(eq(schema.mediaCredits.mediaItemId, mediaItemId));

          const rows = credits
            .map((c) => {
              const personId = idByTmdb.get(c.personTmdbId);
              if (!personId) return null;
              return {
                mediaItemId,
                personId,
                creditType: c.creditType,
                character: c.character,
                job: c.job,
                department: c.department,
                order: c.order,
              };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);

          if (rows.length > 0) {
            await tx.insert(schema.mediaCredits).values(rows);
          }
        });
      },
      { mediaItemId },
    );
  }

  async updateDetails(personId: string, details: PersonDetailsUpdate): Promise<void> {
    return withDbError(
      'update person details',
      this.logger,
      async () => {
        await this.db
          .update(schema.persons)
          .set({
            biography: details.biography,
            birthday: details.birthday,
            deathday: details.deathday,
            placeOfBirth: details.placeOfBirth,
            knownForDepartment: details.knownForDepartment,
            popularity: details.popularity,
            profilePath: details.profilePath,
            detailsFetchedAt: details.detailsFetchedAt,
            updatedAt: new Date(),
          })
          .where(eq(schema.persons.id, personId));
      },
      { personId },
    );
  }

  async findEligibleCredits(
    personId: string,
    options: PersonCreditsQueryOptions,
  ): Promise<PersonCreditsResult> {
    return this.personCreditsQuery.execute(personId, options);
  }
}

// --- local SQL helpers ---

/** Reference the conflicting INSERT row's column in an upsert SET clause. */
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

function inArrayTmdb(tmdbIds: number[]) {
  return inArray(schema.persons.tmdbId, tmdbIds);
}
