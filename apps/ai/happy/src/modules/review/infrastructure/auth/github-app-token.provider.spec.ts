import { createVerify, generateKeyPairSync } from 'node:crypto';

import { CodeHostError } from '../../domain/ports/code-host.port';

import { GithubAppTokenProvider, normalizePrivateKey } from './github-app-token.provider';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const NOW_MS = 1_800_000_000_000;
const REPO = { owner: 'acme', repo: 'shop' };

interface Call {
  url: string;
  method: string;
  auth: string;
}

const harness = (expiresInMs = 3_600_000, nowRef = { value: NOW_MS }) => {
  const calls: Call[] = [];
  let minted = 0;
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      auth: (init.headers as Record<string, string>).Authorization ?? '',
    });
    if (url.endsWith('/installation')) return Response.json({ id: 42 });
    minted += 1;
    return Response.json({
      token: `ghs_token_${minted}`,
      expires_at: new Date(nowRef.value + expiresInMs).toISOString(),
    });
  }) as unknown as typeof fetch;
  const provider = new GithubAppTokenProvider({
    appId: '123',
    privateKey,
    apiUrl: 'https://gh.test',
    nowMs: () => nowRef.value,
    fetchFn,
  });
  return { provider, calls, nowRef };
};

describe('GithubAppTokenProvider', () => {
  it('signs an RS256 app JWT, finds the installation and mints a token', async () => {
    const { provider, calls } = harness();
    expect(await provider.tokenFor(REPO)).toBe('ghs_token_1');
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'GET https://gh.test/repos/acme/shop/installation',
      'POST https://gh.test/app/installations/42/access_tokens',
    ]);
    const jwt = (calls[0]?.auth ?? '').replace('Bearer ', '');
    const [header, payload, signature] = jwt.split('.');
    const verified = createVerify('RSA-SHA256')
      .update(`${header}.${payload}`)
      .verify(publicKey, Buffer.from(signature ?? '', 'base64url'));
    expect(verified).toBe(true);
    const claims = JSON.parse(Buffer.from(payload ?? '', 'base64url').toString()) as {
      iss: string;
      iat: number;
      exp: number;
    };
    expect(claims.iss).toBe('123');
    expect(claims.iat).toBeLessThan(NOW_MS / 1000);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);
  });

  it('reuses the token until shortly before it expires, then mints a new one', async () => {
    const { provider, calls, nowRef } = harness(3_600_000);
    await provider.tokenFor(REPO);
    nowRef.value += 3_000_000;
    expect(await provider.tokenFor(REPO)).toBe('ghs_token_1');
    expect(calls).toHaveLength(2);
    nowRef.value += 560_000;
    expect(await provider.tokenFor(REPO)).toBe('ghs_token_2');
    expect(calls).toHaveLength(4);
  });

  it('shares one mint between concurrent callers and keeps repositories apart', async () => {
    const { provider, calls } = harness();
    const [first, second] = await Promise.all([provider.tokenFor(REPO), provider.tokenFor(REPO)]);
    expect(first).toBe(second);
    expect(calls).toHaveLength(2);
    await provider.tokenFor({ owner: 'acme', repo: 'api' });
    expect(calls).toHaveLength(4);
  });

  it('turns a rejected request into a code host error without the key', async () => {
    const provider = new GithubAppTokenProvider({
      appId: '123',
      privateKey,
      apiUrl: 'https://gh.test',
      nowMs: () => NOW_MS,
      fetchFn: (async () => new Response('', { status: 404, statusText: 'Not Found' })) as never,
    });
    const failure = await provider.tokenFor(REPO).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CodeHostError);
    expect((failure as Error).message).not.toContain('PRIVATE KEY');
  });

  it('accepts a key whose newlines are written as backslash-n', () => {
    expect(normalizePrivateKey('a\\nb')).toBe('a\nb');
    expect(normalizePrivateKey(privateKey)).toBe(privateKey);
  });
});
