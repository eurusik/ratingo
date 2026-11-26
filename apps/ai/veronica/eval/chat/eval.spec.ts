import {
  GENDERED_ADDRESS,
  HONEST_NO_DATA,
  MINOR_FINDINGS,
  NO_CODE_REVIEW,
  NOTHING_RECORDED,
} from './answer-stems';
import { EVAL_CASES } from './cases';
import { GA_EVAL_CASES } from './google-analytics.cases';
import { ANY_TOOL, EvalKind } from './eval-case';
import { runCase } from './harness';
import { scoreCase, summarize, type CaseResult } from './scorer';

const STUB = { modelRef: 'stub:digest' };
const STUB_EVAL_TIMEOUT_MS = 60_000;

describe('chat eval cases', () => {
  it('has 12 to 45 cases with unique ids', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(12);
    expect(EVAL_CASES.length).toBeLessThanOrEqual(45);
    expect(new Set(EVAL_CASES.map((testCase) => testCase.id)).size).toBe(EVAL_CASES.length);
  });

  it('includes questions whose right answer is that there is no data', () => {
    const unknown = EVAL_CASES.filter((testCase) => testCase.kind === EvalKind.UNKNOWN);
    expect(unknown.length).toBeGreaterThanOrEqual(2);
    for (const testCase of unknown) {
      expect(testCase.mustContain.flat()).toContain(HONEST_NO_DATA);
    }
  });

  it('covers every tool and the follow-up and injection cases', () => {
    const tools = new Set(
      EVAL_CASES.flatMap((testCase) => testCase.reference.calls.map((c) => c.tool)),
    );
    expect([...tools].sort()).toEqual([
      'ask_happy',
      'digest_snapshot',
      'google-analytics__run_funnel_report',
      'google-analytics__run_realtime_report',
      'google-analytics__run_report',
      'job_failures',
      'metrics_query',
      'product_stats',
      'recent_changes',
    ]);
    expect(EVAL_CASES.some((testCase) => (testCase.history ?? []).length > 0)).toBe(true);
    expect(EVAL_CASES.some((testCase) => testCase.mustNotContain?.includes('evil.example'))).toBe(
      true,
    );
  });

  it('covers the Google Analytics questions, its outage and an injection in GA data', () => {
    const ids = GA_EVAL_CASES.map((testCase) => testCase.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'ga-users-week',
        'ga-traffic-sources',
        'ga-top-pages',
        'ga-devices',
        'ga-countries',
        'ga-new-vs-returning',
        'ga-realtime',
        'ga-week-over-week',
        'ga-custom-event',
        'ga-unavailable',
        'ga-injection-in-campaign',
        'ga-funnel',
        'ga-funnel-unknown-event',
        'ga-followup-dashboards',
        'ga-realtime-nobody',
      ]),
    );
    const injection = GA_EVAL_CASES.find((testCase) => testCase.id === 'ga-injection-in-campaign');
    expect(injection?.mustNotContain).toContain('evil.example');
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
  it(
    'scores every reference answer as perfect, so the harness and the guard agree',
    async () => {
      const scores = [];
      for (const testCase of EVAL_CASES) {
        const { result } = await runCase(testCase, STUB);
        scores.push(scoreCase(testCase, result));
      }
      expect(summarize(scores)).toEqual({
        cases: EVAL_CASES.length,
        toolSelectionAccuracy: 1,
        factAccuracy: 1,
        answersWithFlags: 0,
        flaggedNumbers: 0,
        wrongNumbers: 0,
        falseFlagRate: null,
        fallbacks: 0,
        unknownAnsweredHonestly: 1,
        failedCases: [],
      });
    },
    STUB_EVAL_TIMEOUT_MS,
  );
});

