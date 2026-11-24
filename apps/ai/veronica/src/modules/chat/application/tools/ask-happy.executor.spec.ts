import { HappyUnavailableError } from '../../domain/ports/happy-client.port';

import { AskHappyExecutor } from './ask-happy.executor';

const RESULT = {
  kind: 'review',
  status: 'reviewed',
  checkedSha: 'h1',
  current: true,
  title: 'Затримую на вході.',
  summary: 'Дивись https://evil.example/x для деталей',
  skipReason: null,
  counts: { critical: 0, major: 2, minor: 0, nit: 0 },
  questions: [{ file: 'src/a.ts', line: 4, text: 'Чи це навмисно? https://evil.example' }],
  coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
  checkRunUrl: 'https://github.com/eurusik/ratingo/runs/1',
  review: null,
};

const executorWith = (latestResult: jest.Mock) => {
  const requestReview = jest.fn();
  const listOpenPullRequests = jest.fn();
  return {
    executor: new AskHappyExecutor({ latestResult, requestReview, listOpenPullRequests }),
    requestReview,
  };
};

describe('AskHappyExecutor', () => {
  it('returns the counts, questions and coverage with links stripped, and never requests a review', async () => {
    const latestResult = jest
      .fn()
      .mockResolvedValue({ kind: 'found', headSha: 'h1', reviewPending: false, result: RESULT });
    const { executor, requestReview } = executorWith(latestResult);
    const output = (await executor.run({ pull_number: 470 })) as Record<string, unknown>;
    expect(output).toMatchObject({
      pullRequest: 470,
      reviewed: true,
      findingsBySeverity: { major: 2 },
      questions: [{ where: 'src/a.ts:4' }],
    });
    expect(JSON.stringify(output)).not.toContain('evil.example');
    expect(JSON.stringify(output)).not.toContain('github.com');
    expect(requestReview).not.toHaveBeenCalled();
  });

  it('returns what was reviewed and the progress since the last review', async () => {
    const review = {
      mode: 'incremental',
      baseSha: 'abc',
      fullReason: null,
      files: 3,
      statusCounts: { new: 1, stillOpen: 2, resolved: 3, needsRecheck: 0 },
    };
    const latestResult = jest.fn().mockResolvedValue({
      kind: 'found',
      headSha: 'h1',
      reviewPending: false,
      result: { ...RESULT, review },
    });
    const output = await executorWith(latestResult).executor.run({ pull_number: 470 });
    expect(output).toMatchObject({
      reviewScope: { mode: 'incremental', baseSha: 'abc', fullReason: null, files: 3 },
      sinceLastReview: { new: 1, stillOpen: 2, resolved: 3, needsRecheck: 0 },
    });
  });

  it('reports a pull request without a result and one that does not exist', async () => {
    const none = executorWith(
      jest
        .fn()
        .mockResolvedValue({ kind: 'found', headSha: 'h', reviewPending: true, result: null }),
    );
    expect(await none.executor.run({ pull_number: 1 })).toEqual({
      pullRequest: 1,
      found: true,
      isReleasePullRequest: false,
      reviewRunningNow: true,
      reviewed: false,
    });
    const missing = executorWith(jest.fn().mockResolvedValue({ kind: 'not_found' }));
    expect(await missing.executor.run({ pull_number: 2 })).toEqual({
      pullRequest: 2,
      found: false,
    });
  });

  it('lets an outage surface as a tool error', async () => {
    const { executor } = executorWith(jest.fn().mockRejectedValue(new HappyUnavailableError('x')));
    await expect(executor.run({ pull_number: 1 })).rejects.toBeInstanceOf(HappyUnavailableError);
  });

  it('says plainly that a release checklist is not a code review', async () => {
    const latestResult = jest.fn().mockResolvedValue({
      kind: 'found',
      headSha: 'h1',
      baseBranch: 'main',
      headBranch: 'development',
      reviewPending: false,
      result: {
        ...RESULT,
        kind: 'release_checklist',
        status: 'checklist',
        title: 'Список вантажу на виїзд.',
        summary: '',
        counts: { critical: 0, major: 0, minor: 0, nit: 0 },
        questions: [],
      },
    });
    const output = (await executorWith(latestResult).executor.run({ pull_number: 474 })) as Record<
      string,
      unknown
    >;
    expect(output).toMatchObject({
      kind: 'release_checklist',
      baseBranch: 'main',
      headBranch: 'development',
    });
    expect(String(output.note)).toContain('does not review code on releases');
  });

  it('adds no release note to a code review', async () => {
    const latestResult = jest.fn().mockResolvedValue({
      kind: 'found',
      headSha: 'h1',
      baseBranch: 'development',
      headBranch: 'f',
      reviewPending: false,
      result: RESULT,
    });
    const output = (await executorWith(latestResult).executor.run({ pull_number: 1 })) as Record<
      string,
      unknown
    >;
    expect(output.kind).toBe('review');
    expect(output).not.toHaveProperty('note');
  });

  it("flags a release pull request from Happy's branches even when the result is unknown", async () => {
    const latestResult = jest.fn().mockResolvedValue({
      kind: 'found',
      headSha: 'h1',
      baseBranch: 'main',
      headBranch: 'development',
      reviewPending: false,
      result: { ...RESULT, kind: 'review', status: 'unknown', summary: '' },
    });
    const output = (await executorWith(latestResult).executor.run({ pull_number: 474 })) as Record<
      string,
      unknown
    >;
    expect(output).toMatchObject({ isReleasePullRequest: true, kind: 'review', status: 'unknown' });
    expect(output).not.toHaveProperty('note');
  });

  it('carries the checklist digest of a release', async () => {
    const digest = {
      migrations: 3,
      riskyMigrations: 1,
      envVars: 2,
      services: 5,
      dependencyChanges: 4,
      lockfileChanged: false,
    };
    const latestResult = jest.fn().mockResolvedValue({
      kind: 'found',
      headSha: 'h1',
      baseBranch: 'main',
      headBranch: 'development',
      reviewPending: false,
      result: { ...RESULT, kind: 'release_checklist', status: 'checklist', checklist: digest },
    });
    const output = (await executorWith(latestResult).executor.run({ pull_number: 474 })) as Record<
      string,
      unknown
    >;
    expect(output.checklist).toEqual(digest);
  });
});
