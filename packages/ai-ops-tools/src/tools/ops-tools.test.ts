import type { ToolContext } from '@ratingo/ai-core';

import {
  DB_QUERY_TIMEOUT_LIMIT_STATUS,
  DB_QUERY_TIMEOUTS_PER_RUN,
  QueryRefusal,
} from '../database/database.constants';

import { createOpsTools, type OpsExecutors } from './ops-tools';

const CONTEXT = { markEmpty: () => undefined } as unknown as ToolContext;
const TIMEOUT_ANSWER = { status: QueryRefusal.TIMEOUT, message: 'the database stopped the query' };
const EXTRA_ATTEMPTS = 3;

const dbToolAnswering = (answer: () => unknown) => {
  let calls = 0;
  const executors = {
    dbQuery: async () => {
      calls += 1;
      return answer();
    },
  } as unknown as OpsExecutors;
  const { dbQuery } = createOpsTools(executors);
  return {
    ask: () => dbQuery.run({ sql: 'select 1 as n' }, CONTEXT),
    callsToDatabase: () => calls,
  };
};

describe('db_query timeouts in one run', () => {
  it(`stops calling the database after ${DB_QUERY_TIMEOUTS_PER_RUN} timeouts and says the limit is reached`, async () => {
    const tool = dbToolAnswering(() => TIMEOUT_ANSWER);

    const answers: string[] = [];
    for (let attempt = 0; attempt < DB_QUERY_TIMEOUTS_PER_RUN + EXTRA_ATTEMPTS; attempt += 1) {
      answers.push(await tool.ask());
    }

    const afterLimit = answers.slice(DB_QUERY_TIMEOUTS_PER_RUN);
    expect(tool.callsToDatabase()).toBe(DB_QUERY_TIMEOUTS_PER_RUN);
    expect(answers.slice(0, DB_QUERY_TIMEOUTS_PER_RUN).every((a) => a.includes('"timeout"'))).toBe(
      true,
    );
    expect(afterLimit).toHaveLength(EXTRA_ATTEMPTS);
    for (const answer of afterLimit) {
      expect(answer).toContain(`"status":"${DB_QUERY_TIMEOUT_LIMIT_STATUS}"`);
      expect(answer).toContain('no more queries will run');
      expect(answer).toContain('the full calculation did not finish');
    }
  });

  it('does not count answers that are not timeouts', async () => {
    const tool = dbToolAnswering(() => ({ columns: [], rows: [] }));

    for (let attempt = 0; attempt < 6; attempt += 1) await tool.ask();

    expect(tool.callsToDatabase()).toBe(6);
  });

  it('starts counting again with the next set of tools, which is the next run', async () => {
    const first = dbToolAnswering(() => TIMEOUT_ANSWER);
    for (let attempt = 0; attempt < 4; attempt += 1) await first.ask();
    const second = dbToolAnswering(() => TIMEOUT_ANSWER);

    await second.ask();

    expect(second.callsToDatabase()).toBe(1);
  });
});