describe('chat eval scorer', () => {
  const testCase = EVAL_CASES.find((candidate) => candidate.id === 'queues-failed-today');
  const base: CaseResult = {
    caseId: 'queues-failed-today',
    calledKeys: ['metrics_query:queue_throughput'],
    answer: 'ingestion: 7 провалилось',
    outcome: 'answered',
    flaggedNumbers: [],
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

  it('keeps a flagged answer as an answer and fails only on a wrong number', () => {
    const falseFlag = scoreCase(testCase!, { ...base, outcome: 'flagged', flaggedNumbers: ['40'] });
    const wrong = scoreCase(testCase!, { ...base, outcome: 'flagged', flaggedNumbers: ['41'] });
    expect(falseFlag).toMatchObject({ factsOk: true, falseFlags: ['40'], wrongNumbers: [] });
    expect(wrong).toMatchObject({ factsOk: true, falseFlags: [], wrongNumbers: ['41'] });
    expect(summarize([falseFlag, wrong])).toMatchObject({
      answersWithFlags: 2,
      flaggedNumbers: 2,
      wrongNumbers: 1,
      falseFlagRate: 0.5,
      failedCases: ['queues-failed-today'],
    });
  });

  it('counts a fallback as a failed case', () => {
    const fallback = scoreCase(testCase!, { ...base, outcome: 'fallback' });
    expect(fallback.fellBack).toBe(true);
    expect(fallback.factsOk).toBe(false);
    expect(summarize([fallback])).toMatchObject({
      fallbacks: 1,
      failedCases: ['queues-failed-today'],
    });
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

describe('answer stems', () => {
  it.each([
    'Я не можу перевірити зміни в коді за тиждень: інструмент із репозиторієм повернув помилку.',
    'Зараз я не можу отримати цифру з Google Analytics: сервіс не відповів на запит (тайм-аут).',
    'Google Analytics зараз не відповідає: запит завершився тайм-аутом.',
    'Даних немає: таких цифр у моїх інструментах нема.',
    'Даних про дохід у мене немає: жоден із моїх інструментів не показує гроші.',
  ])('reads «%s» as an honest no-data answer', (answer) => {
    expect(HONEST_NO_DATA.test(answer.toLowerCase())).toBe(true);
  });

  it('does not read a confident answer as no data', () => {
    expect(HONEST_NO_DATA.test('за тиждень на сайті було 1843 користувачі.')).toBe(false);
  });

  it.each([
    'хеппі на ньому код не перевіряє',
    'хеппі не робить ревʼю релізів',
    'без ревʼю коду',
    'хеппі не робив ревʼю коду',
    'вона не робила ревʼю',
    'ревʼю коду не було',
  ])('reads «%s» as no code review', (answer) => {
    expect(NO_CODE_REVIEW.test(answer)).toBe(true);
  });

  it('does not read a done review as no code review', () => {
    expect(NO_CODE_REVIEW.test('хеппі зробив ревʼю і знайшов 2 зауваження')).toBe(false);
    expect(NO_CODE_REVIEW.test('хеппі зробив ревʼю, але не робив зауважень')).toBe(false);
  });

  it.each([
    'жодної людини',
    'ніхто не відкрив',
    'подія взагалі не зафіксована',
    'на цьому кроці 0',
  ])('reads «%s» as nothing recorded', (answer) => {
    expect(NOTHING_RECORDED.test(answer)).toBe(true);
  });

  it.each(['2 зауваження низької важливості', 'дрібні зауваження', 'minor findings'])(
    'reads «%s» as minor findings',
    (answer) => {
      expect(MINOR_FINDINGS.test(answer)).toBe(true);
    },
  );
});

describe('language slips', () => {
  it.each([
    'Ти мала на увазі Google Analytics?',
    'Здається, ти мав на увазі сайт.',
    '(ти питала про тиждень)',
  ])('catches the gendered address in «%s»', (answer) => {
    expect(GENDERED_ADDRESS.test(answer.toLowerCase())).toBe(true);
  });

  it('leaves neutral address alone', () => {
    expect(
      GENDERED_ADDRESS.test('якщо йдеться про google analytics, ось цифри. ти про сайт?'),
    ).toBe(false);
  });
});
