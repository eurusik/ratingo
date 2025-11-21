/**
 * Ініціалізація єдиного екземпляра Postgres/Drizzle для Next.js,
 * стійка до HMR: запобігає надлишковим з’єднанням.
 */
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  __pgPool__: Pool | undefined;
  __drizzleDb__: NodePgDatabase<typeof schema> | undefined;
};

export function getDb(): NodePgDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return new Proxy(
      {},
      {
        get() {
          throw new Error('DATABASE_URL environment variable is not set');
        },
      }
    ) as unknown as NodePgDatabase<typeof schema>;
  }

  if (!globalForDb.__pgPool__) {
    const poolMax = Number(process.env.PG_POOL_MAX ?? 20);
    const pool = new Pool({
      connectionString: url,
      max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 20,
    });
    pool.on('error', (err) => {
      console.error('Помилка пулу з’єднань Postgres:', err);
    });
    globalForDb.__pgPool__ = pool;
  }
  if (!globalForDb.__drizzleDb__) {
    globalForDb.__drizzleDb__ = drizzle(globalForDb.__pgPool__, { schema });
  }
  return globalForDb.__drizzleDb__!;
}

// Стабільний експорт `db`, сумісний з перезавантаженнями
export const db = getDb();
