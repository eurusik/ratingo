import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import type { Database } from '../database/database.module';
import * as schema from '../database/schema';

export const TEST_DATABASE_URL = process.env.VERONICA_TEST_DATABASE_URL;

export const describeWithDatabase = TEST_DATABASE_URL ? describe : describe.skip;

const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle');

export interface TestDatabase {
  db: Database;
  reset(): Promise<void>;
  close(): Promise<void>;
}

const isolatedDatabaseName = (): string =>
  `veronica_test_${process.env.JEST_WORKER_ID ?? '0'}_${randomBytes(6).toString('hex')}`;

const urlForDatabase = (name: string): string => {
  const url = new URL(TEST_DATABASE_URL as string);
  url.pathname = `/${name}`;
  return url.toString();
};

const dropDatabase = async (admin: postgres.Sql, name: string): Promise<void> => {
  await admin.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
};

export const openTestDatabase = async (): Promise<TestDatabase> => {
  const name = isolatedDatabaseName();
  const admin = postgres(TEST_DATABASE_URL as string, { max: 1 });
  const client = postgres(urlForDatabase(name));

  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    await migrate(drizzle(client), {
      migrationsFolder: MIGRATIONS_FOLDER,
      migrationsSchema: 'ai',
    });
  } catch (error) {
    await client.end();
    await dropDatabase(admin, name);
    throw error;
  }

  return {
    db: drizzle(client, { schema }),
    reset: async () => {
      await client`TRUNCATE ai.runs, ai.digest_deliveries`;
    },
    close: async () => {
      await client.end();
      await dropDatabase(admin, name);
    },
  };
};
