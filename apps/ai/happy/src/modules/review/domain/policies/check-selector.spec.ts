import * as fc from 'fast-check';

import { MAX_EXTRA_CHECKS, MAX_SELECTED_CHECKS } from '../constants/review-limits.constants';
import { Severity } from '../constants/severity.constants';
import type { Check } from '../entities/check';

import { addExtraChecks, selectChecks, type SelectableFile } from './check-selector';

const check = (id: string, paths: string[], triggers: string[] = []): Check => ({
  id,
  area: 'area',
  summary: id,
  paths,
  triggers,
  rule: null,
  severityCap: Severity.MAJOR,
  body: id,
});

const CATALOG: readonly Check[] = [
  check('alpha', ['src/a/**'], ['onConflict']),
  check('bravo', ['src/{a,b}/**'], ['\\bupsert\\b']),
  check('charlie', ['src/b/*.ts']),
  check('delta', ['src/**'], ['TODO']),
  check('echo', ['src/**'], ['x']),
  check('foxtrot', ['src/**'], ['y']),
  check('golf', ['src/**'], ['z']),
];

const lineArb = fc.constantFrom('onConflict()', 'upsert()', 'TODO', 'x', 'y', 'z', 'plain', '');
const fileArb: fc.Arbitrary<SelectableFile> = fc.record({
  path: fc.constantFrom('src/a/one.ts', 'src/b/two.ts', 'src/c/three.ts', 'docs/readme.md'),
  addedLines: fc.array(lineArb, { maxLength: 6 }),
});
const filesArb = fc.array(fileArb, { maxLength: 6 });

describe('selectChecks', () => {
  it('returns a subset of the catalog, sorted by id and never above the cap', () => {
    fc.assert(
      fc.property(filesArb, (files) => {
        const selected = selectChecks(CATALOG, files);
        const ids = selected.map((entry) => entry.id);
        return (
          selected.length <= MAX_SELECTED_CHECKS &&
          ids.every((id) => CATALOG.some((entry) => entry.id === id)) &&
          new Set(ids).size === ids.length &&
          ids.every((id, index) => index === 0 || (ids[index - 1] ?? '') < id)
        );
      }),
    );
  });

  it('does not depend on the order of the catalog or of the files', () => {
    fc.assert(
      fc.property(filesArb, (files) => {
        const forward = selectChecks(CATALOG, files).map((entry) => entry.id);
        const reversed = selectChecks([...CATALOG].reverse(), [...files].reverse()).map(
          (entry) => entry.id,
        );
        return JSON.stringify(forward) === JSON.stringify(reversed);
      }),
    );
  });

  it('honours a smaller cap and selects nothing for unrelated files', () => {
    fc.assert(
      fc.property(
        filesArb,
        fc.integer({ min: 0, max: 7 }),
        (files, cap) => selectChecks(CATALOG, files, cap).length <= cap,
      ),
    );
    expect(
      selectChecks(CATALOG, [{ path: 'docs/readme.md', addedLines: ['onConflict()', 'TODO'] }]),
    ).toEqual([]);
  });

  it('needs a matching path and, when triggers exist, a matching added line', () => {
    const ids = (files: SelectableFile[]) => selectChecks(CATALOG, files).map((entry) => entry.id);
    expect(ids([{ path: 'src/a/one.ts', addedLines: ['plain'] }])).toEqual([]);
    expect(ids([{ path: 'src/a/one.ts', addedLines: ['onConflict()'] }])).toEqual(['alpha']);
    expect(ids([{ path: 'src/b/two.ts', addedLines: [] }])).toEqual(['charlie']);
    expect(ids([{ path: 'src/b/two.ts', addedLines: ['upsert()'] }])).toEqual(['bravo', 'charlie']);
  });

  it('keeps the checks with the most trigger hits when over the cap', () => {
    const crowded = Array.from({ length: 8 }, (_, index) => check(`c${index}`, ['**'], ['hit']));
    const busy = check('busy', ['**'], ['hit']);
    const selected = selectChecks(
      [...crowded, busy],
      [{ path: 'a.ts', addedLines: ['hit', 'hit'] }],
      3,
    );
    expect(selected).toHaveLength(3);
  });
});

describe('addExtraChecks', () => {
  const requestArb = fc.array(
    fc.record({
      id: fc.constantFrom(...CATALOG.map((entry) => entry.id), 'ghost'),
      file: fc.constantFrom('src/a/one.ts', 'src/b/two.ts', 'missing.ts'),
    }),
    { maxLength: 6 },
  );

  it('only adds known checks that cite a changed file, at most two, within the cap', () => {
    fc.assert(
      fc.property(filesArb, requestArb, (files, requests) => {
        const selected = selectChecks(CATALOG, files);
        const result = addExtraChecks(selected, CATALOG, requests, [
          'src/a/one.ts',
          'src/b/two.ts',
        ]);
        const added = result.filter((entry) => !selected.some((chosen) => chosen.id === entry.id));
        return (
          added.length <= MAX_EXTRA_CHECKS &&
          result.length <= Math.max(MAX_SELECTED_CHECKS, selected.length) &&
          selected.every((chosen) => result.some((entry) => entry.id === chosen.id)) &&
          added.every((entry) =>
            requests.some(
              (request) =>
                request.id === entry.id && ['src/a/one.ts', 'src/b/two.ts'].includes(request.file),
            ),
          )
        );
      }),
    );
  });

  it('ignores unknown ids and files that are not in the diff', () => {
    const result = addExtraChecks(
      [],
      CATALOG,
      [
        { id: 'ghost', file: 'src/a/one.ts' },
        { id: 'alpha', file: 'missing.ts' },
      ],
      ['src/a/one.ts'],
    );
    expect(result).toEqual([]);
  });
});
