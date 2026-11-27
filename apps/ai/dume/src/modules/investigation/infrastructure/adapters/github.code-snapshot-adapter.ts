import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';

import { Injectable, Logger } from '@nestjs/common';
import type { ClockPort } from '@ratingo/ai-core';

import {
  ALLOWED_REFS,
  COMMIT_SHA_PATTERN,
  FAILED_BUILD_MEMORY_MS,
  MAX_RETAINED_SNAPSHOTS,
  REF_CHECK_INTERVAL_MS,
  SNAPSHOT_IN_USE_MS,
  SnapshotLimits,
} from '../../domain/constants/snapshot.constants';
import type { CodeSnapshot } from '../../domain/entities/code-snapshot';
import {
  SnapshotFailure,
  SnapshotUnavailableError,
} from '../../domain/errors/investigation.errors';
import type { CodeSnapshotPort } from '../../domain/ports/code-snapshot.port';
import { ArchiveCollector } from '../archive/archive-collector';
import { InvalidTarError, TarLimitError, readTarStream } from '../archive/tar-reader';
import { DirectorySnapshot } from './directory-snapshot';

const API_VERSION = '2022-11-28';
const USER_AGENT = 'ratingo-code-investigator';
const SHA_MEDIA_TYPE = 'application/vnd.github.sha';
const ARCHIVE_MEDIA_TYPE = 'application/vnd.github+json';
const SHA_TIMEOUT_MS = 15_000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 120_000;
const TEMP_DIRECTORY_PREFIX = 'dume-snapshots-';
const RATE_LIMIT_STATUS = 429;
const FORBIDDEN_STATUS = 403;
const NOT_FOUND_STATUS = 404;
const ZLIB_ERROR_PREFIX = 'Z_';
const TIMEOUT_ERROR_NAMES = new Set(['TimeoutError', 'AbortError']);

export interface GithubSnapshotConfig {
  repository: string;
  apiUrl: string;
  token?: string;
  downloadTimeoutMs?: number;
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

interface FailedBuild {
  atMs: number;
  error: SnapshotUnavailableError;
}

const failureOf = (error: unknown): string =>
  error instanceof SnapshotUnavailableError
    ? error.failure
    : error instanceof Error
      ? error.name
      : 'unknown';

const errorCodeOf = (error: unknown): string | undefined => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
};

const toSnapshotError = (error: unknown): SnapshotUnavailableError => {
  if (error instanceof SnapshotUnavailableError) return error;
  if (error instanceof TarLimitError) {
    return new SnapshotUnavailableError(SnapshotFailure.ARCHIVE_TOO_LARGE, error.message);
  }
  if (error instanceof InvalidTarError || errorCodeOf(error)?.startsWith(ZLIB_ERROR_PREFIX)) {
    return new SnapshotUnavailableError(
      SnapshotFailure.ARCHIVE_INVALID,
      error instanceof Error ? error.message : undefined,
    );
  }
  const name = error instanceof Error ? error.name : undefined;
  const detail = name !== undefined && TIMEOUT_ERROR_NAMES.has(name) ? 'timeout' : name;
  return new SnapshotUnavailableError(SnapshotFailure.DOWNLOAD_FAILED, detail);
};

