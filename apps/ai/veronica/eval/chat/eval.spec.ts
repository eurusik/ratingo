import type { RowList } from '@ratingo/ai-core';

import {
  FORMAL_ADDRESS,
  GENDERED_ADDRESS,
  HONEST_NO_DATA,
  MINOR_FINDINGS,
  NO_CODE_REVIEW,
  NOTHING_RECORDED,
  WHOLE_DAYS_COUNTED,
} from './answer-stems';
import { EVAL_CASES } from './cases';
import { GA_EVAL_CASES } from './google-analytics.cases';
import { LOKI_EVAL_CASES } from './loki.cases';
import { ANY_TOOL, EvalKind } from './eval-case';
import { kyivDayFromEvalNow, kyivTimeFromEvalNow, sameKyivTime } from './eval-clock';
import { fixtureExecutors, runCase } from './harness';
import { scoreCase, summarize, type CaseResult } from './scorer';

const STUB = { modelRef: 'stub:digest' };
const STUB_EVAL_TIMEOUT_MS = 60_000;
const KYIV_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const KYIV_DATE_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/u;
const FUTURE_TIME_KEY = /^next/u;

interface DatedValue {
  key: string;
  value: string;
}

const datedValuesIn = (value: unknown, key = ''): DatedValue[] => {
  if (typeof value === 'string') {
    return KYIV_DATE.test(value) || KYIV_DATE_TIME.test(value) ? [{ key, value }] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item) => datedValuesIn(item, key));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([childKey, child]) => datedValuesIn(child, childKey));
  }
  return [];
};

const isAfterEvalNow = ({ value }: DatedValue): boolean =>
  KYIV_DATE.test(value) ? value > kyivDayFromEvalNow(0) : value > kyivTimeFromEvalNow(0);

describe('chat eval cases', () => {
  it('has 12 to 60 cases with unique ids', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(12);
    expect(EVAL_CASES.length).toBeLessThanOrEqual(60);
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
      'logs_search',
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

  it('covers the log questions, an empty result, an outage and an injection in a log record', () => {
    expect(LOKI_EVAL_CASES.map((testCase) => testCase.id)).toEqual([
      'logs-worker-today',
      'logs-storm-limit-reached',
      'logs-job-id-follow-up',
      'logs-api-no-errors',
      'logs-unavailable',
      'logs-injection-in-record',
    ]);
    const injection = LOKI_EVAL_CASES.find(
      (testCase) => testCase.id === 'logs-injection-in-record',
    );
    expect(injection?.mustNotContain).toContain('evil.example');
    expect(
      LOKI_EVAL_CASES.every((testCase) => testCase.reference.calls[0]?.tool === 'logs_search'),
    ).toBe(true);
  });

  it('dates no fixture after the eval clock, except a next-run time', () => {
    const futureDates = EVAL_CASES.flatMap((testCase) =>
      datedValuesIn(testCase.fixtures)
        .filter((dated) => !FUTURE_TIME_KEY.test(dated.key))
        .filter(isAfterEvalNow)
        .map((dated) => `${testCase.id}: ${dated.key}=${dated.value}`),
    );
    expect(futureDates).toEqual([]);
  });

  it('notices a fixture dated after the eval clock', () => {
    const tomorrow = { lastSuccessAtKyiv: kyivTimeFromEvalNow(24), day: kyivDayFromEvalNow(1) };
    expect(datedValuesIn(tomorrow).filter(isAfterEvalNow)).toHaveLength(2);
    expect(datedValuesIn({ nextRunAtKyiv: kyivTimeFromEvalNow(24) })[0]?.key).toBe('nextRunAtKyiv');
  });

  it('answers job_failures in every case, with no failures unless the case says otherwise', async () => {
    for (const testCase of EVAL_CASES) {
      const answer = fixtureExecutors(testCase)
        .jobFailures({})
        .catch((error: Error) => error.message);
      await expect(answer).resolves.not.toEqual(expect.stringMatching(/^No fixture/u));
    }
    const quiet = EVAL_CASES.find((testCase) => testCase.id === 'backup-last')!;
    const week = (await fixtureExecutors(quiet).jobFailures({ window: '7d' })) as RowList;
    expect(week.withAllRows()).toMatchObject({
      window: '7d',
      countedKyivDays: { from: kyivDayFromEvalNow(-7), to: kyivDayFromEvalNow(0) },
      failures: [],
    });
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

  it.each([
    'лічильник у даних рахує весь день 22 листопада',
    'сьогодні з початку дня 40 відмов',
    'це число за цілу добу, не за шість годин',
    'дані рахують повні дні',
  ])('reads «%s» as counting whole days', (answer) => {
    expect(WHOLE_DAYS_COUNTED.test(answer)).toBe(true);
  });

  it('does not read a six-hour count as whole days', () => {
    expect(WHOLE_DAYS_COUNTED.test('за останні шість годин було 40 відмов')).toBe(false);
  });

  it.each(['2 зауваження низької важливості', 'дрібні зауваження', 'minor findings'])(
    'reads «%s» as minor findings',
    (answer) => {
      expect(MINOR_FINDINGS.test(answer)).toBe(true);
    },
  );
});

describe('same Kyiv time', () => {
  it.each([
    'востаннє 2026-11-23 09:00',
    'відпрацював 2026-11-23 о 09:00 (київ)',
    'у понеділок 23 листопада о 09:00',
    '<b>23 листопада о 9:00</b>',
  ])('reads «%s» as 2026-11-23 09:00', (answer) => {
    expect(sameKyivTime('2026-11-23 09:00').test(answer)).toBe(true);
  });

  it.each(['2026-11-23 о 19:00', '24 листопада о 09:00', '2026-11-30 09:00'])(
    'does not read «%s» as 2026-11-23 09:00',
    (answer) => {
      expect(sameKyivTime('2026-11-23 09:00').test(answer)).toBe(false);
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

  it.each(['ви можете написати', 'ваш pr', 'напишу вам', 'для вас'])(
    'catches the formal address in «%s»',
    (answer) => {
      expect(FORMAL_ADDRESS.test(answer)).toBe(true);
    },
  );

  it.each(['назви файлів', 'з голови', 'на мові', 'важливо', 'напиши мені'])(
    'leaves «%s» alone as no formal address',
    (answer) => {
      expect(FORMAL_ADDRESS.test(answer)).toBe(false);
    },
  );

  it('leaves neutral address alone', () => {
    expect(
      GENDERED_ADDRESS.test('якщо йдеться про google analytics, ось цифри. ти про сайт?'),
    ).toBe(false);
  });
});
