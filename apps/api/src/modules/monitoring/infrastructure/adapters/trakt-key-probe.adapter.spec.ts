import { HttpStatus } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { HttpError, ResilientHttpClient } from '@/common/http/resilient-http.client';
import type traktConfig from '@/config/trakt.config';
import { API_KEY_STATUS } from '@/modules/monitoring/domain/constants/api-key-status.const';
import { type TraktRateLimitPort } from '@/modules/trakt/public';

import { TraktKeyProbe } from './trakt-key-probe.adapter';

const config = {
  clientId: 'client-id',
  apiUrl: 'https://api.trakt.test',
  userAgent: 'Ratingo/test',
} as ConfigType<typeof traktConfig>;

describe('TraktKeyProbe', () => {
  let rateLimit: jest.Mocked<TraktRateLimitPort>;
  let httpGet: jest.SpyInstance;

  beforeEach(() => {
    rateLimit = { acquire: jest.fn().mockResolvedValue(undefined) };
    httpGet = jest
      .spyOn(ResilientHttpClient.prototype, 'get')
      .mockResolvedValue({ data: [], success: true, attempts: 1 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('acquires a shared Trakt rate-limit token before calling Trakt', async () => {
    const callOrder: string[] = [];
    rateLimit.acquire.mockImplementation(async () => {
      callOrder.push('acquire');
    });
    httpGet.mockImplementation(async () => {
      callOrder.push('get');
      return { data: [], success: true, attempts: 1 };
    });

    const result = await new TraktKeyProbe(config, rateLimit).probe();

    expect(callOrder).toEqual(['acquire', 'get']);
    expect(httpGet).toHaveBeenCalledWith(
      'https://api.trakt.test/movies/trending?limit=1',
      expect.objectContaining({ 'trakt-api-key': 'client-id' }),
    );
    expect(result.status).toBe(API_KEY_STATUS.VALID);
  });

  it('waits for the token instead of calling Trakt while the limiter is busy', async () => {
    let releaseToken: () => void = () => undefined;
    rateLimit.acquire.mockReturnValue(
      new Promise<void>((resolve) => {
        releaseToken = resolve;
      }),
    );

    const pending = new TraktKeyProbe(config, rateLimit).probe();
    await Promise.resolve();
    expect(httpGet).not.toHaveBeenCalled();

    releaseToken();
    await pending;
    expect(httpGet).toHaveBeenCalledTimes(1);
  });

  it('sends a single request per token without retrying', async () => {
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: HttpStatus.SERVICE_UNAVAILABLE }));
    httpGet.mockRestore();

    await new TraktKeyProbe(config, rateLimit).probe();

    expect(rateLimit.acquire).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('maps a 429 to degraded', async () => {
    httpGet.mockResolvedValue({
      data: null,
      success: false,
      attempts: 1,
      error: new HttpError('slow down', HttpStatus.TOO_MANY_REQUESTS),
    });

    const result = await new TraktKeyProbe(config, rateLimit).probe();

    expect(result.status).toBe(API_KEY_STATUS.DEGRADED);
    expect(result.statusCode).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it('reports unknown without calling Trakt when the limiter rejects', async () => {
    rateLimit.acquire.mockRejectedValue(new Error('Rate limiter queue full'));

    const result = await new TraktKeyProbe(config, rateLimit).probe();

    expect(httpGet).not.toHaveBeenCalled();
    expect(result.status).toBe(API_KEY_STATUS.UNKNOWN);
    expect(result.detail).toBe('Rate limiter queue full');
  });

  it('skips the limiter when the client id is missing', async () => {
    const result = await new TraktKeyProbe({ ...config, clientId: undefined }, rateLimit).probe();

    expect(rateLimit.acquire).not.toHaveBeenCalled();
    expect(result.status).toBe(API_KEY_STATUS.UNKNOWN);
  });
});
