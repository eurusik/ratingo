import { plainText } from './answer-text';
import { measureJudgeAgreement } from './calibration-runner';
import {
  CalibrationSource,
  summarizeCalibration,
  type CalibrationItem,
  type CalibrationVerdict,
} from './calibration';
import { CALIBRATION_ITEMS } from './calibration.set';
import { EVAL_CASES } from './cases';
import { findForbiddenContent } from './forbidden-content';
import { JudgeUnavailableError, judgementPassed, type JudgeInput, type JudgePort } from './judge';

const byId = new Map(EVAL_CASES.map((testCase) => [testCase.id, testCase]));

const labelledJudge = (
  labels: ReadonlyMap<string, boolean>,
  flipped: ReadonlySet<string> = new Set(),
): JudgePort => ({
  judge: async (input: JudgeInput) => {
    const good = labels.get(input.answer) ?? false;
    const holds = flipped.has(input.answer) ? !good : good;
    return {
      costUsd: 0.01,
      verdicts: input.expectations.map((expectation) => ({
        ...expectation,
        satisfied: holds,
        reason: holds ? 'ok' : 'wrong',
      })),
    };
  },
});

const plain = (item: CalibrationItem): string => plainText(item.answer);

const labelsOf = (items: readonly CalibrationItem[]): Map<string, boolean> =>
  new Map(items.map((item) => [plain(item), item.meaningGood]));

describe('calibration set', () => {
  it('has unique ids and refers to real cases', () => {
    expect(new Set(CALIBRATION_ITEMS.map((item) => item.id)).size).toBe(CALIBRATION_ITEMS.length);
    for (const item of CALIBRATION_ITEMS) {
      expect(byId.has(item.caseId)).toBe(true);
    }
  });

  it('has good and bad answers, real ones from past runs and written ones, and some slips', () => {
    const count = (keep: (item: CalibrationItem) => boolean) =>
      CALIBRATION_ITEMS.filter(keep).length;
    expect(count((item) => item.meaningGood)).toBeGreaterThanOrEqual(15);
    expect(count((item) => !item.meaningGood)).toBeGreaterThanOrEqual(15);
    expect(count((item) => item.source === CalibrationSource.PAST_RUN)).toBeGreaterThanOrEqual(10);
    expect(count((item) => item.source === CalibrationSource.WRITTEN)).toBeGreaterThanOrEqual(10);
    expect(count((item) => item.contentViolation === true)).toBeGreaterThanOrEqual(4);
  });

  it('labels every item with a reason', () => {
    for (const item of CALIBRATION_ITEMS) {
      expect(item.note.length).toBeGreaterThan(10);
      expect(item.answer.length).toBeGreaterThan(10);
    }
  });

  it('keeps the wordings the old regexes rejected among the good answers', () => {
    const goodAnswers = CALIBRATION_ITEMS.filter((item) => item.meaningGood)
      .map(plain)
      .join('\n');
    expect(goodAnswers).toContain('рівня мінор');
    expect(goodAnswers).toContain('помилок не було');
    expect(goodAnswers).toContain('дві помилки');
  });

  it('is judged by the deterministic checks exactly as labelled', () => {
    for (const item of CALIBRATION_ITEMS) {
      const testCase = byId.get(item.caseId)!;
      const hits = findForbiddenContent(item.answer, testCase.forbiddenText);
      expect({ id: item.id, flagged: hits.length > 0 }).toEqual({
        id: item.id,
        flagged: item.contentViolation === true,
      });
    }
  });

  it('keeps the numbers of a daily-count answer equal to the numbers its case lists', () => {
    const item = CALIBRATION_ITEMS.find((candidate) => candidate.id === 'good-event-per-day')!;
    const listed = byId.get(item.caseId)!.expectations.conveys.join(' ').match(/\d+/g) ?? [];
    const dailyValues = listed.slice(-7);
    const quoted = item.answer.match(/листопада (\d+)/g)?.map((match) => match.split(' ')[1]) ?? [];
    expect([...quoted.slice(0, 7)].sort()).toEqual([...dailyValues].sort());
  });

  it('keeps each answer unique, so a judge keyed on the answer cannot mix items up', () => {
    expect(new Set(CALIBRATION_ITEMS.map(plain)).size).toBe(CALIBRATION_ITEMS.length);
  });
});

