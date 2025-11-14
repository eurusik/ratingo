/**
 * Ініціалізація єдиного екземпляра Postgres/Drizzle для Next.js,
 * стійка до HMR: запобігає надлишковим з’єднанням.
 */
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Ensure a single shared client/db across HMR reloads to avoid exhausting connections
const globalForDb = globalThis as unknown as {
  __pgSql__: ReturnType<typeof postgres> | undefined;
  __drizzleDb__: PostgresJsDatabase<typeof schema> | undefined;
};

/**
 * Повертає спільний `drizzle` клієнт; кидає помилку, якщо `DATABASE_URL` відсутній.
 */
export function getDb(): PostgresJsDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return new Proxy({}, {
      get() {
        throw new Error('DATABASE_URL environment variable is not set');
      },
    }) as unknown as PostgresJsDatabase<typeof schema>;
  }

  if (!globalForDb.__pgSql__) {
    const poolMax = Number(process.env.PG_POOL_MAX ?? 5);
    globalForDb.__pgSql__ = postgres(url, {
      max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5,
      idle_timeout: 10,
      connect_timeout: 10,
      keep_alive: 10,
    });
  }
  if (!globalForDb.__drizzleDb__) {
    globalForDb.__drizzleDb__ = drizzle(globalForDb.__pgSql__!, { schema });
  }
  return globalForDb.__drizzleDb__!;
}

// Стабільний експорт `db`, сумісний з перезавантаженнями
export const db = getDb();
