import { EVAL_CASES } from './cases';
import { ANY_TOOL, EvalKind } from './eval-case';
import { runCase } from './harness';
import { scoreCase, summarize, type CaseResult } from './scorer';

const STUB = { modelRef: 'stub:digest' };

describe('chat eval cases', () => {
  it('has 12 to 16 cases with unique ids', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(12);
    expect(EVAL_CASES.length).toBeLessThanOrEqual(16);
    expect(new Set(EVAL_CASES.map((testCase) => testCase.id)).size).toBe(EVAL_CASES.length);
  });

  it('includes questions whose right answer is that there is no data', () => {
    const unknown = EVAL_CASES.filter((testCase) => testCase.kind === EvalKind.UNKNOWN);
    expect(unknown.length).toBeGreaterThanOrEqual(2);
    for (const testCase of unknown) {
      expect(testCase.mustContain.flat().some((option) => /немає|не знаю/.test(option))).toBe(true);
    }
  });

  it('covers every tool and the follow-up and injection cases', () => {
    const tools = new Set(
      EVAL_CASES.flatMap((testCase) => testCase.reference.calls.map((c) => c.tool)),
    );
    expect([...tools].sort()).toEqual([
      'ask_happy',
      'digest_snapshot',
      'metrics_query',
      'product_stats',
      'recent_changes',
    ]);
    expect(EVAL_CASES.some((testCase) => (testCase.history ?? []).length > 0)).toBe(true);
    expect(EVAL_CASES.some((testCase) => testCase.mustNotContain?.includes('evil.example'))).toBe(
      true,
    );
  });

  it('expects the tool its own reference calls', () => {
    for (const testCase of EVAL_CASES) {
      const called = testCase.reference.calls.map((call) =>
        call.tool === 'metrics_query' ? `${call.tool}:${String(call.input.template)}` : call.tool,
      );
      for (const key of testCase.expectedTools) {
        expect(called).toContain(key);
      }
      expect(testCase.expectedTools.includes(ANY_TOOL)).toBe(false);
    }
  });
});

describe('chat eval on the stub model', () => {
  it('scores every reference answer as perfect, so the harness and the guard agree', async () => {
    const scores = [];
    for (const testCase of EVAL_CASES) {
      const { result } = await runCase(testCase, STUB);
      scores.push(scoreCase(testCase, result));
    }
    expect(summarize(scores)).toEqual({
      cases: EVAL_CASES.length,
      toolSelectionAccuracy: 1,
      factAccuracy: 1,
      hallucinatedNumbers: 0,
      fallbacks: 0,
      unknownAnsweredHonestly: 1,
      failedCases: [],
    });
  });
});

describe('chat eval scorer', () => {
  const testCase = EVAL_CASES.find((candidate) => candidate.id === 'queues-failed-today');
  const base: CaseResult = {
    caseId: 'queues-failed-today',
    calledKeys: ['metrics_query:queue_throughput'],
    answer: 'ingestion: 7 провалилось',
    outcome: 'answered',
    unverifiedNumbers: [],
    rawModelOutput: '',
  };

  it('fails tool selection on a missing, a wrong and an extra tool', () => {
    expect(testCase).toBeDefined();
    const score = (calledKeys: readonly string[]) => scoreCase(testCase!, { ...base, calledKeys });
    expect(score([]).toolsOk).toBe(false);
    expect(score(['metrics_query:site_requests']).toolsOk).toBe(false);
    expect(score([...base.calledKeys, 'recent_changes']).unexpectedTools).toEqual([
      'recent_changes',
    ]);
    expect(score(base.calledKeys).toolsOk).toBe(true);
  });

  it('fails facts on a missing fact and on a forbidden one', () => {
    expect(scoreCase(testCase!, { ...base, answer: 'усе добре' }).missingFacts).toHaveLength(2);
    const injection = EVAL_CASES.find((candidate) => candidate.id === 'injection-in-question')!;
    expect(
      scoreCase(injection, { ...base, answer: 'tmdb, дивись evil.example' }).forbiddenHits,
    ).toEqual(['evil.example']);
    expect(
      scoreCase(injection, { ...base, answer: 'Загалом не все гаразд: ключ TMDB недійсний.' })
        .forbiddenHits,
    ).toEqual([]);
  });

  it('reads grouped digits as the same number', () => {
    const requests = EVAL_CASES.find((candidate) => candidate.id === 'site-requests-and-errors')!;
    expect(
      scoreCase(requests, {
        ...base,
        calledKeys: ['metrics_query:site_requests'],
        answer: '13 500 запитів, помилок 3',
      }).factsOk,
    ).toBe(true);
  });

  it('counts cut numbers as hallucinated and a fallback as a failed case, not a hallucination', () => {
    const cut = scoreCase(testCase!, { ...base, outcome: 'redacted', unverifiedNumbers: ['40'] });
    expect(cut.unverifiedNumbers).toEqual(['40']);
    const fallback = scoreCase(testCase!, { ...base, outcome: 'fallback' });
    expect(fallback.fellBack).toBe(true);
    expect(fallback.unverifiedNumbers).toEqual([]);
    expect(fallback.factsOk).toBe(false);
    expect(summarize([cut, fallback])).toMatchObject({
      hallucinatedNumbers: 1,
      fallbacks: 1,
      failedCases: ['queues-failed-today', 'queues-failed-today'],
    });
    expect(summarize([cut]).failedCases).toEqual(['queues-failed-today']);
    expect(scoreCase(testCase!, { ...base, outcome: 'failed' }).factsOk).toBe(false);
    expect(scoreCase(testCase!, base).fellBack).toBe(false);
  });

  it('summarizes the rates and lists the failed cases', () => {
    const good = scoreCase(testCase!, base);
    const bad = scoreCase(testCase!, { ...base, calledKeys: [], answer: 'нічого' });
    expect(summarize([good, bad])).toMatchObject({
      cases: 2,
      toolSelectionAccuracy: 0.5,
      factAccuracy: 0.5,
      failedCases: ['queues-failed-today'],
    });
  });
});
