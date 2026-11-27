import type { DumeConfig } from '../../../../config/config.constants';
import { DumeRejectionReason } from '../../domain/entities/dume';
import { DumeUnavailableError } from '../../domain/ports/dume-client.port';
import { COMMIT, answeredView, queuedView } from '../../testing/dume.testing';

import { HttpDumeClient } from './http.dume-client';

const TOKEN = 'a-service-token-of-24-chars!';
const CONFIG: DumeConfig = {
  internalUrl: 'http://dume.railway.internal:3006/',
  serviceToken: TOKEN,
  repository: 'eurusik/ratingo',
};
const SUBMISSION = { requestId: 'tg1000001', question: 'Why?', ref: 'main' };

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
  return { calls, client: new HttpDumeClient(config, fetchImpl) };
};

describe('HttpDumeClient', () => {
  it('submits a question once, with a bearer token, to the private URL', async () => {
    const { client, calls } = clientWith(() =>
      json({ status: 'accepted', created: true, request: queuedView() }),
    );

    const result = await client.submit(SUBMISSION);

    expect(result).toMatchObject({ kind: 'accepted', created: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('http://dume.railway.internal:3006/internal/investigations');
    expect(calls[0]?.init.method).toBe('POST');
    expect((calls[0]?.init.headers as Record<string, string>).authorization).toBe(
      `Bearer ${TOKEN}`,
    );
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual(SUBMISSION);
  });

  it('reads a rejection and a conflict as answers, not as failures', async () => {
    const rejected = clientWith(() =>
      json({ status: 'rejected', reason: DumeRejectionReason.QUEUE_FULL }, 429),
    );
    const conflict = clientWith(() =>
      json({ status: 'conflict', reason: 'request_id_reused' }, 409),
    );

    expect(await rejected.client.submit(SUBMISSION)).toEqual({
      kind: 'rejected',
      reason: DumeRejectionReason.QUEUE_FULL,
    });
    expect(await conflict.client.submit(SUBMISSION)).toEqual({ kind: 'conflict' });
  });

  it('looks a request up and keeps the verified answer', async () => {
    const { client, calls } = clientWith(() => json({ status: 'found', request: answeredView() }));

    const lookup = await client.find('tg1000001');

    expect(calls[0]?.url).toBe(
      'http://dume.railway.internal:3006/internal/investigations/tg1000001',
    );
    expect(lookup).toMatchObject({
      kind: 'found',
      request: { state: 'answered', result: { commit: COMMIT, turns: 7 } },
    });
  });

  it('reads not_found as an answer', async () => {
    const { client } = clientWith(() => json({ status: 'not_found' }));

    expect(await client.find('tg1000001')).toEqual({ kind: 'not_found' });
  });

  it.each([
    ['a missing URL', { ...CONFIG, internalUrl: undefined }, () => json({}), 'not_configured'],
    ['a missing token', { ...CONFIG, serviceToken: undefined }, () => json({}), 'not_configured'],
    ['a server error', CONFIG, () => json({ message: 'boom' }, 502), 'HTTP 502'],
    ['an unauthorized answer', CONFIG, () => json({}, 401), 'HTTP 401'],
    [
      'a body that is not JSON',
      CONFIG,
      () => new Response('<html>', { status: 200 }),
      'HTTP 200 without JSON',
    ],
    ['a wrong shape', CONFIG, () => json({ status: 'accepted' }), 'unexpected response shape'],
  ])('reports DUM-E as unavailable for %s', async (_name, config, handler, reason) => {
    const { client } = clientWith(handler, config);

    await expect(client.submit(SUBMISSION)).rejects.toEqual(new DumeUnavailableError(reason));
  });

  it('reports a network failure by its name and never retries', async () => {
    const { client, calls } = clientWith(() => {
      throw new TypeError('fetch failed');
    });

    await expect(client.find('tg1000001')).rejects.toEqual(new DumeUnavailableError('TypeError'));
    expect(calls).toHaveLength(1);
  });
});
