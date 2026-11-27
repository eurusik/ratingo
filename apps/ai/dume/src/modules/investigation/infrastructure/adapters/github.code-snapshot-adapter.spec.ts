import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

import { Logger } from '@nestjs/common';
import { FixedClock } from '@ratingo/ai-core';

import {
  FAILED_BUILD_MEMORY_MS,
  MAX_RETAINED_SNAPSHOTS,
  REF_CHECK_INTERVAL_MS,
  SNAPSHOT_IN_USE_MS,
  SkipReason,
  SnapshotLimits,
} from '../../domain/constants/snapshot.constants';
import {
  SnapshotFailure,
  SnapshotUnavailableError,
} from '../../domain/errors/investigation.errors';
import { buildTar, tarEntry } from '../testing/tar-builder.testing';
import { GithubCodeSnapshotAdapter } from './github.code-snapshot-adapter';

const SHA_ONE = 'a'.repeat(40);
const SHA_TWO = 'b'.repeat(40);

interface FakeGithub {
  server: Server;
  url: string;
  requests: string[];
  headers: Record<string, string | string[] | undefined>[];
  state: {
    sha: string;
    commitStatus: number;
    commitHeaders: Record<string, string>;
    archive: Buffer;
    stallArchive: boolean;
  };
}

const archiveOf = (entries: Buffer[]): Buffer => gzipSync(buildTar(entries));

