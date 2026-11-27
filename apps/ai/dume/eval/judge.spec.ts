import {
  ExpectationKind,
  ReferenceJudge,
  buildJudgePrompt,
  expectationsOf,
  verdictsFromRaw,
} from './judge';

const expectations = expectationsOf({ conveys: ['says A', 'says B'], mustNotClaim: ['says C'] });

describe('expectationsOf', () => {
  it('numbers the statements by kind', () => {
    expect(expectations.map((entry) => [entry.id, entry.kind])).toEqual([
      ['C1', ExpectationKind.CONVEYS],
      ['C2', ExpectationKind.CONVEYS],
      ['N1', ExpectationKind.MUST_NOT_CLAIM],
    ]);
  });
});

describe('verdictsFromRaw', () => {
  it('satisfies a conveys statement when it holds and a forbidden claim when it does not', () => {
    const verdicts = verdictsFromRaw(expectations, [
      { id: 'C1', holds: true, reason: 'x' },
      { id: 'C2', holds: false, reason: 'x' },
      { id: 'N1', holds: false, reason: 'x' },
    ]);

    expect(verdicts.map((entry) => entry.satisfied)).toEqual([true, false, true]);
  });

  it('fails a statement the judge skipped', () => {
    const verdicts = verdictsFromRaw(expectations, [{ id: 'C1', holds: true, reason: 'x' }]);

    expect(verdicts.filter((entry) => !entry.satisfied).map((entry) => entry.id)).toEqual([
      'C2',
      'N1',
    ]);
  });
});

describe('buildJudgePrompt', () => {
  it('lists the statements, the reference and the answer', () => {
    const prompt = buildJudgePrompt({
      question: 'why?',
      referenceAnswer: 'because',
      expectations,
      answer: 'the answer',
    });

    expect(prompt).toContain('C1. The answer conveys: says A');
    expect(prompt).toContain('N1. The answer claims: says C');
    expect(prompt).toContain('because');
    expect(prompt.endsWith('the answer')).toBe(true);
  });
});

describe('ReferenceJudge', () => {
  it('accepts an answer that contains the reference and rejects any other', async () => {
    const judge = new ReferenceJudge();
    const input = { question: 'q', referenceAnswer: 'ref', expectations, answer: 'ref plus more' };

    expect((await judge.judge(input)).verdicts.every((entry) => entry.satisfied)).toBe(true);
    expect(
      (await judge.judge({ ...input, answer: 'other' })).verdicts.some((entry) => !entry.satisfied),
    ).toBe(true);
  });
});
