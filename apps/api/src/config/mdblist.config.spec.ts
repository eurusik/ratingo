import { DEFAULT_API_URL, resolveApiUrl } from './mdblist.config';

describe('mdblist.config / resolveApiUrl', () => {
  it('returns default URL when env is undefined', () => {
    expect(resolveApiUrl(undefined)).toBe(DEFAULT_API_URL);
  });

  it('returns default URL when env is an empty string', () => {
    expect(resolveApiUrl('')).toBe(DEFAULT_API_URL);
  });

  it('accepts a valid https override pointing to the allow-listed host', () => {
    // URL.origin strips the trailing slash.
    expect(resolveApiUrl('https://api.mdblist.com')).toBe('https://api.mdblist.com');
    expect(resolveApiUrl('https://api.mdblist.com/')).toBe('https://api.mdblist.com');
  });

  it('rejects HTTP scheme (downgrade attack prevention)', () => {
    expect(resolveApiUrl('http://api.mdblist.com')).toBe(DEFAULT_API_URL);
  });

  it('rejects hostnames not in allow-list (SSRF prevention — AWS IMDS)', () => {
    expect(resolveApiUrl('http://169.254.169.254/latest/meta-data/')).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl('https://169.254.169.254/')).toBe(DEFAULT_API_URL);
  });

  it('rejects hostnames not in allow-list (SSRF prevention — internal DNS)', () => {
    expect(resolveApiUrl('https://internal-service.corp')).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl('https://localhost')).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl('https://127.0.0.1')).toBe(DEFAULT_API_URL);
  });

  it('rejects non-HTTPS schemes that URL can parse (file, gopher, ftp)', () => {
    expect(resolveApiUrl('file:///etc/passwd')).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl('ftp://api.mdblist.com')).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl('gopher://api.mdblist.com')).toBe(DEFAULT_API_URL);
  });

  it('falls back to default on malformed URL input (no throw)', () => {
    expect(resolveApiUrl('not a url')).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl('://')).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl('https://')).toBe(DEFAULT_API_URL);
  });

  it('rejects a spoofed host even if path suggests mdblist (hostname-only check)', () => {
    expect(resolveApiUrl('https://evil.com/api.mdblist.com/')).toBe(DEFAULT_API_URL);
    expect(resolveApiUrl('https://api.mdblist.com.evil.com/')).toBe(DEFAULT_API_URL);
  });
});
