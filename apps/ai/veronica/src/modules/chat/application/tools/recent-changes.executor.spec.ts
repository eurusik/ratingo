import { FixedClock, RowList, fitRowList } from '@ratingo/ai-core';

import { CHANGES_OUTPUT_CAP } from '../../domain/constants/investigation.constants';

import { ChangesUnavailableError } from '../../domain/ports/recent-changes.port';

import { RecentChangesExecutor } from './recent-changes.executor';

const NOW_MS = Date.UTC(2026, 10, 22, 12, 0, 0);

const materialized = (result: unknown): unknown =>
  result instanceof RowList ? result.withAllRows() : result;

describe('RecentChangesExecutor', () => {
  it('returns titles, numbers and Kyiv times only', async () => {
    const asked: number[] = [];
    const executor = new RecentChangesExecutor(
      {
        since: async (sinceMs) => {
          asked.push(sinceMs);
          return {
            mergedPullRequests: [
              {
                number: 464,
                title: 'feat(veronica): chat '.repeat(20),
                baseBranch: 'development',
                headBranch: 'feature',
                mergedAtMs: Date.UTC(2026, 10, 22, 9, 30),
              },
            ],
            deployments: [
              { environment: 'production', state: 'success', atMs: Date.UTC(2026, 10, 22, 10, 0) },
            ],
          };
        },
      },
      new FixedClock(NOW_MS),
    );
    const result = materialized(await executor.run({ window: '48h' })) as {
      window: string;
      pullRequests: { number: number; title: string; into: string; mergedAtKyiv: string }[];
      deployments: unknown[];
    };
    expect(asked).toEqual([NOW_MS - 48 * 3_600_000]);
    expect(result.pullRequests[0]).toMatchObject({
      number: 464,
      into: 'development',
      mergedAtKyiv: '2026-11-22 11:30',
    });
    expect(result.pullRequests[0].title.length).toBeLessThanOrEqual(120);
    expect(result.deployments).toEqual([
      { environment: 'production', state: 'success', atKyiv: '2026-11-22 12:00' },
    ]);
  });

  it('marks the release pull request so the model can pick the last one with code', async () => {
    const pull = (number: number, baseBranch: string, headBranch: string) => ({
      number,
      title: 't',
      baseBranch,
      headBranch,
      mergedAtMs: NOW_MS,
    });
    const executor = new RecentChangesExecutor(
      {
        since: async () => ({
          mergedPullRequests: [
            pull(474, 'main', 'development'),
            pull(473, 'development', 'feat/x'),
            pull(472, 'main', 'hotfix/y'),
          ],
          deployments: [],
        }),
      },
      new FixedClock(NOW_MS),
    );
    const result = materialized(await executor.run({})) as {
      pullRequests: { number: number; isRelease: boolean }[];
    };
    expect(result.pullRequests.map(({ number, isRelease }) => [number, isRelease])).toEqual([
      [474, true],
      [473, false],
      [472, false],
    ]);
  });

  it('keeps whole pull requests within the output cap and says how many were left out', async () => {
    const executor = new RecentChangesExecutor(
      {
        since: async () => ({
          mergedPullRequests: Array.from({ length: 50 }, (_, index) => ({
            number: index,
            title: `feat: change number ${index} `.repeat(5),
            baseBranch: 'development',
            headBranch: `feat/${index}`,
            mergedAtMs: NOW_MS,
          })),
          deployments: Array.from({ length: 30 }, () => ({
            environment: 'production',
            state: 'success',
            atMs: NOW_MS,
          })),
        }),
      },
      new FixedClock(NOW_MS),
    );
    const output = fitRowList((await executor.run({})) as RowList, CHANGES_OUTPUT_CAP);
    const parsed = JSON.parse(output) as {
      pullRequests: { number: number }[];
      omitted: number;
      hint: string;
      deployments: unknown[];
      deploymentsOmitted: number;
    };
    expect(output.length).toBeLessThanOrEqual(CHANGES_OUTPUT_CAP);
    expect(parsed.pullRequests.length + parsed.omitted).toBe(50);
    expect(parsed.hint).toContain('into=');
    expect(parsed.deployments).toHaveLength(20);
    expect(parsed.deploymentsOmitted).toBe(10);
  });

  it('keeps only the pull requests merged into the asked branch', async () => {
    const pull = (number: number, baseBranch: string) => ({
      number,
      title: 't',
      baseBranch,
      headBranch: 'x',
      mergedAtMs: NOW_MS,
    });
    const executor = new RecentChangesExecutor(
      {
        since: async () => ({
          mergedPullRequests: [pull(1, 'main'), pull(2, 'development')],
          deployments: [],
        }),
      },
      new FixedClock(NOW_MS),
    );
    const result = materialized(await executor.run({ into: 'main' })) as {
      pullRequests: { number: number }[];
    };
    expect(result.pullRequests.map((pullRequest) => pullRequest.number)).toEqual([1]);
  });

  it('rejects a window beyond 7 days', async () => {
    const executor = new RecentChangesExecutor(
      { since: async () => ({ mergedPullRequests: [], deployments: [] }) },
      new FixedClock(NOW_MS),
    );
    await expect(executor.run({ window: '30d' })).rejects.toThrow(/7 days/);
  });

  it('lets the unavailable error through so the model can say so', async () => {
    const executor = new RecentChangesExecutor(
      {
        since: async () => {
          throw new ChangesUnavailableError('GITHUB_READ_TOKEN is not set');
        },
      },
      new FixedClock(NOW_MS),
    );
    await expect(executor.run({})).rejects.toThrow('GITHUB_READ_TOKEN is not set');
  });
});
