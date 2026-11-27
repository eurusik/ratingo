import type { RowList } from '@ratingo/ai-core';

import { summarize } from './aggregate';
import { EVAL_CASES } from './cases';
import { EvalKind } from './eval-case';
import { kyivDayFromEvalNow, kyivTimeFromEvalNow } from './eval-clock';
import { runEval } from './eval-runner';
import { findForbiddenContent } from './forbidden-content';
import { GA_EVAL_CASES } from './google-analytics.cases';
import { explorerEval, needsExplorerDatabase } from './explorer-eval-database';
import { fixtureExecutors, runCase } from './harness';
import { LOKI_EVAL_CASES } from './loki.cases';
import { ReferenceJudge } from './reference-judge';

const STUB = { modelRef: 'stub:digest' };
const describeWithExplorerDatabase = explorerEval.adminUrl === undefined ? describe.skip : describe;
const CASES_WITHOUT_DATABASE = EVAL_CASES.filter((testCase) => !needsExplorerDatabase(testCase));
const CASES_WITH_DATABASE = EVAL_CASES.filter(needsExplorerDatabase);
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

const referenceKeys = (testCase: (typeof EVAL_CASES)[number]): string[] =>
  testCase.reference.calls.map((call) =>
    call.tool === 'metrics_query' ? `${call.tool}:${String(call.input.template)}` : call.tool,
  );

