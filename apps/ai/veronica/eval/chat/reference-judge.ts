import { plainText } from './answer-text';
import type { JudgeInput, JudgePort, Judgement } from './judge';

const MATCHED = 'the answer is the reference answer';
const DIFFERENT = 'the answer differs from the reference answer';

const squashed = (text: string): string => plainText(text).replace(/\s+/g, ' ').trim();

export class ReferenceJudge implements JudgePort {
  async judge(input: JudgeInput): Promise<Judgement> {
    const identical = squashed(input.answer) === squashed(input.referenceAnswer);
    return {
      verdicts: input.expectations.map((expectation) => ({
        ...expectation,
        satisfied: identical,
        reason: identical ? MATCHED : DIFFERENT,
      })),
      costUsd: 0,
    };
  }
}
