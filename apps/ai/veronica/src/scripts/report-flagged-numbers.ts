import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '../database/schema';
import {
  ExportArgumentError,
  parseExportArgs,
} from '../modules/chat/domain/policies/exchange-export.policy';
import { flagsReportOf } from '../modules/chat/domain/policies/flags-report.policy';
import { PostgresChatExchangeRepository } from '../modules/chat/infrastructure/repositories/postgres.chat-exchange-repository';

const MISSING_DATABASE_MESSAGE = 'DATABASE_URL не задано';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === '') {
    throw new ExportArgumentError(MISSING_DATABASE_MESSAGE);
  }
  const { sinceMs } = parseExportArgs(process.argv.slice(2), Date.now());
  const client = postgres(databaseUrl, { max: 1 });
  try {
    const repository = new PostgresChatExchangeRepository(drizzle(client, { schema }));
    const exchanges = await repository.search({ sinceMs });
    process.stdout.write(`${JSON.stringify(flagsReportOf(exchanges, sinceMs), null, 2)}\n`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Звіт не вдався'}\n`);
  process.exitCode = 1;
});
