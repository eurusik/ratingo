import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '..');
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist']);
const SOURCE_EXTENSIONS = ['.ts', '.js'];

const directoriesUnder = (root: string): string[] =>
  readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)
      ? [path.join(root, entry.name), ...directoriesUnder(path.join(root, entry.name))]
      : [],
  );

const clashesIn = (directory: string): string[] => {
  const names = readdirSync(directory);
  const dataNames = names
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length));
  return dataNames
    .filter((base) => SOURCE_EXTENSIONS.some((extension) => names.includes(`${base}${extension}`)))
    .map((base) => path.join(directory, base));
};

describe('module names', () => {
  it('never share a name with a JSON file in the same folder, because an import without an extension would load the JSON', () => {
    const clashes = [APP_ROOT, ...directoriesUnder(APP_ROOT)].flatMap(clashesIn);

    expect(clashes).toEqual([]);
  });
});

describe('the clash detector', () => {
  it('reports a module that shares its name with a JSON file and ignores unrelated names', () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), 'dume-names-'));
    try {
      writeFileSync(path.join(directory, 'baseline.ts'), '');
      writeFileSync(path.join(directory, 'baseline.json'), '{}');
      writeFileSync(path.join(directory, 'package.json'), '{}');
      writeFileSync(path.join(directory, 'cases.ts'), '');

      expect(clashesIn(directory)).toEqual([path.join(directory, 'baseline')]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
