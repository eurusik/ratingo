import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';

import { Injectable, Logger } from '@nestjs/common';
import type { ClockPort } from '@ratingo/ai-core';

import {
  ALLOWED_REFS,
  COMMIT_SHA_PATTERN,
  MAX_RETAINED_SNAPSHOTS,
  REF_CHECK_INTERVAL_MS,
  SkipReason,
  SnapshotLimits,
} from '../../domain/constants/snapshot.constants';
import type { CodeSnapshot, SnapshotFile } from '../../domain/entities/code-snapshot';
import { SnapshotFailure, SnapshotUnavailableError } from '../../domain/errors/investigation.errors';
import type { CodeSnapshotPort } from '../../domain/ports/code-snapshot.port';
import { inspectFileBody } from '../../domain/policies/file-inspection';
import { normalizeFilePath } from '../../domain/policies/repo-path';
import { InvalidTarError, readTarStream, type TarEntry } from '../archive/tar-reader';
import { DirectorySnapshot } from './directory-snapshot';

const API_VERSION = '2022-11-28';
const USER_AGENT = 'ratingo-code-investigator';
const SHA_MEDIA_TYPE = 'application/vnd.github.sha';
const ARCHIVE_MEDIA_TYPE = 'application/vnd.github+json';
const SHA_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const TEMP_DIRECTORY_PREFIX = 'dume-snapshots-';
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_FILE_MODE = 0o600;
const RATE_LIMIT_STATUSES = new Set([403, 429]);

export interface GithubSnapshotConfig {
  repository: string;
  apiUrl: string;
  token?: string;
}

interface CachedRef {
  sha: string;
  checkedAtMs: number;
}

interface RetainedSnapshot {
  snapshot: CodeSnapshot;
  directory: string;
  lastUsedMs: number;
}

class ArchiveCollector {
  readonly files: SnapshotFile[] = [];
  readonly skipped = new Map<string, SkipReason>();
  private unpackedBytes = 0;
  private fileCount = 0;

  constructor(private readonly directory: string) {}

  decide(entry: TarEntry): 'read' | 'skip' {
    const relative = stripArchiveRoot(entry.path);
    if (relative === undefined) return 'skip';
    if (this.fileCount >= SnapshotLimits.MAX_FILES || this.unpackedBytes + entry.size > SnapshotLimits.MAX_UNPACKED_BYTES) {
      this.skipped.set(relative, SkipReason.LIMIT_REACHED);
      return 'skip';
    }
    if (entry.size > SnapshotLimits.MAX_FILE_BYTES) {
      this.skipped.set(relative, SkipReason.TOO_LARGE);
      return 'skip';
    }
    return 'read';
  }

