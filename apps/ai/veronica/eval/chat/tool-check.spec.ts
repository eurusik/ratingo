import fc from 'fast-check';

import { checkTools } from './tool-check';

describe('checkTools', () => {
  const testCase = {
    requiredTools: ['job_failures', 'logs_search'],
    forbiddenTools: ['ask_happy', 'metrics_query'],
  };

  it('passes when every required tool was called, in any order, with other read-only tools too', () => {
    expect(checkTools(testCase, ['logs_search', 'recent_changes', 'job_failures']).ok).toBe(true);
    expect(checkTools(testCase, ['job_failures', 'logs_search', 'digest_snapshot']).ok).toBe(true);
  });

  it('names the required tools that were not called', () => {
    expect(checkTools(testCase, ['job_failures'])).toMatchObject({
      ok: false,
      missing: ['logs_search'],
    });
  });

  it('fails on a forbidden tool and on a forbidden family of templates', () => {
    expect(checkTools(testCase, ['job_failures', 'logs_search', 'ask_happy'])).toMatchObject({
      ok: false,
      forbiddenCalled: ['ask_happy'],
    });
    expect(
      checkTools(testCase, ['job_failures', 'logs_search', 'metrics_query:queue_throughput']),
    ).toMatchObject({ ok: false, forbiddenCalled: ['metrics_query:queue_throughput'] });
  });

  it('does not take a tool that merely starts with a forbidden name for it', () => {
    expect(
      checkTools({ requiredTools: [], forbiddenTools: ['metrics_query'] }, ['metrics_querying']).ok,
    ).toBe(true);
  });

  it('asks for a template exactly', () => {
    const needsBacklog = { requiredTools: ['metrics_query:queue_backlog_peak'] };
    expect(checkTools(needsBacklog, ['metrics_query:queue_throughput']).ok).toBe(false);
    expect(checkTools(needsBacklog, ['metrics_query:queue_backlog_peak']).ok).toBe(true);
  });

  it('lists a forbidden tool once however often it was called', () => {
    expect(
      checkTools({ requiredTools: [], forbiddenTools: ['ask_happy'] }, ['ask_happy', 'ask_happy'])
        .forbiddenCalled,
    ).toEqual(['ask_happy']);
  });

  it('passes a case with no demands whatever was called', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 12 })), (called) => {
        expect(checkTools({ requiredTools: [] }, called).ok).toBe(true);
      }),
    );
  });

  it('passes exactly when nothing required is missing and nothing forbidden was called', () => {
    const tools = ['a', 'b', 'c', 'd'];
    fc.assert(
      fc.property(
        fc.subarray(tools),
        fc.subarray(tools),
        fc.subarray(tools),
        (required, forbidden, called) => {
          const result = checkTools({ requiredTools: required, forbiddenTools: forbidden }, called);
          const expected =
            required.every((tool) => called.includes(tool)) &&
            !called.some((tool) => forbidden.includes(tool));
          expect(result.ok).toBe(expected);
        },
      ),
    );
  });
});
