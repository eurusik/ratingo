import { Inject, Injectable } from '@nestjs/common';

import { eq } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type IUserPreferencePort } from '../../domain/ports/user-preference.port';

@Injectable()
export class DrizzleUserPreferenceAdapter implements IUserPreferencePort {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getAutoSubscribeOnWatch(userId: string): Promise<boolean> {
    const [user] = await this.db
      .select({ autoSubscribeOnWatch: schema.users.autoSubscribeOnWatch })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return user?.autoSubscribeOnWatch ?? false;
  }
}
