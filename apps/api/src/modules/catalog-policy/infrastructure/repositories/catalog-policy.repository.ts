/**
 * Catalog Policy Repository
 *
 * Repository for managing catalog policies with versioning and activation.
 * Ensures single active policy invariant via database constraints.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, desc } from 'drizzle-orm';
import { CatalogPolicy, PolicyConfig } from '../../domain/types/policy.types';
import { DatabaseException } from '../../../../common/exceptions';

export const CATALOG_POLICY_REPOSITORY = 'CATALOG_POLICY_REPOSITORY';

export interface ICatalogPolicyRepository {
  /**
   * Finds the currently active policy.
   * Returns null if no policy is active (should not happen after seed).
   */
  findActive(): Promise<CatalogPolicy | null>;

  /**
   * Finds a policy by ID.
   */
  findById(id: string): Promise<CatalogPolicy | null>;

  /**
   * Finds a policy by version number.
   */
  findByVersion(version: number): Promise<CatalogPolicy | null>;

  /**
   * Creates a new policy with auto-incremented version.
   * Does NOT activate it automatically.
   */
  create(policy: PolicyConfig): Promise<CatalogPolicy>;

  /**
   * Activates a policy by ID.
   * Deactivates the previous active policy in a transaction.
   *
   * Design Decision DD-2: Active policy always exists after seed.
   * This ensures NO_ACTIVE_POLICY is only a fallback state.
   */
  activate(id: string): Promise<void>;

  /**
   * Finds all policies ordered by version descending.
   */
  findAll(): Promise<CatalogPolicy[]>;
}

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
          policy: policy as any, // JSONB type
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
          throw new Error(`Policy with id ${id} not found`);
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
