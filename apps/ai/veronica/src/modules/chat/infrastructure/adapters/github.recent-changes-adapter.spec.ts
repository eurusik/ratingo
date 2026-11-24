import { ChangesUnavailableError } from '../../domain/ports/recent-changes.port';

import { GithubRecentChangesAdapter } from './github.recent-changes-adapter';

const SINCE_MS = Date.UTC(2026, 10, 21);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const adapterWith = (
  route: (url: string) => Response,
  token: { value?: string } = { value: 'ghp_secret' },
) => {
  const urls: string[] = [];
  const headers: Record<string, string>[] = [];
  const fetchImpl = jest.fn(async (url: string, init: RequestInit) => {
    urls.push(url);
    headers.push(init.headers as Record<string, string>);
    return route(url);
  });
  return {
    adapter: new GithubRecentChangesAdapter(
      { token: token.value, repository: 'eurusik/ratingo' },
      fetchImpl as never,
    ),
    urls,
    headers,
  };
};

const pull = (number: number, base: string, mergedAt: string | null) => ({
  number,
  title: `PR ${number}`,
  merged_at: mergedAt,
  updated_at: mergedAt ?? '2026-11-22T00:00:00Z',
  base: { ref: base },
  head: { ref: base === 'main' ? 'development' : 'feat/x' },
  body: 'secret body',
  user: { login: 'someone' },
});

describe('GithubRecentChangesAdapter', () => {
  it('reports unavailable without a token and calls nothing', async () => {
    const { adapter, urls } = adapterWith(() => json([]), {});
    await expect(adapter.since(SINCE_MS)).rejects.toThrow(ChangesUnavailableError);
    expect(urls).toEqual([]);
  });

  it('lists pull requests merged since the cutoff from main and development, newest first', async () => {
    const { adapter } = adapterWith((url) => {
      if (url.includes('base=main')) {
        return json([
          pull(465, 'main', '2026-11-22T10:00:00Z'),
          pull(400, 'main', '2026-11-01T10:00:00Z'),
        ]);
      }
      if (url.includes('base=development')) {
        return json([
          pull(464, 'development', '2026-11-22T12:00:00Z'),
          pull(463, 'development', null),
        ]);
      }
      return json([]);
    });
    const report = await adapter.since(SINCE_MS);
    expect(report.mergedPullRequests).toEqual([
      {
        number: 464,
        title: 'PR 464',
        baseBranch: 'development',
        headBranch: 'feat/x',
        mergedAtMs: Date.parse('2026-11-22T12:00:00Z'),
      },
      {
        number: 465,
        title: 'PR 465',
        baseBranch: 'main',
        headBranch: 'development',
        mergedAtMs: Date.parse('2026-11-22T10:00:00Z'),
      },
    ]);
    expect(JSON.stringify(report)).not.toContain('secret body');
    expect(JSON.stringify(report)).not.toContain('someone');
  });

  it('finds a pull request that was pushed to page two by later updates of older ones', async () => {
    const updatedAfterMerge = (number: number) => ({
      ...pull(number, 'development', null),
      updated_at: '2026-11-22T15:00:00Z',
    });
    const { adapter, urls } = adapterWith((url) => {
      if (!url.includes('base=development')) return json([]);
      return url.endsWith('page=1')
        ? json(Array.from({ length: 30 }, (_, index) => updatedAfterMerge(100 + index)))
        : json([pull(473, 'development', '2026-11-22T11:00:00Z')]);
    });
    const report = await adapter.since(SINCE_MS);
    expect(report.mergedPullRequests.map((merged) => merged.number)).toEqual([473]);
    expect(urls.filter((url) => url.includes('base=development'))).toHaveLength(2);
  });

  it('stops paging once the page reaches pull requests older than the window', async () => {
    const stale = (number: number) => ({
      ...pull(number, 'development', null),
      updated_at: '2026-10-01T00:00:00Z',
    });
    const { adapter, urls } = adapterWith(() =>
      json(Array.from({ length: 30 }, (_, index) => stale(index))),
    );
    await adapter.since(SINCE_MS);
    expect(urls.filter((url) => url.includes('/pulls?'))).toHaveLength(2);
  });

  it('never pages without a bound', async () => {
    const fresh = (number: number) => ({
      ...pull(number, 'development', null),
      updated_at: '2026-11-23T00:00:00Z',
    });
    const { adapter, urls } = adapterWith(() =>
      json(Array.from({ length: 30 }, (_, index) => fresh(index))),
    );
    await adapter.since(SINCE_MS);
    expect(urls.filter((url) => url.includes('base=main')).length).toBeLessThanOrEqual(4);
  });

  it('lists recent deployments with their latest state', async () => {
    const { adapter } = adapterWith((url) => {
      if (url.includes('/statuses')) {
        return json([{ state: 'success', created_at: '2026-11-22T10:05:00Z' }]);
      }
      if (url.includes('/deployments')) {
        return json([
          { id: 1, environment: 'production', created_at: '2026-11-22T10:00:00Z' },
          { id: 2, environment: 'production', created_at: '2026-11-01T10:00:00Z' },
        ]);
      }
      return json([]);
    });
    const report = await adapter.since(SINCE_MS);
    expect(report.deployments).toEqual([
      { environment: 'production', state: 'success', atMs: Date.parse('2026-11-22T10:05:00Z') },
    ]);
  });

  it('sends a read-only bearer request to the configured repository', async () => {
    const { adapter, urls, headers } = adapterWith(() => json([]));
    await adapter.since(SINCE_MS);
    expect(
      urls.every((url) => url.startsWith('https://api.github.com/repos/eurusik/ratingo/')),
    ).toBe(true);
    expect(headers[0].authorization).toBe('Bearer ghp_secret');
  });

  it('fails with the status but never the token when GitHub refuses', async () => {
    const { adapter } = adapterWith(() => json({ message: 'Bad credentials' }, 401));
    const error = await adapter.since(SINCE_MS).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ChangesUnavailableError);
    expect((error as Error).message).toContain('401');
    expect((error as Error).message).not.toContain('ghp_secret');
  });
});
