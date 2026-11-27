import fc from 'fast-check';

import {
  ContentPartType,
  ModelError,
  ModelErrorCategory,
  StopReason,
  type ModelPort,
  type ModelPrice,
  type ModelRequest,
  type ModelResponse,
} from '@ratingo/ai-core';

import { TurnRole } from '../../src/modules/chat/domain/entities/conversation-turn';

import { EvalKind, type EvalCase } from './eval-case';
import {
  ExpectationKind,
  JUDGE_SYSTEM_PROMPT,
  JudgeUnavailableError,
  buildJudgePrompt,
  failedVerdicts,
  isSatisfied,
  judgeInputOf,
  judgedExpectationsOf,
  judgementPassed,
  verdictsFromResponse,
} from './judge';
import { ModelJudge } from './model-judge';

const PRICE: ModelPrice = {
  inputPerMTokUsd: 2,
  outputPerMTokUsd: 10,
  cacheReadPerMTokUsd: 0,
  cacheWritePerMTokUsd: 0,
  reasoningPerMTokUsd: 0,
};

const testCase: EvalCase = {
  id: 'backup',
  kind: EvalKind.KNOWN,
  question: 'Коли був останній бекап?',
  history: [
    { role: TurnRole.USER, text: 'Привіт' },
    { role: TurnRole.ASSISTANT, text: 'Привіт, питай.' },
  ],
  fixtures: [],
  requiredTools: [],
  expectations: {
    conveys: ['Says the last backup succeeded.', 'Says it was 6 hours ago.'],
    mustNotClaim: ['Says it failed.'],
  },
  reference: { calls: [], answer: 'Бекап вдався 6 годин тому.' },
};

const reply = (text: string): ModelResponse => ({
  model: 'anthropic:judge',
  content: [{ type: ContentPartType.TEXT, text }],
  stopReason: StopReason.END,
  usage: {
    inputTokens: 1000,
    outputTokens: 100,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
  },
});

const scriptedPort = (
  steps: readonly (string | Error)[],
): ModelPort & { requests: ModelRequest[] } => {
  const requests: ModelRequest[] = [];
  return {
    requests,
    capabilities: { promptCaching: false, thinking: false, images: false, structuredOutput: true },
    generate: async (request) => {
      const step = steps[Math.min(requests.length, steps.length - 1)];
      requests.push(request);
      if (step instanceof Error) throw step;
      return reply(step);
    },
  };
};

const verdictJson = (holds: Record<string, boolean>): string =>
  JSON.stringify({
    verdicts: Object.entries(holds).map(([id, value]) => ({ id, holds: value, reason: `r-${id}` })),
  });

describe('judged expectations', () => {
  it('numbers the statements C1.. and N1.. in order', () => {
    expect(judgedExpectationsOf(testCase)).toEqual([
      { id: 'C1', kind: ExpectationKind.CONVEYS, text: 'Says the last backup succeeded.' },
      { id: 'C2', kind: ExpectationKind.CONVEYS, text: 'Says it was 6 hours ago.' },
      { id: 'N1', kind: ExpectationKind.MUST_NOT_CLAIM, text: 'Says it failed.' },
    ]);
  });

  it('gives every statement its own id', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { maxLength: 8 }),
        fc.array(fc.string(), { maxLength: 8 }),
        (conveys, mustNotClaim) => {
          const ids = judgedExpectationsOf({
            ...testCase,
            expectations: { conveys, mustNotClaim },
          }).map((expectation) => expectation.id);
          expect(new Set(ids).size).toBe(conveys.length + mustNotClaim.length);
        },
      ),
    );
  });

  it('hands the judge the answer as plain text', () => {
    expect(judgeInputOf(testCase, '<b>Бекап</b> вдався &amp; все').answer).toBe(
      'Бекап вдався & все',
    );
  });
});

describe('isSatisfied', () => {
  it('reads «holds» as good for a conveyed statement and as bad for a forbidden claim', () => {
    expect(isSatisfied(ExpectationKind.CONVEYS, true)).toBe(true);
    expect(isSatisfied(ExpectationKind.CONVEYS, false)).toBe(false);
    expect(isSatisfied(ExpectationKind.MUST_NOT_CLAIM, true)).toBe(false);
    expect(isSatisfied(ExpectationKind.MUST_NOT_CLAIM, false)).toBe(true);
  });
});

