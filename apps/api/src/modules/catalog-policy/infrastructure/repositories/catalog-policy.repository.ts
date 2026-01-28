/**
 * Catalog Policy Repository
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, desc } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { PolicyNotFoundError } from '../../domain/errors';
import type { ICatalogPolicyRepository } from '../../domain/repositories';
import type { CatalogPolicy, PolicyConfig } from '../../domain/types/policy.types';

@Injectable()
export class CatalogPolicyRepository implements ICatalogPolicyRepository {
  private readonly logger = new Logger(CatalogPolicyRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findActive(): Promise<CatalogPolicy | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.catalogPolicies)
        .where(eq(schema.catalogPolicies.isActive, true))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error('Failed to find active policy', error);
      throw new DatabaseException('Failed to find active policy', error);
    }
  }

  async findById(id: string): Promise<CatalogPolicy | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.catalogPolicies)
        .where(eq(schema.catalogPolicies.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to find policy ${id}`, error);
      throw new DatabaseException(`Failed to find policy ${id}`, error);
    }
  }

  async findByVersion(version: number): Promise<CatalogPolicy | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.catalogPolicies)
        .where(eq(schema.catalogPolicies.version, version))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to find policy version ${version}`, error);
      throw new DatabaseException(`Failed to find policy version ${version}`, error);
    }
  }

  async create(policy: PolicyConfig): Promise<CatalogPolicy> {
    try {
      // Get next version number
      const maxVersionResult = await this.db
        .select({ maxVersion: schema.catalogPolicies.version })
        .from(schema.catalogPolicies)
        .orderBy(desc(schema.catalogPolicies.version))
        .limit(1);

      const nextVersion = maxVersionResult.length > 0 ? maxVersionResult[0].maxVersion + 1 : 1;

      // Insert new policy
      const result = await this.db
        .insert(schema.catalogPolicies)
        .values({
          version: nextVersion,
          isActive: false,
          policy: policy as unknown as (typeof schema.catalogPolicies.$inferInsert)['policy'], // JSONB type
          createdAt: new Date(),
          activatedAt: null,
        })
        .returning();

      this.logger.log(`Created policy version ${nextVersion}`);

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error('Failed to create policy', error);
      throw new DatabaseException('Failed to create policy', error);
    }
  }

  async activate(id: string): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        // Deactivate all policies
        await tx
          .update(schema.catalogPolicies)
          .set({ isActive: false, activatedAt: null })
          .where(eq(schema.catalogPolicies.isActive, true));

        // Activate the specified policy
        const result = await tx
          .update(schema.catalogPolicies)
          .set({ isActive: true, activatedAt: new Date() })
          .where(eq(schema.catalogPolicies.id, id))
          .returning();

        if (result.length === 0) {
          throw new PolicyNotFoundError(id);
        }

        this.logger.log(`Activated policy ${id} (version ${result[0].version})`);
      });
    } catch (error) {
      this.logger.error(`Failed to activate policy ${id}`, error);
      throw new DatabaseException(`Failed to activate policy ${id}`, error);
    }
  }

  async findAll(): Promise<CatalogPolicy[]> {
    try {
      const result = await this.db
        .select()
        .from(schema.catalogPolicies)
        .orderBy(desc(schema.catalogPolicies.version));

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error('Failed to find all policies', error);
      throw new DatabaseException('Failed to find all policies', error);
    }
  }

  private mapToEntity(row: typeof schema.catalogPolicies.$inferSelect): CatalogPolicy {
    return {
      id: row.id,
      version: row.version,
      isActive: row.isActive,
      policy: row.policy as PolicyConfig,
      createdAt: row.createdAt,
      activatedAt: row.activatedAt,
    };
  }
}
