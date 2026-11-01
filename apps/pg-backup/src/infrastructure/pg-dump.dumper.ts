import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

import type { DatabaseDump, DatabaseDumper } from '../domain';

const ARCHIVE_EXTENSION = '.tar.gz';

export class PgDumpDumper implements DatabaseDumper {
  constructor(
    private readonly databaseUrl: string,
    private readonly directory: string,
    private readonly logger: Pick<Console, 'warn'>,
  ) {}

  async dump(baseName: string): Promise<DatabaseDump> {
    const fileName = `${baseName}${ARCHIVE_EXTENSION}`;
    const filePath = join(this.directory, fileName);
    const pgDump = spawn('pg_dump', ['--format=tar'], {
      env: { ...process.env, ...connectionEnv(this.databaseUrl) },
    });
    const stderr = collectOutput(pgDump.stderr);
    const exited = exitCodeOf(pgDump);

    try {
      await pipeline(pgDump.stdout, createGzip(), createWriteStream(filePath));
      const exitCode = await exited;
      if (exitCode !== 0) {
        throw new Error(`pg_dump exited with code ${exitCode}: ${stderr().trim()}`);
      }
    } catch (error) {
      pgDump.kill();
      await rm(filePath, { force: true });
      throw error;
    }

    this.warnAbout(stderr().trim());
    const { size } = await stat(filePath);
    return { fileName, filePath, sizeBytes: size };
  }

  async discard(dump: DatabaseDump): Promise<void> {
    await rm(dump.filePath, { force: true });
  }

  private warnAbout(warnings: string): void {
    if (warnings) this.logger.warn(`pg_dump warnings: ${warnings}`);
  }
}

export function connectionEnv(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  const sslMode = url.searchParams.get('sslmode');
  return {
    PGHOST: url.hostname,
    PGPORT: url.port || undefined,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
    ...(sslMode ? { PGSSLMODE: sslMode } : {}),
  };
}

function collectOutput(stream: NodeJS.ReadableStream): () => string {
  let output = '';
  stream.on('data', (chunk: Buffer) => {
    output += chunk.toString();
  });
  return () => output;
}

function exitCodeOf(child: ChildProcessWithoutNullStreams): Promise<number | null> {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
}
