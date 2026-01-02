/**
 * Provider Registry Repository
 *
 * Drizzle implementation for managing canonical provider brands.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PROVIDER_PRIORITY } from '../../../../common/constants/provider.constants';
import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type IProviderRegistryRepository } from '../../domain/repositories/provider-registry.repository.interface';
import {
  type Provider,
  type CreateProviderDto,
  type UpdateProviderDto,
} from '../../domain/types/provider.types';

@Injectable()
export class ProviderRegistryRepository implements IProviderRegistryRepository {
  private readonly logger = new Logger(ProviderRegistryRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findAll(options?: { includeInactive?: boolean }): Promise<Provider[]> {
    try {
      const conditions = options?.includeInactive
        ? undefined
        : eq(schema.providerRegistry.isActive, true);

      const result = await this.db
        .select()
        .from(schema.providerRegistry)
        .where(conditions)
        .orderBy(schema.providerRegistry.priority);

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error('Failed to find all providers', error);
      throw new DatabaseException('Failed to find all providers', error);
    }
  }

  async findById(id: string): Promise<Provider | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.providerRegistry)
        .where(eq(schema.providerRegistry.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to find provider ${id}`, error);
      throw new DatabaseException(`Failed to find provider ${id}`, error);
    }
  }

  async findByBrandGroup(brandGroup: string): Promise<Provider[]> {
    try {
      const result = await this.db
        .select()
        .from(schema.providerRegistry)
        .where(
          and(
            eq(schema.providerRegistry.brandGroup, brandGroup),
            eq(schema.providerRegistry.isActive, true),
          ),
        )
        .orderBy(schema.providerRegistry.priority);

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error(`Failed to find providers by brand group ${brandGroup}`, error);
      throw new DatabaseException(`Failed to find providers by brand group ${brandGroup}`, error);
    }
  }

  async create(data: CreateProviderDto): Promise<Provider> {
    try {
      const result = await this.db
        .insert(schema.providerRegistry)
        .values({
          id: data.id,
          displayName: data.displayName,
          brandGroup: data.brandGroup ?? null,
          logoPath: data.logoPath ?? null,
          priority: data.priority ?? DEFAULT_PROVIDER_PRIORITY,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      this.logger.log(`Created provider ${data.id}`);

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to create provider ${data.id}`, error);
      throw new DatabaseException(`Failed to create provider ${data.id}`, error);
    }
  }

  async update(id: string, data: UpdateProviderDto): Promise<Provider> {
    try {
      const updateData: Partial<typeof schema.providerRegistry.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (data.displayName !== undefined) updateData.displayName = data.displayName;
      if (data.brandGroup !== undefined) updateData.brandGroup = data.brandGroup;
      if (data.logoPath !== undefined) updateData.logoPath = data.logoPath;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const result = await this.db
        .update(schema.providerRegistry)
        .set(updateData)
        .where(eq(schema.providerRegistry.id, id))
        .returning();

      if (result.length === 0) {
        throw new DatabaseException(`Provider ${id} not found`);
      }

      this.logger.log(`Updated provider ${id}`);

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to update provider ${id}`, error);
      throw new DatabaseException(`Failed to update provider ${id}`, error);
    }
  }

  async deactivate(id: string): Promise<void> {
    try {
      const result = await this.db
        .update(schema.providerRegistry)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(schema.providerRegistry.id, id))
        .returning();

      if (result.length === 0) {
        throw new DatabaseException(`Provider ${id} not found`);
      }

      this.logger.log(`Deactivated provider ${id}`);
    } catch (error) {
      this.logger.error(`Failed to deactivate provider ${id}`, error);
      throw new DatabaseException(`Failed to deactivate provider ${id}`, error);
    }
  }

  private mapToEntity(row: typeof schema.providerRegistry.$inferSelect): Provider {
    return {
      id: row.id,
      displayName: row.displayName,
      brandGroup: row.brandGroup,
      logoPath: row.logoPath,
      priority: row.priority ?? DEFAULT_PROVIDER_PRIORITY,
      isActive: row.isActive ?? true,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
