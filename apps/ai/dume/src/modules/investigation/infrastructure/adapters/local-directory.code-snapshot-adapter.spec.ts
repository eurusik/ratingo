import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { LOCAL_SNAPSHOT_SHA, SkipReason } from '../../domain/constants/snapshot.constants';
import { LocalDirectoryCodeSnapshotAdapter } from './local-directory.code-snapshot-adapter';

describe('LocalDirectoryCodeSnapshotAdapter', () => {
  let root: string;

  beforeAll(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'dume-local-'));
    execFileSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(path.join(root, 'src'));
    mkdirSync(path.join(root, 'ignored'));
    mkdirSync(path.join(root, 'eval'));
    writeFileSync(path.join(root, 'src/a.ts'), 'one\ntwo\nthree\n');
    writeFileSync(path.join(root, 'src/bin.dat'), Buffer.from([0, 1, 2]));
    writeFileSync(path.join(root, 'eval/cases.ts'), 'answers live here\n');
    writeFileSync(path.join(root, 'ignored/x.ts'), 'ignored\n');
    writeFileSync(path.join(root, '.gitignore'), 'ignored/\n');
    symlinkSync('/etc/hosts', path.join(root, 'src/link.ts'));
  });

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('serves tracked and untracked files except ignored, excluded and non-regular ones', async () => {
    const snapshot = await new LocalDirectoryCodeSnapshotAdapter({ root, excludedDirectories: ['eval'] }).resolve('main');

    expect(snapshot.sha).toBe(LOCAL_SNAPSHOT_SHA);
    expect(snapshot.files().map((file) => file.path)).toEqual(['.gitignore', 'src/a.ts']);
    expect(snapshot.skippedReasonOf('src/bin.dat')).toBe(SkipReason.BINARY);
    expect(snapshot.skippedReasonOf('src/link.ts')).toBe(SkipReason.NOT_REGULAR_FILE);
    await expect(snapshot.readLines('src/a.ts')).resolves.toEqual(['one', 'two', 'three']);
    await expect(snapshot.readLines('eval/cases.ts')).resolves.toBeUndefined();
  });

  it('builds the snapshot once', async () => {
    const adapter = new LocalDirectoryCodeSnapshotAdapter({ root, excludedDirectories: [] });

    expect(await adapter.resolve('main')).toBe(await adapter.resolve('development'));
  });
});
