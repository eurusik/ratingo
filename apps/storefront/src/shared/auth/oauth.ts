export const OAUTH_PROVIDERS = ['google', 'facebook'] as const;

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const FALLBACK_RETURN_PATH = '/';
const PROBE_ORIGIN = 'https://return-path.invalid';

function resolveAgainstProbeOrigin(path: string): URL | null {
  try {
    return new URL(path, PROBE_ORIGIN);
  } catch {
    return null;
  }
}

export function toSafeReturnPath(candidate: string | null | undefined): string {
  if (!candidate?.startsWith('/')) return FALLBACK_RETURN_PATH;
  const resolved = resolveAgainstProbeOrigin(candidate);
  if (resolved?.origin !== PROBE_ORIGIN) return FALLBACK_RETURN_PATH;
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

interface OAuthStartUrlInput {
  apiBaseUrl: string;
  provider: OAuthProvider;
  returnTo: string;
  returnOrigin: string;
}

export function buildOAuthStartUrl({
  apiBaseUrl,
  provider,
  returnTo,
  returnOrigin,
}: OAuthStartUrlInput): string {
  const query = new URLSearchParams({ returnTo: toSafeReturnPath(returnTo), returnOrigin });
  return `${apiBaseUrl}/auth/${provider}?${query.toString()}`;
}
