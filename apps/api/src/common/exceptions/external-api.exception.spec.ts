import { MdblistApiException, TraktApiException } from './external-api.exception';

describe('ExternalApiException.isRateLimited', () => {
  it('is true only for an upstream 429', () => {
    expect(new MdblistApiException('quota', 429).isRateLimited()).toBe(true);
    expect(new TraktApiException('slow down', 429).isRateLimited()).toBe(true);
    expect(new MdblistApiException('unavailable', 503).isRateLimited()).toBe(false);
    expect(new MdblistApiException('API key is required').isRateLimited()).toBe(false);
  });
});
