import type { SnapshotFile } from '../entities/code-snapshot';
import { ListedKind, listDirectoryLevel } from './directory-listing';

const file = (path: string, lineCount = 1): SnapshotFile => ({ path, bytes: 1, lineCount });
const FILES = [
  file('README.md', 3),
  file('apps/api/main.ts', 10),
  file('apps/api/app.module.ts', 20),
  file('apps/web/index.ts'),
  file('apps/api-contract/types.ts'),
];

describe('listDirectoryLevel', () => {
  it('lists one level with directories first and file counts', () => {
    expect(listDirectoryLevel(FILES, '')).toEqual([
      { name: 'apps', kind: ListedKind.DIRECTORY, files: 4 },
      { name: 'README.md', kind: ListedKind.FILE, lines: 3 },
    ]);
    expect(listDirectoryLevel(FILES, 'apps')).toEqual([
      { name: 'api', kind: ListedKind.DIRECTORY, files: 2 },
      { name: 'api-contract', kind: ListedKind.DIRECTORY, files: 1 },
      { name: 'web', kind: ListedKind.DIRECTORY, files: 1 },
    ]);
  });

  it('does not mix a directory with a sibling that shares its prefix', () => {
    expect(listDirectoryLevel(FILES, 'apps/api').map((entry) => entry.name)).toEqual([
      'app.module.ts',
      'main.ts',
    ]);
  });

  it('returns nothing for a directory that does not exist or for a file path', () => {
    expect(listDirectoryLevel(FILES, 'apps/missing')).toEqual([]);
    expect(listDirectoryLevel(FILES, 'README.md')).toEqual([]);
  });
});
