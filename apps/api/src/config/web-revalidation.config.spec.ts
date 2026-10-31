import { resolveRevalidateUrl, WEB_REVALIDATE_PATH } from './web-revalidation.config';

describe('web-revalidation.config / resolveRevalidateUrl', () => {
  it('returns null when the origin is not set', () => {
    expect(resolveRevalidateUrl(undefined)).toBeNull();
    expect(resolveRevalidateUrl('')).toBeNull();
  });

  it('builds the revalidate URL for allow-listed https hosts', () => {
    expect(resolveRevalidateUrl('https://ratingo.top')).toBe(
      `https://ratingo.top${WEB_REVALIDATE_PATH}`,
    );
    expect(resolveRevalidateUrl('https://dev.ratingo.top/')).toBe(
      `https://dev.ratingo.top${WEB_REVALIDATE_PATH}`,
    );
  });

  it('ignores any path in the configured origin', () => {
    expect(resolveRevalidateUrl('https://ratingo.top/some/other/path')).toBe(
      `https://ratingo.top${WEB_REVALIDATE_PATH}`,
    );
  });

  it('rejects plain http so the secret is never sent unencrypted', () => {
    expect(resolveRevalidateUrl('http://ratingo.top')).toBeNull();
  });

  it('rejects hosts outside the allow-list', () => {
    expect(resolveRevalidateUrl('https://evil.example.com')).toBeNull();
    expect(resolveRevalidateUrl('https://ratingo.top.evil.example.com')).toBeNull();
    expect(resolveRevalidateUrl('https://169.254.169.254')).toBeNull();
  });

  it('rejects values that are not URLs', () => {
    expect(resolveRevalidateUrl('ratingo.top')).toBeNull();
  });
});
