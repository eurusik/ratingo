import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';

import { Injectable } from '@nestjs/common';

import {
  LOCAL_SNAPSHOT_SHA,
  SkipReason,
  SnapshotLimits,
} from '../../domain/constants/snapshot.constants';
import type { CodeSnapshot, SnapshotFile } from '../../domain/entities/code-snapshot';
import type { CodeSnapshotPort } from '../../domain/ports/code-snapshot.port';
import { inspectFileBody } from '../../domain/policies/file-inspection';
import { isUnderDirectory, normalizeFilePath } from '../../domain/policies/repo-path';
import { DirectorySnapshot } from './directory-snapshot';

const runFile = promisify(execFile);
const GIT_LIST_MAX_BUFFER_BYTES = 64_000_000;
const READ_BATCH_SIZE = 64;

export interface LocalDirectoryConfig {
  root: string;
  excludedDirectories: readonly string[];
}

interface Indexed {
  files: SnapshotFile[];
  skipped: Map<string, SkipReason>;
}

@Injectable()
export class LocalDirectoryCodeSnapshotAdapter implements CodeSnapshotPort {
  private snapshot: Promise<CodeSnapshot> | undefined;

  constructor(private readonly config: LocalDirectoryConfig) {}

  resolve(ref: string): Promise<CodeSnapshot> {
    this.snapshot ??= this.build(ref);
    return this.snapshot;
  }

  private async build(ref: string): Promise<CodeSnapshot> {
    const root = await realpath(this.config.root);
    const indexed: Indexed = { files: [], skipped: new Map() };
    const paths = await this.listCandidatePaths(root);
    for (let offset = 0; offset < paths.length; offset += READ_BATCH_SIZE) {
      await Promise.all(
        paths
          .slice(offset, offset + READ_BATCH_SIZE)
          .map((candidate) => this.index(root, candidate, indexed)),
      );
    }
    return new DirectorySnapshot(ref, LOCAL_SNAPSHOT_SHA, root, indexed.files, indexed.skipped);
  }

  private async listCandidatePaths(root: string): Promise<string[]> {
    const { stdout } = await runFile(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { cwd: root, maxBuffer: GIT_LIST_MAX_BUFFER_BYTES, encoding: 'utf8' },
    );
    return [...new Set(stdout.split('\u0000').filter((entry) => entry !== ''))];
  }

  private async index(root: string, candidate: string, indexed: Indexed): Promise<void> {
    const normalized = normalizeFilePath(candidate);
    if (!normalized.ok) {
      indexed.skipped.set(candidate, SkipReason.UNSAFE_PATH);
      return;
    }
    if (
      this.config.excludedDirectories.some((directory) =>
        isUnderDirectory(normalized.path, directory),
      )
    )
      return;
    const absolute = path.join(root, normalized.path);
    try {
      const stats = await lstat(absolute);
      if (!stats.isFile()) {
        indexed.skipped.set(normalized.path, SkipReason.NOT_REGULAR_FILE);
        return;
      }
      if (stats.size > SnapshotLimits.MAX_FILE_BYTES) {
        indexed.skipped.set(normalized.path, SkipReason.TOO_LARGE);
        return;
      }
      const inspection = inspectFileBody(await readFile(absolute));
      if (inspection.kind === 'skipped') {
        indexed.skipped.set(normalized.path, inspection.reason);
        return;
      }
      indexed.files.push({
        path: normalized.path,
        bytes: stats.size,
        lineCount: inspection.lines.length,
      });
    } catch {
      indexed.skipped.set(normalized.path, SkipReason.NOT_REGULAR_FILE);
    }
  }
}
