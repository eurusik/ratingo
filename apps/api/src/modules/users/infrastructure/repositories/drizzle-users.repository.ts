import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '@/common/utils/db-error.utils';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type User } from '../../domain/entities/user.entity';
import {
  type CreateUserData,
  type IUsersRepository,
  type UpdateUserProfileData,
} from '../../domain/repositories/users.repository.interface';

/**
 * Drizzle implementation of Users repository.
 */
@Injectable()
export class DrizzleUsersRepository implements IUsersRepository {
  private readonly logger = new Logger(DrizzleUsersRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Finds user by ID.
   *
   * @param {string} id - User identifier
   * @returns {Promise<User | null>} User or null
   */
  async findById(id: string): Promise<User | null> {
    return withDbError(
      'fetch user by id',
      this.logger,
      async () => {
        const [row] = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
        return row ? this.mapRow(row) : null;
      },
      { id },
    );
  }

  /**
   * Finds user by email.
   *
   * @param {string} email - User email
   * @returns {Promise<User | null>} User or null
   */
  async findByEmail(email: string): Promise<User | null> {
    return withDbError(
      'fetch user by email',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, email));
        return row ? this.mapRow(row) : null;
      },
      { email },
    );
  }

  /**
   * Finds user by username.
   *
   * @param {string} username - Username
   * @returns {Promise<User | null>} User or null
   */
  async findByUsername(username: string): Promise<User | null> {
    return withDbError(
      'fetch user by username',
      this.logger,
      async () => {
        const [row] = await this.db
          .select()
          .from(schema.users)
          .where(eq(schema.users.username, username));
        return row ? this.mapRow(row) : null;
      },
      { username },
    );
  }

  /**
   * Creates a new user.
   *
   * @param {CreateUserData} data - Creation payload
   * @returns {Promise<User>} Created user
   */
  async create(data: CreateUserData): Promise<User> {
    return withDbError(
      'create user',
      this.logger,
      async () => {
        const [row] = await this.db
          .insert(schema.users)
          .values({
            email: data.email,
            username: data.username,
            passwordHash: data.passwordHash,
            avatarUrl: data.avatarUrl ?? null,
            bio: data.bio ?? null,
            location: data.location ?? null,
            website: data.website ?? null,
            preferredLanguage: data.preferredLanguage ?? null,
            preferredRegion: data.preferredRegion ?? null,
            isProfilePublic: data.isProfilePublic ?? true,
            showWatchHistory: data.showWatchHistory ?? true,
            showRatings: data.showRatings ?? true,
            allowFollowers: data.allowFollowers ?? true,
            role: data.role ?? 'user',
          })
          .returning();
        return this.mapRow(row);
      },
      { email: data.email },
    );
  }

  /**
   * Updates user profile (avatar/username).
   *
   * @param {string} id - User identifier
   * @param {UpdateUserProfileData} data - Profile payload
   * @returns {Promise<User>} Updated user
   */
  async updateProfile(id: string, data: UpdateUserProfileData): Promise<User> {
    return withDbError(
      'update user profile',
      this.logger,
      async () => {
        const updatePayload: Partial<typeof schema.users.$inferInsert> = {
          updatedAt: new Date(),
        };

        if (data.avatarUrl !== undefined) updatePayload.avatarUrl = data.avatarUrl;
        if (data.username !== undefined) updatePayload.username = data.username;
        if (data.bio !== undefined) updatePayload.bio = data.bio;
        if (data.location !== undefined) updatePayload.location = data.location;
        if (data.website !== undefined) updatePayload.website = data.website;
        if (data.preferredLanguage !== undefined)
          updatePayload.preferredLanguage = data.preferredLanguage;
        if (data.preferredRegion !== undefined)
          updatePayload.preferredRegion = data.preferredRegion;
        if (data.isProfilePublic !== undefined)
          updatePayload.isProfilePublic = data.isProfilePublic;
        if (data.showWatchHistory !== undefined)
          updatePayload.showWatchHistory = data.showWatchHistory;
        if (data.showRatings !== undefined) updatePayload.showRatings = data.showRatings;
        if (data.allowFollowers !== undefined) updatePayload.allowFollowers = data.allowFollowers;
        if (data.autoSubscribeOnWatch !== undefined)
          updatePayload.autoSubscribeOnWatch = data.autoSubscribeOnWatch;

        const [row] = await this.db
          .update(schema.users)
          .set(updatePayload)
          .where(eq(schema.users.id, id))
          .returning();
        return this.mapRow(row);
      },
      { id },
    );
  }

  /**
   * Updates user password hash.
   *
   * @param {string} id - User identifier
   * @param {string} passwordHash - Hashed password
   * @returns {Promise<void>} Nothing
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    return withDbError(
      'update password',
      this.logger,
      async () => {
        await this.db
          .update(schema.users)
          .set({ passwordHash, updatedAt: new Date() })
          .where(eq(schema.users.id, id));
      },
      { id },
    );
  }

  private mapRow(row: typeof schema.users.$inferSelect): User {
    return {
      id: row.id,
      email: row.email,
      username: row.username,
      passwordHash: row.passwordHash,
      avatarUrl: row.avatarUrl,
      bio: row.bio,
      location: row.location,
      website: row.website,
      preferredLanguage: row.preferredLanguage,
      preferredRegion: row.preferredRegion,
      isProfilePublic: row.isProfilePublic,
      showWatchHistory: row.showWatchHistory,
      showRatings: row.showRatings,
      allowFollowers: row.allowFollowers,
      autoSubscribeOnWatch: row.autoSubscribeOnWatch,
      role: row.role as User['role'],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