const startFakeGithub = async (): Promise<FakeGithub> => {
  const state = {
    sha: SHA_ONE,
    commitStatus: 200,
    commitHeaders: {} as Record<string, string>,
    stallArchive: false,
    archive: archiveOf([
      tarEntry({ name: 'repo-root/', flag: '5' }),
      tarEntry({ name: 'repo-root/readme.md', body: 'hello\nworld\n' }),
    ]),
  };
  const requests: string[] = [];
  const headers: FakeGithub['headers'] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? '');
    headers.push(request.headers);
    if (request.url?.includes('/commits/')) {
      response.statusCode = state.commitStatus;
      for (const [name, value] of Object.entries(state.commitHeaders))
        response.setHeader(name, value);
      response.end(state.commitStatus === 200 ? state.sha : 'nope');
    } else if (request.url?.includes('/tarball/')) {
      if (state.stallArchive) response.write(state.archive.subarray(0, 20));
      else response.end(state.archive);
    } else {
      response.statusCode = 404;
      response.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}`, requests, headers, state };
};

describe('GithubCodeSnapshotAdapter', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  let github: FakeGithub;
  let clock: FixedClock;
  let adapter: GithubCodeSnapshotAdapter;

  const adapterWith = (extra: { downloadTimeoutMs?: number }) =>
    new GithubCodeSnapshotAdapter(
      { repository: 'owner/repo', apiUrl: github.url, ...extra },
      clock,
    );

  const adapterFor = (token?: string) =>
    new GithubCodeSnapshotAdapter(
      { repository: 'owner/repo', apiUrl: github.url, ...(token === undefined ? {} : { token }) },
      clock,
    );

  beforeEach(async () => {
    github = await startFakeGithub();
    clock = new FixedClock(1_000);
    adapter = adapterFor();
  });

  afterEach(async () => {
    await adapter.dispose();
    await new Promise((resolve) => github.server.close(resolve));
  });

  it('downloads the commit once and serves reads from the unpacked files', async () => {
    const snapshot = await adapter.resolve('main');

    expect(snapshot.sha).toBe(SHA_ONE);
    expect(snapshot.files()).toEqual([{ path: 'readme.md', bytes: 12, lineCount: 2 }]);
    await expect(snapshot.readLines('readme.md')).resolves.toEqual(['hello', 'world']);
    await expect(snapshot.readLines('missing.md')).resolves.toBeUndefined();
    await expect(snapshot.readLines('../../etc/passwd')).resolves.toBeUndefined();
  });

  it('checks whether the ref moved at most once per interval', async () => {
    await adapter.resolve('main');
    await adapter.resolve('main');
    clock.advance(REF_CHECK_INTERVAL_MS - 1);
    await adapter.resolve('main');

    expect(github.requests.filter((url) => url.includes('/commits/'))).toHaveLength(1);
    expect(github.requests.filter((url) => url.includes('/tarball/'))).toHaveLength(1);
  });

  it('keeps the same snapshot when the ref did not move and refreshes when it did', async () => {
    const first = await adapter.resolve('main');
    clock.advance(REF_CHECK_INTERVAL_MS);
    const unchanged = await adapter.resolve('main');
    github.state.sha = SHA_TWO;
    clock.advance(REF_CHECK_INTERVAL_MS);
    const moved = await adapter.resolve('main');

    expect(unchanged).toBe(first);
    expect(moved.sha).toBe(SHA_TWO);
    expect(github.requests.filter((url) => url.includes('/tarball/'))).toHaveLength(2);
  });

  it('shares one download between concurrent requests for the same commit', async () => {
    await Promise.all([adapter.resolve('main'), adapter.resolve('main')]);

    expect(github.requests.filter((url) => url.includes('/tarball/'))).toHaveLength(1);
  });

  it('serves the older snapshot when the ref check fails', async () => {
    const first = await adapter.resolve('main');
    clock.advance(REF_CHECK_INTERVAL_MS);
    github.state.commitStatus = 500;

    await expect(adapter.resolve('main')).resolves.toBe(first);
  });

  it('refuses a ref that is not on the allowlist before any request', async () => {
    await expect(adapter.resolve('feature/x')).rejects.toMatchObject({
      failure: SnapshotFailure.REF_NOT_ALLOWED,
    });
    expect(github.requests).toEqual([]);
  });

  it('reports a missing ref and rate limiting as failures with a reason', async () => {
    github.state.commitStatus = 404;
    await expect(adapter.resolve('main')).rejects.toMatchObject({
      failure: SnapshotFailure.REF_NOT_FOUND,
    });
    github.state.commitStatus = 429;
    await expect(adapter.resolve('main')).rejects.toBeInstanceOf(SnapshotUnavailableError);
  });

  it('sends the token only when one is configured', async () => {
    await adapter.resolve('main');
    expect(github.headers.every((entry) => entry.authorization === undefined)).toBe(true);

    const withToken = adapterFor('test-token-value');
    github.state.sha = SHA_TWO;
    await withToken.resolve('development');
    expect(github.headers.some((entry) => entry.authorization === 'Bearer test-token-value')).toBe(
      true,
    );
    await withToken.dispose();
  });

  it('skips traversal, links, binaries, oversized files and git metadata', async () => {
    github.state.archive = archiveOf([
      tarEntry({ name: 'repo-root/', flag: '5' }),
      tarEntry({ name: 'repo-root/ok.ts', body: 'const a = 1;\n' }),
      tarEntry({ name: 'repo-root/../../escape.txt', body: 'evil' }),
      tarEntry({ name: 'repo-root/sub/../../escape2.txt', body: 'evil' }),
      tarEntry({ name: 'repo-root/.git/config', body: 'x' }),
      tarEntry({ name: 'repo-root/link.ts', flag: '2' }),
      tarEntry({ name: 'repo-root/image.png', body: Buffer.from([1, 0, 2, 0]) }),
      tarEntry({ name: 'repo-root/big.txt', body: 'a'.repeat(SnapshotLimits.MAX_FILE_BYTES + 1) }),
      tarEntry({
        name: 'repo-root/minified.js',
        body: 'x'.repeat(SnapshotLimits.MAX_LINE_CHARS + 1),
      }),
    ]);

    const snapshot = await adapter.resolve('main');

    expect(snapshot.files().map((file) => file.path)).toEqual(['ok.ts']);
    expect(snapshot.skippedReasonOf('image.png')).toBe(SkipReason.BINARY);
    expect(snapshot.skippedReasonOf('big.txt')).toBe(SkipReason.TOO_LARGE);
    expect(snapshot.skippedReasonOf('minified.js')).toBe(SkipReason.LONG_LINES);
    expect(snapshot.skippedReasonOf('.git/config')).toBe(SkipReason.UNSAFE_PATH);
    expect(existsSync('/tmp/escape.txt')).toBe(false);
  });

  it('rejects a corrupt archive with a reason and leaves no snapshot behind', async () => {
    github.state.archive = gzipSync(
      Buffer.from('this is not a tar archive at all, just text'.repeat(40)),
    );

    await expect(adapter.resolve('main')).rejects.toMatchObject({
      failure: SnapshotFailure.ARCHIVE_INVALID,
    });
  });

  it('does not delete a snapshot that a run may still be reading, and trims once it has been idle', async () => {
    const [sha1, sha2, sha3, sha4, sha5] = ['1', '2', '3', '4', '5'].map((digit) =>
      digit.repeat(40),
    ) as [string, string, string, string, string];
    const resolveAt = async (ref: string, sha: string) => {
      github.state.sha = sha;
      return adapter.resolve(ref);
    };
    const first = await resolveAt('main', sha1);
    await resolveAt('development', sha2);
    clock.advance(REF_CHECK_INTERVAL_MS);
    await resolveAt('main', sha3);
    await resolveAt('development', sha4);

    expect(MAX_RETAINED_SNAPSHOTS).toBeLessThan(4);
    await expect(first.readLines('readme.md')).resolves.toEqual(['hello', 'world']);

    clock.advance(SNAPSHOT_IN_USE_MS - REF_CHECK_INTERVAL_MS);
    await resolveAt('main', sha5);

    await expect(first.readLines('readme.md')).resolves.toBeUndefined();
  });

  it('reports a download that times out as a failed download, not as a crash', async () => {
    github.state.stallArchive = true;
    const slow = adapterWith({ downloadTimeoutMs: 300 });

    const failure = await slow.resolve('main').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(SnapshotUnavailableError);
    expect(failure).toMatchObject({ failure: SnapshotFailure.DOWNLOAD_FAILED });
    await slow.dispose();
  });

  it('treats a plain 403 as a failed request and a 403 with no quota left as rate limiting', async () => {
    github.state.commitStatus = 403;
    await expect(adapter.resolve('main')).rejects.toMatchObject({
      failure: SnapshotFailure.DOWNLOAD_FAILED,
    });

    github.state.commitHeaders = { 'x-ratelimit-remaining': '0' };
    await expect(adapter.resolve('main')).rejects.toMatchObject({
      failure: SnapshotFailure.RATE_LIMITED,
    });
  });

  it('serves the previous snapshot when a new commit cannot be downloaded, and does not retry at once', async () => {
    const first = await adapter.resolve('main');
    github.state.sha = SHA_TWO;
    github.state.archive = gzipSync(Buffer.from('not a tar archive '.repeat(40)));
    clock.advance(REF_CHECK_INTERVAL_MS);

    const second = await adapter.resolve('main');
    const third = await adapter.resolve('main');

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(github.requests.filter((url) => url.includes('/tarball/'))).toHaveLength(2);
  });

  it('retries the download of a failed commit once the memory of the failure has expired', async () => {
    await adapter.resolve('main');
    github.state.sha = SHA_TWO;
    github.state.archive = gzipSync(Buffer.from('not a tar archive '.repeat(40)));
    clock.advance(REF_CHECK_INTERVAL_MS);
    await adapter.resolve('main');
    github.state.archive = archiveOf([
      tarEntry({ name: 'repo-root/', flag: '5' }),
      tarEntry({ name: 'repo-root/new.md', body: 'fresh\n' }),
    ]);

    clock.advance(FAILED_BUILD_MEMORY_MS);
    const recovered = await adapter.resolve('main');

    expect(recovered.sha).toBe(SHA_TWO);
    await expect(recovered.readLines('new.md')).resolves.toEqual(['fresh']);
  });

  it('fails when there is no previous snapshot to fall back to', async () => {
    github.state.archive = gzipSync(Buffer.from('not a tar archive '.repeat(40)));

    await expect(adapter.resolve('main')).rejects.toMatchObject({
      failure: SnapshotFailure.ARCHIVE_INVALID,
    });
  });

  it('removes its files on dispose', async () => {
    const snapshot = await adapter.resolve('main');
    await adapter.dispose();

    await expect(snapshot.readLines('readme.md')).resolves.toBeUndefined();
  });
});