  async receive(entry: TarEntry, body: Buffer): Promise<void> {
    const relative = stripArchiveRoot(entry.path);
    if (relative === undefined) return;
    const normalized = normalizeFilePath(relative);
    if (!normalized.ok) {
      this.skipped.set(relative, SkipReason.UNSAFE_PATH);
      return;
    }
    const inspection = inspectFileBody(body);
    if (inspection.kind === 'skipped') {
      this.skipped.set(normalized.path, inspection.reason);
      return;
    }
    const target = path.resolve(this.directory, normalized.path);
    if (!target.startsWith(`${this.directory}${path.sep}`)) {
      this.skipped.set(normalized.path, SkipReason.UNSAFE_PATH);
      return;
    }
    try {
      await mkdir(path.dirname(target), { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
      await writeFile(target, body, { flag: 'wx', mode: PRIVATE_FILE_MODE });
    } catch {
      this.skipped.set(normalized.path, SkipReason.UNSAFE_PATH);
      return;
    }
    this.fileCount += 1;
    this.unpackedBytes += body.byteLength;
    this.files.push({ path: normalized.path, bytes: body.byteLength, lineCount: inspection.lines.length });
  }
}

const stripArchiveRoot = (entryPath: string): string | undefined => {
  const slash = entryPath.indexOf('/');
  return slash === -1 || slash === entryPath.length - 1 ? undefined : entryPath.slice(slash + 1);
};

@Injectable()
export class GithubCodeSnapshotAdapter implements CodeSnapshotPort {
  private readonly logger = new Logger(GithubCodeSnapshotAdapter.name);
  private readonly refs = new Map<string, CachedRef>();
  private readonly retained = new Map<string, RetainedSnapshot>();
  private readonly building = new Map<string, Promise<CodeSnapshot>>();
  private baseDirectory: Promise<string> | undefined;

  constructor(
    private readonly config: GithubSnapshotConfig,
    private readonly clock: ClockPort,
  ) {}

  async resolve(ref: string): Promise<CodeSnapshot> {
    if (!(ALLOWED_REFS as readonly string[]).includes(ref)) {
      throw new SnapshotUnavailableError(SnapshotFailure.REF_NOT_ALLOWED, ref);
    }
    const cached = this.refs.get(ref);
    const nowMs = this.clock.nowMs();
    if (cached !== undefined && nowMs - cached.checkedAtMs < REF_CHECK_INTERVAL_MS) {
      const fresh = this.retained.get(cached.sha);
      if (fresh !== undefined) return this.use(fresh);
    }
    let sha: string;
    try {
      sha = await this.fetchSha(ref);
    } catch (error) {
      const stale = cached === undefined ? undefined : this.retained.get(cached.sha);
      if (stale === undefined || cached === undefined) throw error;
      this.logger.warn({ message: 'snapshot.ref_check_failed_using_stale', ref, sha: cached.sha, failure: failureOf(error) });
      return this.use(stale);
    }
    this.refs.set(ref, { sha, checkedAtMs: nowMs });
    const existing = this.retained.get(sha);
    return existing === undefined ? this.buildOnce(ref, sha) : this.use(existing);
  }

  async dispose(): Promise<void> {
    const base = await this.baseDirectory?.catch(() => undefined);
    this.retained.clear();
    this.refs.clear();
    if (base !== undefined) await rm(base, { recursive: true, force: true });
  }

  private use(retained: RetainedSnapshot): CodeSnapshot {
    retained.lastUsedMs = this.clock.nowMs();
    return retained.snapshot;
  }

  private buildOnce(ref: string, sha: string): Promise<CodeSnapshot> {
    const running = this.building.get(sha);
    if (running !== undefined) return running;
    const started = this.build(ref, sha).finally(() => this.building.delete(sha));
    this.building.set(sha, started);
    return started;
  }

  private headers(accept: string): Record<string, string> {
    return {
      accept,
      'x-github-api-version': API_VERSION,
      'user-agent': USER_AGENT,
      ...(this.config.token === undefined ? {} : { authorization: `Bearer ${this.config.token}` }),
    };
  }

  private async fetchSha(ref: string): Promise<string> {
    const url = `${this.config.apiUrl}/repos/${this.config.repository}/commits/${encodeURIComponent(ref)}`;
    const response = await this.get(url, SHA_MEDIA_TYPE, SHA_TIMEOUT_MS);
    const sha = (await response.text()).trim();
    if (!COMMIT_SHA_PATTERN.test(sha)) {
      throw new SnapshotUnavailableError(SnapshotFailure.DOWNLOAD_FAILED, 'the commit lookup did not return a commit id');
    }
    return sha;
  }

  private async get(url: string, accept: string, timeoutMs: number): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, { headers: this.headers(accept), signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      throw new SnapshotUnavailableError(SnapshotFailure.DOWNLOAD_FAILED, error instanceof Error ? error.name : 'request failed');
    }
    if (response.ok) return response;
    if (response.status === 404) throw new SnapshotUnavailableError(SnapshotFailure.REF_NOT_FOUND, `HTTP ${response.status}`);
    if (RATE_LIMIT_STATUSES.has(response.status)) throw new SnapshotUnavailableError(SnapshotFailure.RATE_LIMITED, `HTTP ${response.status}`);
    throw new SnapshotUnavailableError(SnapshotFailure.DOWNLOAD_FAILED, `HTTP ${response.status}`);
  }

  private async build(ref: string, sha: string): Promise<CodeSnapshot> {
    const startedMs = this.clock.nowMs();
    const base = await this.base();
    const directory = await mkdtemp(path.join(base, `${sha.slice(0, 12)}-`));
    try {
      const collector = new ArchiveCollector(directory);
      await this.download(sha, collector);
      const snapshot = new DirectorySnapshot(ref, sha, directory, collector.files, collector.skipped);
      this.retained.set(sha, { snapshot, directory, lastUsedMs: this.clock.nowMs() });
      await this.evictOldest();
      this.logger.log({
        message: 'snapshot.ready',
        ref,
        sha,
        files: collector.files.length,
        skipped: collector.skipped.size,
        durationMs: this.clock.nowMs() - startedMs,
      });
      return snapshot;
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      this.logger.warn({ message: 'snapshot.build_failed', ref, sha, failure: failureOf(error) });
      throw error;
    }
  }

  private async download(sha: string, collector: ArchiveCollector): Promise<void> {
    const url = `${this.config.apiUrl}/repos/${this.config.repository}/tarball/${sha}`;
    const response = await this.get(url, ARCHIVE_MEDIA_TYPE, DOWNLOAD_TIMEOUT_MS);
    if (response.body === null) throw new SnapshotUnavailableError(SnapshotFailure.DOWNLOAD_FAILED, 'empty response body');
    let downloaded = 0;
    const source = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>);
    source.on('data', (chunk: Buffer) => {
      downloaded += chunk.length;
      if (downloaded > SnapshotLimits.MAX_ARCHIVE_BYTES) source.destroy(new SnapshotUnavailableError(SnapshotFailure.ARCHIVE_TOO_LARGE));
    });
    const unpacked = source.pipe(createGunzip());
    source.on('error', (error) => unpacked.destroy(error));
    try {
      await readTarStream(unpacked, collector);
    } catch (error) {
      source.destroy();
      if (error instanceof SnapshotUnavailableError) throw error;
      if (error instanceof InvalidTarError || (error as NodeJS.ErrnoException).code?.startsWith('Z_')) {
        throw new SnapshotUnavailableError(SnapshotFailure.ARCHIVE_INVALID, error instanceof Error ? error.message : undefined);
      }
      throw new SnapshotUnavailableError(SnapshotFailure.DOWNLOAD_FAILED, error instanceof Error ? error.name : undefined);
    }
  }

  private base(): Promise<string> {
    this.baseDirectory ??= mkdtemp(path.join(os.tmpdir(), TEMP_DIRECTORY_PREFIX));
    return this.baseDirectory;
  }

  private async evictOldest(): Promise<void> {
    while (this.retained.size > MAX_RETAINED_SNAPSHOTS) {
      const oldest = [...this.retained.entries()].sort(([, left], [, right]) => left.lastUsedMs - right.lastUsedMs)[0];
      if (oldest === undefined) return;
      this.retained.delete(oldest[0]);
      await rm(oldest[1].directory, { recursive: true, force: true });
    }
  }
}

const failureOf = (error: unknown): string =>
  error instanceof SnapshotUnavailableError ? error.failure : error instanceof Error ? error.name : 'unknown';