const isRateLimited = (response: Response): boolean =>
  response.status === RATE_LIMIT_STATUS ||
  (response.status === FORBIDDEN_STATUS &&
    (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')));

@Injectable()
export class GithubCodeSnapshotAdapter implements CodeSnapshotPort {
  private readonly logger = new Logger(GithubCodeSnapshotAdapter.name);
  private readonly refs = new Map<string, CachedRef>();
  private readonly lastServedSha = new Map<string, string>();
  private readonly retained = new Map<string, RetainedSnapshot>();
  private readonly building = new Map<string, Promise<CodeSnapshot>>();
  private readonly failedBuilds = new Map<string, FailedBuild>();
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
      if (fresh !== undefined) return this.serve(ref, cached.sha, fresh);
    }
    let sha: string;
    try {
      sha = await this.fetchSha(ref);
    } catch (error) {
      return this.fallbackOrThrow(ref, error, 'snapshot.ref_check_failed_using_previous');
    }
    this.refs.set(ref, { sha, checkedAtMs: nowMs });
    const existing = this.retained.get(sha);
    if (existing !== undefined) return this.serve(ref, sha, existing);
    try {
      return await this.buildOnce(ref, sha);
    } catch (error) {
      return this.fallbackOrThrow(ref, error, 'snapshot.refresh_failed_using_previous');
    }
  }

  async dispose(): Promise<void> {
    const base = await this.baseDirectory?.catch(() => undefined);
    this.retained.clear();
    this.refs.clear();
    this.lastServedSha.clear();
    if (base !== undefined) await rm(base, { recursive: true, force: true });
  }

  private serve(ref: string, sha: string, retained: RetainedSnapshot): CodeSnapshot {
    retained.lastUsedMs = this.clock.nowMs();
    this.lastServedSha.set(ref, sha);
    return retained.snapshot;
  }

  private fallbackOrThrow(ref: string, error: unknown, event: string): CodeSnapshot {
    const sha = this.lastServedSha.get(ref);
    const previous = sha === undefined ? undefined : this.retained.get(sha);
    if (sha === undefined || previous === undefined) throw error;
    this.logger.warn({ message: event, ref, sha, failure: failureOf(error) });
    return this.serve(ref, sha, previous);
  }

  private buildOnce(ref: string, sha: string): Promise<CodeSnapshot> {
    const failed = this.failedBuilds.get(sha);
    if (failed !== undefined && this.clock.nowMs() - failed.atMs < FAILED_BUILD_MEMORY_MS) {
      return Promise.reject(failed.error);
    }
    const running = this.building.get(sha);
    if (running !== undefined) return running;
    const started = this.build(ref, sha)
      .then((snapshot) => {
        this.failedBuilds.delete(sha);
        return snapshot;
      })
      .catch((error: unknown) => {
        const snapshotError = toSnapshotError(error);
        this.rememberFailure(sha, snapshotError);
        throw snapshotError;
      })
      .finally(() => this.building.delete(sha));
    this.building.set(sha, started);
    return started;
  }

  private rememberFailure(sha: string, error: SnapshotUnavailableError): void {
    const nowMs = this.clock.nowMs();
    for (const [knownSha, failed] of this.failedBuilds) {
      if (nowMs - failed.atMs >= FAILED_BUILD_MEMORY_MS) this.failedBuilds.delete(knownSha);
    }
    this.failedBuilds.set(sha, { atMs: nowMs, error });
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
      throw new SnapshotUnavailableError(
        SnapshotFailure.DOWNLOAD_FAILED,
        'the commit lookup did not return a commit id',
      );
    }
    return sha;
  }

  private async get(url: string, accept: string, timeoutMs: number): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: this.headers(accept),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw toSnapshotError(error);
    }
    if (response.ok) return response;
    await response.body?.cancel().catch(() => undefined);
    const detail = `HTTP ${response.status}`;
    if (response.status === NOT_FOUND_STATUS) {
      throw new SnapshotUnavailableError(SnapshotFailure.REF_NOT_FOUND, detail);
    }
    throw new SnapshotUnavailableError(
      isRateLimited(response) ? SnapshotFailure.RATE_LIMITED : SnapshotFailure.DOWNLOAD_FAILED,
      detail,
    );
  }

  private async build(ref: string, sha: string): Promise<CodeSnapshot> {
    const startedMs = this.clock.nowMs();
    const base = await this.base();
    const directory = await mkdtemp(path.join(base, `${sha.slice(0, 12)}-`));
    try {
      const collector = new ArchiveCollector(directory);
      await this.download(sha, collector);
      const snapshot = new DirectorySnapshot(
        ref,
        sha,
        directory,
        collector.files,
        collector.skipped,
      );
      this.retained.set(sha, { snapshot, directory, lastUsedMs: this.clock.nowMs() });
      await this.evictOldest();
      this.lastServedSha.set(ref, sha);
      this.logger.log({
        message: 'snapshot.ready',
        ref,
        sha,
        files: collector.files.length,
        skipped: collector.skipped.count(),
        durationMs: this.clock.nowMs() - startedMs,
      });
      return snapshot;
    } catch (error) {
      this.retained.delete(sha);
      await rm(directory, { recursive: true, force: true });
      this.logger.warn({ message: 'snapshot.build_failed', ref, sha, failure: failureOf(error) });
      throw error;
    }
  }

  private async download(sha: string, collector: ArchiveCollector): Promise<void> {
    const url = `${this.config.apiUrl}/repos/${this.config.repository}/tarball/${sha}`;
    const response = await this.get(
      url,
      ARCHIVE_MEDIA_TYPE,
      this.config.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS,
    );
    if (response.body === null) {
      throw new SnapshotUnavailableError(SnapshotFailure.DOWNLOAD_FAILED, 'empty response body');
    }
    let downloaded = 0;
    const source = Readable.fromWeb(
      response.body as import('node:stream/web').ReadableStream<Uint8Array>,
    );
    source.on('data', (chunk: Buffer) => {
      downloaded += chunk.length;
      if (downloaded > SnapshotLimits.MAX_ARCHIVE_BYTES) {
        source.destroy(new SnapshotUnavailableError(SnapshotFailure.ARCHIVE_TOO_LARGE));
      }
    });
    const unpacked = source.pipe(createGunzip());
    source.on('error', (error) => unpacked.destroy(error));
    try {
      await readTarStream(unpacked, collector, {
        maxEntries: SnapshotLimits.MAX_TAR_ENTRIES,
        maxStreamBytes: SnapshotLimits.MAX_TAR_STREAM_BYTES,
      });
    } catch (error) {
      source.destroy();
      throw toSnapshotError(error);
    }
  }

  private base(): Promise<string> {
    if (this.baseDirectory === undefined) {
      const created = mkdtemp(path.join(os.tmpdir(), TEMP_DIRECTORY_PREFIX));
      created.catch(() => {
        if (this.baseDirectory === created) this.baseDirectory = undefined;
      });
      this.baseDirectory = created;
    }
    return this.baseDirectory;
  }

  private async evictOldest(): Promise<void> {
    const idleBefore = this.clock.nowMs() - SNAPSHOT_IN_USE_MS;
    while (this.retained.size > MAX_RETAINED_SNAPSHOTS) {
      const oldest = [...this.retained.entries()]
        .filter(([, entry]) => entry.lastUsedMs <= idleBefore)
        .sort(([, left], [, right]) => left.lastUsedMs - right.lastUsedMs)[0];
      if (oldest === undefined) return;
      this.retained.delete(oldest[0]);
      await rm(oldest[1].directory, { recursive: true, force: true });
    }
  }
}
