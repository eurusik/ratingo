import { CodeHostError } from '../../domain/ports/code-host.port';
import { TEST_REF } from '../testing/fake-code-host.testing';

import { GithubCodeHostAdapter } from './github.code-host-adapter';

const TOKEN = 'ghp_secrettokenvalue1234567890';

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const filePayload = (index: number, patch: string | undefined = '@@ -1 +1 @@\n+x') => ({
  filename: `src/f${index}.ts`,
  status: 'modified',
  additions: 1,
  deletions: 0,
  patch,
});

const adapterWith = (handler: (url: string, init: RequestInit) => Response) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return {
    calls,
    adapter: new GithubCodeHostAdapter({ token: TOKEN, apiUrl: 'https://gh.test', fetchFn }),
  };
};

describe('GithubCodeHostAdapter', () => {
  it('maps pull request metadata and sends a read-only bearer request', async () => {
    const { adapter, calls } = adapterWith(() =>
      json({
        title: 'T',
        body: null,
        draft: true,
        user: { login: 'alice' },
        base: { ref: 'main', sha: 'b1' },
        head: { sha: 'h1', repo: { full_name: 'acme/shop' } },
      }),
    );
    const pr = await adapter.getPullRequest(TEST_REF);
    expect(pr).toMatchObject({
      body: '',
      isDraft: true,
      baseSha: 'b1',
      headRepository: 'acme/shop',
    });
    expect(calls[0]?.url).toBe('https://gh.test/repos/acme/shop/pulls/7');
    expect(calls[0]?.init.method).toBeUndefined();
    expect((calls[0]?.init.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('paginates changed files and stops at a short page', async () => {
    const { adapter, calls } = adapterWith((url) =>
      json(
        url.endsWith('&page=1')
          ? Array.from({ length: 100 }, (_, i) => filePayload(i))
          : [filePayload(100)],
      ),
    );
    const result = await adapter.listChangedFiles(TEST_REF, { maxFiles: 500, maxPatchChars: 1e6 });
    expect(result.files).toHaveLength(101);
    expect(result.truncated).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it('caps the file count and drops patches over the size budget', async () => {
    const big = 'x'.repeat(50);
    const { adapter } = adapterWith(() =>
      json(Array.from({ length: 10 }, (_, i) => filePayload(i, big))),
    );
    const result = await adapter.listChangedFiles(TEST_REF, { maxFiles: 5, maxPatchChars: 120 });
    expect(result.files).toHaveLength(5);
    expect(result.files.filter((file) => file.patch !== null)).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it('does not spend the patch budget on lockfiles and generated files', async () => {
    const lock = { ...filePayload(0, 'x'.repeat(500)), filename: 'package-lock.json' };
    const { adapter } = adapterWith(() => json([lock, filePayload(1)]));
    const result = await adapter.listChangedFiles(TEST_REF, { maxFiles: 10, maxPatchChars: 100 });
    expect(result.files[0]?.patch).toBeNull();
    expect(result.files[1]?.patch).not.toBeNull();
    expect(result.truncated).toBe(false);
  });

  it('reports truncation when the file cap lands exactly on a full page', async () => {
    const { adapter } = adapterWith(() =>
      json(Array.from({ length: 100 }, (_, i) => filePayload(i))),
    );
    const result = await adapter.listChangedFiles(TEST_REF, { maxFiles: 100, maxPatchChars: 1e6 });
    expect(result.files).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });

  it('returns null for a missing file and truncates large contents', async () => {
    const { adapter } = adapterWith((url) =>
      url.includes('missing') ? new Response('nope', { status: 404 }) : new Response('abcdefghij'),
    );
    expect(await adapter.readFile(TEST_REF, 'missing.ts', 'sha', { maxBytes: 5 })).toBeNull();
    expect(await adapter.readFile(TEST_REF, 'a.ts', 'sha', { maxBytes: 5 })).toBe('abcde');
  });

  it('reads CLAUDE.md and every markdown rule from the base commit', async () => {
    const { adapter, calls } = adapterWith((url) => {
      if (url.includes('/contents/.claude/rules?')) {
        return json([
          { name: 'b.md', path: '.claude/rules/b.md', type: 'file' },
          { name: 'a.md', path: '.claude/rules/a.md', type: 'file' },
          { name: 'x.json', path: '.claude/rules/x.json', type: 'file' },
          { name: 'sub', path: '.claude/rules/sub', type: 'dir' },
        ]);
      }
      return new Response(`content of ${decodeURIComponent(url)}`);
    });
    const files = await adapter.readRuleFiles(TEST_REF, 'base111');
    expect(files.map((file) => file.path)).toEqual([
      'CLAUDE.md',
      '.claude/rules/a.md',
      '.claude/rules/b.md',
    ]);
    expect(calls.every((call) => call.url.includes('base111'))).toBe(true);
  });

  it('treats a missing rules directory as no rules', async () => {
    const { adapter } = adapterWith((url) =>
      url.includes('CLAUDE.md') ? new Response('# rules') : new Response('', { status: 404 }),
    );
    expect(await adapter.readRuleFiles(TEST_REF, 'b')).toEqual([
      { path: 'CLAUDE.md', content: '# rules' },
    ]);
  });

  it('throws a code host error without leaking the token', async () => {
    const { adapter } = adapterWith(
      () => new Response('', { status: 403, statusText: 'Forbidden' }),
    );
    const failure = await adapter.getPullRequest(TEST_REF).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CodeHostError);
    expect((failure as Error).message).toContain('403');
    expect((failure as Error).message).not.toContain(TOKEN);
  });

  it('turns a network failure into a code host error', async () => {
    const adapter = new GithubCodeHostAdapter({
      token: TOKEN,
      apiUrl: 'https://gh.test',
      fetchFn: (async () => {
        throw new Error(`connect failed with ${TOKEN}`);
      }) as unknown as typeof fetch,
    });
    const failure = await adapter.getPullRequest(TEST_REF).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CodeHostError);
    expect((failure as Error).message).not.toContain(TOKEN);
  });
});
