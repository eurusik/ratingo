import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import postgres from 'postgres';

const SETUP_LOCK_KEY = 7_241_001;
const BREAKPOINT = '--> statement-breakpoint';
const EXPLORER_ROLE = 'ai_explorer';

export interface ExplorerTestDatabase {
  admin: postgres.Sql;
  explorerUrl: string;
  close(): Promise<void>;
}

export interface ExplorerTestDatabaseOptions {
  adminUrl: string;
  migrationsFolder: string;
}

interface Journal {
  entries: { tag: string }[];
}

const withDatabase = (url: string, database: string): URL => {
  const next = new URL(url);
  next.pathname = `/${database}`;
  return next;
};

const migrationStatements = (migrationsFolder: string): string[] => {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
  ) as Journal;
  return journal.entries.flatMap(({ tag }) =>
    readFileSync(join(migrationsFolder, `${tag}.sql`), 'utf8')
      .split(BREAKPOINT)
      .map((statement) => statement.trim())
      .filter((statement) => statement !== ''),
  );
};

const literal = (value: string): string => `'${value.replace(/'/g, "''")}'`;

const inheritRoleSettings = async (server: postgres.Sql, loginName: string): Promise<void> => {
  const [role] = await server`
    SELECT rolconnlimit, rolconfig FROM pg_roles WHERE rolname = ${EXPLORER_ROLE}`;
  await server.unsafe(
    `ALTER ROLE ${loginName} CONNECTION LIMIT ${Number(role?.rolconnlimit ?? -1)}`,
  );
  for (const entry of (role?.rolconfig ?? []) as string[]) {
    const [name = '', ...rest] = entry.split('=');
    const value = rest.join('=');
    await server.unsafe(
      `ALTER ROLE ${loginName} SET ${name} = ${name === 'search_path' ? value : literal(value)}`,
    );
  }
};

const randomName = (prefix: string): string => `${prefix}_${randomBytes(6).toString('hex')}`;

interface DatabaseNames {
  databaseName: string;
  loginName: string;
  loginPassword: string;
}

const setUp = async (
  server: postgres.Sql,
  { adminUrl, migrationsFolder }: ExplorerTestDatabaseOptions,
  { databaseName, loginName, loginPassword }: DatabaseNames,
): Promise<ExplorerTestDatabase> => {
  await server.unsafe(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
  const admin = postgres(withDatabase(adminUrl, databaseName).toString(), {
    max: 2,
    onnotice: () => undefined,
  });
  await admin.begin(async (transaction) => {
    for (const statement of migrationStatements(migrationsFolder)) {
      await transaction.unsafe(statement);
    }
  });
  await server.unsafe(
    `CREATE ROLE ${loginName} LOGIN PASSWORD '${loginPassword}' IN ROLE ${EXPLORER_ROLE}`,
  );
  await inheritRoleSettings(server, loginName);
  const explorerUrl = withDatabase(adminUrl, databaseName);
  explorerUrl.username = loginName;
  explorerUrl.password = loginPassword;
  return {
    admin,
    explorerUrl: explorerUrl.toString(),
    close: async () => {
      await admin.end({ timeout: 2 });
      await server.unsafe(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
      await server.unsafe(`DROP ROLE IF EXISTS ${loginName}`);
      await server.end({ timeout: 2 });
    },
  };
};

export const createExplorerTestDatabase = async (
  options: ExplorerTestDatabaseOptions,
): Promise<ExplorerTestDatabase> => {
  const names: DatabaseNames = {
    databaseName: randomName('explorer_eval'),
    loginName: randomName('explorer_login'),
    loginPassword: randomBytes(18).toString('hex'),
  };
  const server = postgres(options.adminUrl, { max: 1, onnotice: () => undefined });
  await server.unsafe(`SELECT pg_advisory_lock(${SETUP_LOCK_KEY})`);
  try {
    const database = await setUp(server, options, names);
    await server.unsafe(`SELECT pg_advisory_unlock(${SETUP_LOCK_KEY})`);
    return database;
  } catch (error) {
    await server.unsafe(`DROP DATABASE IF EXISTS ${names.databaseName} WITH (FORCE)`);
    await server.unsafe(`DROP ROLE IF EXISTS ${names.loginName}`);
    await server.end({ timeout: 2 });
    throw error;
  }
};
