import type { HappyConfig } from '../../../../config/config.constants';
import { HttpHappyClient } from './http.happy-client';

const TOKEN = 'a-service-token-of-24-chars!';
const CONFIG: HappyConfig = {
  internalUrl: 'http://happy.railway.internal:3005/',
  serviceToken: TOKEN,
  repository: 'a/b',
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const clientWith = (
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
  config = CONFIG,
) => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { calls, client: new HttpHappyClient(config, fetchImpl) };
};

const RESULT = {
  status: 'reviewed',
  checkedSha: 'h1',
  current: true,
  title: 't',
  summary: 's',
  skipReason: null,
  counts: { critical: 0, major: 1, minor: 0, nit: 0 },
  questions: [],
  coverage: { complete: true, unreviewedFiles: 0, gaps: [] },
  checkRunUrl: null,
};

describe('HttpHappyClient', () => {
  it('requests a review with a bearer token on the private URL, once', async () => {
    const { client, calls } = clientWith(() => json({ status: 'queued', headSha: 'h1' }));
    expect(await client.requestReview(470)).toEqual({ kind: 'queued', headSha: 'h1' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      'http://happy.railway.internal:3005/internal/pull-requests/470/review',
    );
    expect(calls[0]?.init.method).toBe('POST');
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${TOKEN}`,
    );
  });

  it('maps a refusal and a missing pull request', async () => {
    expect(
      await clientWith(() => json({ status: 'skipped', reason: 'merged' })).client.requestReview(1),
    ).toEqual({ kind: 'skipped', reason: 'merged' });
    expect(await clientWith(() => json({ status: 'not_found' })).client.requestReview(1)).toEqual({
      kind: 'not_found',
    });
  });

  it('reads the latest result', async () => {
    const { client, calls } = clientWith(() =>
      json({ status: 'found', headSha: 'h1', reviewPending: false, result: RESULT }),
    );
    expect(await client.latestResult(470)).toMatchObject({
      kind: 'found',
      result: { counts: { major: 1 } },
    });
    expect(calls[0]?.init.method).toBe('GET');
    expect(await clientWith(() => json({ status: 'not_found' })).client.latestResult(1)).toEqual({
      kind: 'not_found',
    });
  });

  it.each([
    ['an HTTP 404', () => json({}, 404)],
    ['an HTTP 401', () => json({}, 401)],
    ['an HTTP 503', () => json({}, 503)],
    ['a network failure', () => Promise.reject(new TypeError('fetch failed'))],
    ['a response of the wrong shape', () => json({ status: 'weird' })],
    ['a response that is not JSON', () => new Response('<html>', { status: 200 })],
  ])('reports Happy as unavailable on %s', async (_name, handler) => {
    const { client } = clientWith(handler as never);
    await expect(client.latestResult(1)).rejects.toMatchObject({ name: 'HappyUnavailableError' });
    await expect(client.requestReview(1)).rejects.toMatchObject({ name: 'HappyUnavailableError' });
  });

  it.each([
    { ...CONFIG, internalUrl: undefined },
    { ...CONFIG, serviceToken: undefined },
  ])('is unavailable without configuration and calls nothing', async (config) => {
    const { client, calls } = clientWith(() => json({}), config);
    await expect(client.latestResult(1)).rejects.toMatchObject({ name: 'HappyUnavailableError' });
    expect(calls).toEqual([]);
  });

  it('never puts the token in the error', async () => {
    const { client } = clientWith(() => json({}, 500));
    await expect(client.latestResult(1)).rejects.not.toThrow(TOKEN);
  });
});
