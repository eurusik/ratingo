import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import type { Database } from '../database/database.module';
import * as schema from '../database/schema';

export const TEST_DATABASE_URL = process.env.VERONICA_TEST_DATABASE_URL;

export const describeWithDatabase = TEST_DATABASE_URL ? describe : describe.skip;

export interface TestDatabase {
  db: Database;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export const openTestDatabase = (): TestDatabase => {
  const client = postgres(TEST_DATABASE_URL as string);
  return {
    db: drizzle(client, { schema }),
    reset: async () => {
      await client`DELETE FROM ai.runs`;
      await client`DELETE FROM ai.digest_deliveries`;
    },
    close: () => client.end(),
  };
};