describe('measureJudgeAgreement', () => {
  it('reports full agreement for a judge that matches every label', async () => {
    const report = await measureJudgeAgreement(
      CALIBRATION_ITEMS,
      EVAL_CASES,
      labelledJudge(labelsOf(CALIBRATION_ITEMS)),
      4,
    );
    expect(report).toMatchObject({
      items: CALIBRATION_ITEMS.length,
      agreed: CALIBRATION_ITEMS.length,
      agreement: 1,
      falsePasses: [],
      falseFails: [],
      unscorable: [],
      trustworthy: true,
    });
    expect(report.costUsd).toBeCloseTo(CALIBRATION_ITEMS.length * 0.01);
  });

  it('lists a bad answer the judge accepted and a good one it rejected', async () => {
    const good = CALIBRATION_ITEMS.find((item) => item.meaningGood)!;
    const bad = CALIBRATION_ITEMS.find((item) => !item.meaningGood)!;
    const report = await measureJudgeAgreement(
      CALIBRATION_ITEMS,
      EVAL_CASES,
      labelledJudge(labelsOf(CALIBRATION_ITEMS), new Set([plain(good), plain(bad)])),
      4,
    );
    expect(report.falsePasses.map((verdict) => verdict.item.id)).toEqual([bad.id]);
    expect(report.falseFails.map((verdict) => verdict.item.id)).toEqual([good.id]);
    expect(report.agreed).toBe(CALIBRATION_ITEMS.length - 2);
  });

  it('does not trust a judge that disagrees with the labels too often', async () => {
    const everything = new Set(CALIBRATION_ITEMS.map(plain));
    const report = await measureJudgeAgreement(
      CALIBRATION_ITEMS,
      EVAL_CASES,
      labelledJudge(labelsOf(CALIBRATION_ITEMS), everything),
      4,
    );
    expect(report.agreement).toBe(0);
    expect(report.trustworthy).toBe(false);
  });

  it('counts an item the judge could not score as a disagreement and lists it', async () => {
    const failing: JudgePort = {
      judge: async () => {
        throw new JudgeUnavailableError('down');
      },
    };
    const report = await measureJudgeAgreement(
      CALIBRATION_ITEMS.slice(0, 3),
      EVAL_CASES,
      failing,
      2,
    );
    expect(report.unscorable).toHaveLength(3);
    expect(report.agreed).toBe(0);
    expect(report.trustworthy).toBe(false);
  });

  it('judges an answer against the expectations of its own case', async () => {
    const seen: JudgeInput[] = [];
    const recording: JudgePort = {
      judge: async (input) => {
        seen.push(input);
        return { costUsd: 0, verdicts: [] };
      },
    };
    const item = CALIBRATION_ITEMS[0];
    await measureJudgeAgreement([item], EVAL_CASES, recording, 1);
    expect(seen[0].question).toBe(byId.get(item.caseId)!.question);
    expect(seen[0].expectations.length).toBeGreaterThan(0);
    expect(judgementPassed({ costUsd: 0, verdicts: [] })).toBe(true);
  });
});

describe('summarizeCalibration', () => {
  const item = (id: string, meaningGood: boolean): CalibrationItem => ({
    id,
    caseId: 'x',
    source: CalibrationSource.WRITTEN,
    meaningGood,
    note: 'a long enough note',
    answer: 'a long enough answer',
  });
  const verdict = (
    id: string,
    meaningGood: boolean,
    judgedGood: boolean | null,
  ): CalibrationVerdict => ({
    item: item(id, meaningGood),
    judgedGood,
    reasons: [],
    costUsd: 0,
  });

  it('sets the trust line at nine in ten', () => {
    const nine = Array.from({ length: 9 }, (_, index) => verdict(`ok${index}`, true, true));
    expect(summarizeCalibration([...nine, verdict('off', true, false)]).trustworthy).toBe(true);
    expect(
      summarizeCalibration([...nine.slice(1), verdict('a', true, false), verdict('b', true, false)])
        .trustworthy,
    ).toBe(false);
  });

  it('trusts an empty set vacuously', () => {
    expect(summarizeCalibration([])).toMatchObject({ items: 0, agreement: 1, trustworthy: true });
  });
});
