import { createSign } from 'node:crypto';

import { z } from 'zod';

import { CodeHostError } from '../../domain/ports/code-host.port';

import type { GithubRepositoryRef, GithubTokenProvider } from './github-token.provider';

const API_VERSION = '2022-11-28';
const JWT_BACKDATE_SECONDS = 60;
const JWT_LIFETIME_SECONDS = 9 * 60;
const REFRESH_MARGIN_MS = 60_000;
const MS_PER_SECOND = 1000;

const installationResponse = z.object({ id: z.number().int() });
const accessTokenResponse = z.object({ token: z.string().min(1), expires_at: z.string() });

export interface GithubAppConfig {
  appId: string;
  privateKey: string;
  apiUrl: string;
  nowMs: () => number;
  fetchFn?: typeof fetch;
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

const base64Url = (value: Buffer | string): string => Buffer.from(value).toString('base64url');

export const normalizePrivateKey = (raw: string): string => raw.replace(/\\n/g, '\n');

export class GithubAppTokenProvider implements GithubTokenProvider {
  private readonly fetchFn: typeof fetch;
  private readonly cache = new Map<string, CachedToken>();
  private readonly pending = new Map<string, Promise<string>>();

  constructor(private readonly config: GithubAppConfig) {
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async tokenFor(repository: GithubRepositoryRef): Promise<string> {
    const key = `${repository.owner}/${repository.repo}`.toLowerCase();
    const cached = this.cache.get(key);
    if (cached !== undefined && cached.expiresAtMs - REFRESH_MARGIN_MS > this.config.nowMs()) {
      return cached.token;
    }
    const inFlight = this.pending.get(key);
    if (inFlight !== undefined) return inFlight;
    const fresh = this.mint(repository, key).finally(() => this.pending.delete(key));
    this.pending.set(key, fresh);
    return fresh;
  }

  private async mint(repository: GithubRepositoryRef, key: string): Promise<string> {
    const jwt = this.signAppJwt();
    const owner = encodeURIComponent(repository.owner);
    const repo = encodeURIComponent(repository.repo);
    const installation = installationResponse.parse(
      await this.call('find installation', `/repos/${owner}/${repo}/installation`, jwt, 'GET'),
    );
    const access = accessTokenResponse.parse(
      await this.call(
        'create installation token',
        `/app/installations/${installation.id}/access_tokens`,
        jwt,
        'POST',
      ),
    );
    this.cache.set(key, { token: access.token, expiresAtMs: Date.parse(access.expires_at) });
    return access.token;
  }

  private signAppJwt(): string {
    const issuedAt = Math.floor(this.config.nowMs() / MS_PER_SECOND) - JWT_BACKDATE_SECONDS;
    const signingInput = [
      base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
      base64Url(
        JSON.stringify({
          iat: issuedAt,
          exp: issuedAt + JWT_BACKDATE_SECONDS + JWT_LIFETIME_SECONDS,
          iss: this.config.appId,
        }),
      ),
    ].join('.');
    const signature = createSign('RSA-SHA256')
      .update(signingInput)
      .sign(normalizePrivateKey(this.config.privateKey));
    return `${signingInput}.${base64Url(signature)}`;
  }

  private async call(
    operation: string,
    path: string,
    jwt: string,
    method: 'GET' | 'POST',
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.config.apiUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': API_VERSION,
          'User-Agent': 'ratingo-happy',
        },
      });
    } catch {
      throw new CodeHostError(operation, null, 'network error');
    }
    if (!response.ok) {
      throw new CodeHostError(operation, response.status, response.statusText);
    }
    return response.json();
  }
}