describe('chat eval cases', () => {
  it('has 12 to 80 cases with unique ids', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(12);
    expect(EVAL_CASES.length).toBeLessThanOrEqual(80);
    expect(new Set(EVAL_CASES.map((testCase) => testCase.id)).size).toBe(EVAL_CASES.length);
  });

  it('states at least one expectation in words for every case', () => {
    for (const testCase of EVAL_CASES) {
      expect(testCase.expectations.conveys.length).toBeGreaterThan(0);
      for (const sentence of [
        ...testCase.expectations.conveys,
        ...(testCase.expectations.mustNotClaim ?? []),
      ]) {
        expect(sentence.trim().length).toBeGreaterThan(15);
        expect(sentence).not.toMatch(/^\/|\\\\|\(\?/u);
      }
    }
  });

  it('includes questions whose right answer is that there is no data', () => {
    const unknown = EVAL_CASES.filter((testCase) => testCase.kind === EvalKind.UNKNOWN);
    expect(unknown.length).toBeGreaterThanOrEqual(2);
    for (const testCase of unknown) {
      expect(testCase.expectations.conveys.join(' ')).toMatch(
        /unavailable|no data|does not know/iu,
      );
    }
  });

  it('covers every tool and the follow-up and injection cases', () => {
    const tools = new Set(
      EVAL_CASES.flatMap((testCase) => testCase.reference.calls.map((call) => call.tool)),
    );
    expect([...tools].sort()).toEqual([
      'ask_dume',
      'ask_happy',
      'db_query',
      'db_schema',
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
    expect(EVAL_CASES.some((testCase) => testCase.forbiddenText?.includes('evil.example'))).toBe(
      true,
    );
  });

  it('covers the Google Analytics questions, its outage and an injection in GA data', () => {
    expect(GA_EVAL_CASES.map((testCase) => testCase.id)).toEqual(
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
    expect(injection?.forbiddenText).toContain('evil.example');
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
    expect(injection?.forbiddenText).toContain('evil.example');
    expect(
      LOKI_EVAL_CASES.every((testCase) => testCase.reference.calls[0]?.tool === 'logs_search'),
    ).toBe(true);
  });

  it('asks for the logs when the owner asks why something broke', () => {
    const why = EVAL_CASES.find((testCase) => testCase.id === 'why-trending-stale')!;
    expect(why.requiredTools).toContain('logs_search');
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

  it('requires only tools its own reference calls, and forbids none of them', () => {
    for (const testCase of EVAL_CASES) {
      const called = referenceKeys(testCase);
      for (const key of testCase.requiredTools) {
        expect(called).toContain(key);
      }
      for (const forbidden of testCase.forbiddenTools ?? []) {
        expect(called.some((key) => key === forbidden || key.startsWith(`${forbidden}:`))).toBe(
          false,
        );
        expect(testCase.requiredTools).not.toContain(forbidden);
      }
    }
  });

  it('lets no reference answer trip the checks that run on every answer', () => {
    for (const testCase of EVAL_CASES) {
      expect({
        id: testCase.id,
        hits: findForbiddenContent(testCase.reference.answer, testCase.forbiddenText),
      }).toEqual({ id: testCase.id, hits: [] });
    }
  });
});

describe('chat eval on the stub model', () => {
  it(
    'passes every case that needs no database when the model replays the reference answer and the judge compares with it',
    async () => {
      const run = await runEval(
        CASES_WITHOUT_DATABASE,
        { runAgent: (testCase) => runCase(testCase, STUB), judge: new ReferenceJudge() },
        { repeat: { runs: 1, passAt: 1 }, concurrency: 4, maxCostUsd: 1 },
      );
      expect(summarize(run.outcomes)).toMatchObject({
        cases: CASES_WITHOUT_DATABASE.length,
        passedCases: CASES_WITHOUT_DATABASE.length,
        toolSelectionRate: 1,
        factRate: 1,
        answersWithFlags: 0,
        wrongNumbers: 0,
        fallbacks: 0,
        unscorableRuns: 0,
        failedCases: [],
        flakyCases: [],
      });
      expect(run.agentCostUsd + run.judgeCostUsd).toBe(0);
    },
    STUB_EVAL_TIMEOUT_MS,
  );

  it(
    'fails a case whose answer is not the reference answer, so the wiring can fail',
    async () => {
      const [testCase] = EVAL_CASES;
      const run = await runEval(
        [testCase],
        {
          runAgent: async (current) => {
            const replay = await runCase(current, STUB);
            return { ...replay, result: { ...replay.result, answer: 'щось інше' } };
          },
          judge: new ReferenceJudge(),
        },
        { repeat: { runs: 1, passAt: 1 }, concurrency: 1, maxCostUsd: 1 },
      );
      expect(run.outcomes[0].passed).toBe(false);
      expect(run.outcomes[0].runs[0].failedExpectations.length).toBeGreaterThan(0);
    },
    STUB_EVAL_TIMEOUT_MS,
  );

  it(
    'fails a case whose tools are wrong even when the answer is right',
    async () => {
      const testCase = EVAL_CASES.find((current) => current.requiredTools.length > 0)!;
      const run = await runEval(
        [testCase],
        {
          runAgent: async (current) => {
            const replay = await runCase(current, STUB);
            return { ...replay, result: { ...replay.result, calledKeys: [] } };
          },
          judge: new ReferenceJudge(),
        },
        { repeat: { runs: 1, passAt: 1 }, concurrency: 1, maxCostUsd: 1 },
      );
      expect(run.outcomes[0].runs[0]).toMatchObject({
        toolsOk: false,
        factsOk: true,
        passed: false,
      });
    },
    STUB_EVAL_TIMEOUT_MS,
  );
});

describeWithExplorerDatabase('chat eval of the database tools on the stub model', () => {
  beforeAll(async () => {
    await explorerEval.startIfConfigured();
  }, STUB_EVAL_TIMEOUT_MS);

  afterAll(async () => {
    await explorerEval.stop();
  });

  it(
    'passes every case whose tools run against the migrated database, with every number taken from the real rows',
    async () => {
      const run = await runEval(
        CASES_WITH_DATABASE,
        { runAgent: (testCase) => runCase(testCase, STUB), judge: new ReferenceJudge() },
        { repeat: { runs: 1, passAt: 1 }, concurrency: 2, maxCostUsd: 1 },
      );
      expect(summarize(run.outcomes)).toMatchObject({
        cases: CASES_WITH_DATABASE.length,
        passedCases: CASES_WITH_DATABASE.length,
        answersWithFlags: 0,
        wrongNumbers: 0,
        fallbacks: 0,
        unscorableRuns: 0,
        failedCases: [],
        flakyCases: [],
      });
    },
    STUB_EVAL_TIMEOUT_MS,
  );
});
