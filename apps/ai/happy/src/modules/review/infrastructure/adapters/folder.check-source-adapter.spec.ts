import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { REQUIRED_CHECK_SECTIONS, FolderCheckSourceAdapter } from './folder.check-source-adapter';

const BODY = REQUIRED_CHECK_SECTIONS.map((section) => `${section}\nSomething useful here.`).join(
  '\n\n',
);

const frontmatter = (overrides: Record<string, string> = {}): string =>
  Object.entries({
    id: 'sample-check',
    paths: "\n  - 'src/**'",
    triggers: "\n  - 'foo\\(' ",
    severity_cap: 'major',
    ...overrides,
  })
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

const catalogWith = async (files: Record<string, string>): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), 'happy-checks-'));
  for (const [relative, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), content);
  }
  return root;
};

const document = (overrides: Record<string, string> = {}, body = BODY): string =>
  `---\n${frontmatter(overrides)}\n---\n\n${body}\n`;

describe('FolderCheckSourceAdapter', () => {
  it('loads a check with its area, summary and parsed fields', async () => {
    const root = await catalogWith({
      'area-one/sample-check.md': document({ rule: 'api-modules.md#Upserts' }),
    });
    const [loaded] = (await FolderCheckSourceAdapter.load(root)).list();
    expect(loaded).toMatchObject({
      id: 'sample-check',
      area: 'area-one',
      paths: ['src/**'],
      triggers: ['foo\\('],
      rule: { file: 'api-modules.md', heading: 'Upserts' },
      severityCap: 'major',
      summary: 'Something useful here.',
    });
  });

  it.each([
    ['a missing frontmatter block', { 'a/sample-check.md': BODY }],
    ['an id that is not the file name', { 'a/sample-check.md': document({ id: 'other-check' }) }],
    ['an unknown key', { 'a/sample-check.md': document({ extra: 'x' }) }],
    [
      'a trigger that is not a regular expression',
      { 'a/sample-check.md': document({ triggers: "\n  - '('" }) },
    ],
    [
      'a rule that is not a markdown reference',
      { 'a/sample-check.md': document({ rule: 'notes.txt' }) },
    ],
    ['a bad severity', { 'a/sample-check.md': document({ severity_cap: 'huge' }) }],
    ['a missing section', { 'a/sample-check.md': document({}, '## What to verify\nx') }],
    ['an oversized body', { 'a/sample-check.md': document({}, `${BODY}\n${'word '.repeat(700)}`) }],
    ['a duplicate id', { 'a/sample-check.md': document(), 'b/sample-check.md': document() }],
  ])('fails fast on %s', async (_name, files) => {
    await expect(FolderCheckSourceAdapter.load(await catalogWith(files))).rejects.toThrow();
  });
});