describe('verdictsFromResponse', () => {
  const expectations = judgedExpectationsOf(testCase);

  it('maps every statement to a verdict in the case order', () => {
    const verdicts = verdictsFromResponse(expectations, {
      verdicts: [
        { id: 'N1', holds: false, reason: 'not claimed' },
        { id: 'C2', holds: false, reason: 'no hours' },
        { id: 'C1', holds: true, reason: 'says it' },
      ],
    });
    expect(verdicts.map((verdict) => [verdict.id, verdict.satisfied])).toEqual([
      ['C1', true],
      ['C2', false],
      ['N1', true],
    ]);
    expect(verdicts[1].reason).toBe('no hours');
  });

  it('fails a statement the judge skipped and ignores ids it invented', () => {
    const verdicts = verdictsFromResponse(expectations, {
      verdicts: [
        { id: 'C1', holds: true, reason: 'x' },
        { id: 'C9', holds: true, reason: 'invented' },
      ],
    });
    expect(verdicts.map((verdict) => verdict.satisfied)).toEqual([true, false, false]);
    expect(verdicts[1].reason).toMatch(/no verdict/);
  });

  it('is satisfied exactly when every conveyed statement holds and no forbidden one does', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }), (holds) => {
        const verdicts = verdictsFromResponse(expectations, {
          verdicts: expectations.map((expectation, index) => ({
            id: expectation.id,
            holds: holds[index],
            reason: 'x',
          })),
        });
        const judgement = { verdicts, costUsd: 0 };
        expect(judgementPassed(judgement)).toBe(holds[0] && holds[1] && !holds[2]);
        expect(failedVerdicts(judgement)).toHaveLength(verdicts.filter((v) => !v.satisfied).length);
      }),
    );
  });
});

describe('buildJudgePrompt', () => {
  it('shows the question, the history, the statements, the reference and the answer', () => {
    const prompt = buildJudgePrompt(judgeInputOf(testCase, 'Бекап був 6 годин тому.'));
    expect(prompt).toContain('Owner: Привіт');
    expect(prompt).toContain('Assistant: Привіт, питай.');
    expect(prompt).toContain('Коли був останній бекап?');
    expect(prompt).toContain('C1. The answer conveys: Says the last backup succeeded.');
    expect(prompt).toContain('N1. The answer claims: Says it failed.');
    expect(prompt).toContain('Бекап вдався 6 годин тому.');
    expect(prompt.endsWith('Бекап був 6 годин тому.')).toBe(true);
  });

  it('leaves the earlier conversation out when there is none', () => {
    const prompt = buildJudgePrompt(judgeInputOf({ ...testCase, history: [] }, 'x'));
    expect(prompt).not.toContain('Earlier conversation');
  });
});

describe('the rubric', () => {
  it('tells the judge to grade meaning, accept digits or words, and answer in JSON per id', () => {
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/meaning only/);
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/digits or as Ukrainian words/);
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/Include every id exactly once/);
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/only to deny it/);
  });
});

describe('ModelJudge', () => {
  const input = judgeInputOf(testCase, 'Бекап вдався 6 годин тому.');

  it('asks for structured JSON from the judge model with the rubric and no tools', async () => {
    const port = scriptedPort([verdictJson({ C1: true, C2: true, N1: false })]);
    await new ModelJudge(port, 'judge-model', PRICE).judge(input);
    const [request] = port.requests;
    expect(request).toMatchObject({ model: 'judge-model', tools: [], system: JUDGE_SYSTEM_PROMPT });
    expect(request.responseSchema?.name).toBe('expectation_verdicts');
    expect(JSON.stringify(request.responseSchema?.jsonSchema)).toContain('holds');
  });

  it('returns the verdicts and the cost of the call', async () => {
    const port = scriptedPort([verdictJson({ C1: true, C2: false, N1: false })]);
    const judgement = await new ModelJudge(port, 'judge-model', PRICE).judge(input);
    expect(judgementPassed(judgement)).toBe(false);
    expect(failedVerdicts(judgement).map((verdict) => verdict.id)).toEqual(['C2']);
    expect(judgement.costUsd).toBeCloseTo((1000 * 2 + 100 * 10) / 1_000_000);
  });

  it('reads JSON wrapped in a code fence', async () => {
    const fenced = `\`\`\`json\n${verdictJson({ C1: true, C2: true, N1: false })}\n\`\`\``;
    const judgement = await new ModelJudge(scriptedPort([fenced]), 'm', PRICE).judge(input);
    expect(judgementPassed(judgement)).toBe(true);
  });

  it('asks once more after a reply that is not the schema, and adds up both costs', async () => {
    const port = scriptedPort(['not json', verdictJson({ C1: true, C2: true, N1: false })]);
    const judgement = await new ModelJudge(port, 'm', PRICE).judge(input);
    expect(judgementPassed(judgement)).toBe(true);
    expect(port.requests).toHaveLength(2);
    expect(port.requests[1].messages).toHaveLength(3);
    expect(judgement.costUsd).toBeCloseTo(2 * 0.003);
  });

  it('gives up after the repair attempt fails', async () => {
    const port = scriptedPort(['nope', '{"verdicts": 3}']);
    await expect(new ModelJudge(port, 'm', PRICE).judge(input)).rejects.toThrow(
      JudgeUnavailableError,
    );
    expect(port.requests).toHaveLength(2);
  });

  it('turns a model error into a judge error that names only the category', async () => {
    const port = scriptedPort([
      new ModelError(ModelErrorCategory.RATE_LIMIT, 'secret sk-ant-leak'),
    ]);
    const failure = new ModelJudge(port, 'm', PRICE).judge(input);
    await expect(failure).rejects.toThrow(JudgeUnavailableError);
    await expect(failure).rejects.not.toThrow(/sk-ant-leak/);
  });
});
