import * as path from 'node:path';

import { selectChecks } from '../src/modules/review/domain/policies/check-selector';
import { addedLineTexts } from '../src/modules/review/domain/policies/diff-hunks';
import { FolderCheckSourceAdapter } from '../src/modules/review/infrastructure/adapters/folder.check-source-adapter';

import { CHECK_EVAL_CASES } from './cases';
import { EvalKind, renderPatch } from './eval-case';

const CATALOG_PATH = path.resolve(__dirname, '../agent/checks');
const EXPECTED_CHECKS = 12;

describe('check catalog', () => {
  it('loads with valid frontmatter and all required sections', async () => {
    const catalog = (await FolderCheckSourceAdapter.load(CATALOG_PATH)).list();
    expect(catalog).toHaveLength(EXPECTED_CHECKS);
    expect(new Set(catalog.map((check) => check.id)).size).toBe(catalog.length);
  });

  it('has a real-bug fixture and a looks-risky-but-fine fixture for every check', async () => {
    const catalog = (await FolderCheckSourceAdapter.load(CATALOG_PATH)).list();
    for (const check of catalog) {
      const cases = CHECK_EVAL_CASES.filter((testCase) => testCase.checkId === check.id);
      expect(cases.filter((testCase) => testCase.kind === EvalKind.POSITIVE)).toHaveLength(1);
      expect(
        cases.filter((testCase) => testCase.kind === EvalKind.PROTECTED_NEGATIVE),
      ).toHaveLength(1);
    }
  });

  it('selects its check for both of its fixtures, from path and diff alone', async () => {
    const catalog = (await FolderCheckSourceAdapter.load(CATALOG_PATH)).list();
    for (const testCase of CHECK_EVAL_CASES) {
      const selected = selectChecks(catalog, [
        { path: testCase.path, addedLines: addedLineTexts(renderPatch(testCase)) },
      ]).map((check) => check.id);
      expect({ id: testCase.id, selected: selected.includes(testCase.checkId ?? '') }).toEqual({
        id: testCase.id,
        selected: true,
      });
    }
  });

  it('points every fixture at a check that exists and cites a source', async () => {
    const ids = new Set(
      (await FolderCheckSourceAdapter.load(CATALOG_PATH)).list().map((check) => check.id),
    );
    for (const testCase of CHECK_EVAL_CASES) {
      expect(ids.has(testCase.checkId ?? '')).toBe(true);
      expect(testCase.source ?? '').not.toBe('');
    }
  });
});
