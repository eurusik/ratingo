import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { aggregateCase } from './aggregate';
import { buildBaseline } from './baseline-diff';
import { InvalidBaselineError, readBaselineFile, writeBaselineFile } from './baseline-file';
import { EVAL_CASES } from './cases/cases';
import { CaseKind } from './eval-case';
import type { RunVerdict } from './scorer';

const verdict = (passed: boolean): RunVerdict => ({
  passed,
  failures: [],
  problem: null,
  turns: 1,
  costUsd: 0,
  judgeCostUsd: 0,
  verifiedFacts: 0,
  unverifiedClaims: 0,
  fabricatedCitations: 0,
  unknownsStated: 0,
  answeredHonestlyUnknown: null,
  answer: null,
  stopReason: null,
  stopDetail: null,
  toolCalls: {},
});

const baselineOf = (passes: number) =>
  buildBaseline(
    [
      aggregateCase(
        'a',
        CaseKind.ANSWERABLE,
        Array.from({ length: 3 }, (_, index) => verdict(index < passes)),
        { runs: 3, passAt: 2 },
      ),
    ],
    { savedAtMs: 1, model: 'm', judgeModel: 'j', runs: 3, passAt: 2 },
  );

describe('baseline file', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'dume-baseline-'));
  });

  afterEach(() => rm(directory, { recursive: true, force: true }));

  it('round-trips and reports a missing file as null', async () => {
    const file = path.join(directory, 'nested', 'baseline.json');
    expect(await readBaselineFile(file)).toBeNull();

    await writeBaselineFile(file, baselineOf(2));

    expect((await readBaselineFile(file))?.cases.a).toEqual({
      passes: 2,
      runs: 3,
      passed: true,
      flaky: true,
    });
  });

  it('refuses a file with an unknown version', async () => {
    const file = path.join(directory, 'old.json');
    await writeFile(file, JSON.stringify({ version: 99, cases: {} }));

    await expect(readBaselineFile(file)).rejects.toBeInstanceOf(InvalidBaselineError);
  });

  it('refuses a file that is not JSON or has a malformed case', async () => {
    const broken = path.join(directory, 'broken.json');
    await writeFile(broken, '{ not json');
    const malformed = path.join(directory, 'malformed.json');
    await writeFile(
      malformed,
      JSON.stringify({
        version: 1,
        savedAtMs: 1,
        model: 'm',
        judgeModel: 'j',
        runs: 3,
        passAt: 2,
        cases: { a: { passes: 'many', runs: 3, passed: true, flaky: false } },
      }),
    );

    await expect(readBaselineFile(broken)).rejects.toThrow('not JSON');
    await expect(readBaselineFile(malformed)).rejects.toThrow('cases.a.passes');
  });
});

describe('the committed baseline', () => {
  it('loads through the same path the eval uses and only names cases that exist', async () => {
    const baseline = await readBaselineFile(path.join(__dirname, 'baseline.json'));

    expect(baseline).not.toBeNull();
    const known = new Set(EVAL_CASES.map((testCase) => testCase.id));
    expect(Object.keys(baseline?.cases ?? {}).filter((caseId) => !known.has(caseId))).toEqual([]);
  });
});
