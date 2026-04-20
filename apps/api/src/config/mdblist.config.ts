import { registerAs } from '@nestjs/config';

export const DEFAULT_API_URL = 'https://api.mdblist.com';

/**
 * Allowed hostnames for MDBList API calls.
 *
 * Hard-coded to block SSRF via a compromised or mis-typed env value. An
 * operator who accidentally sets `MDBLIST_API_URL` to a metadata-service
 * or internal host would otherwise leak the API key to that endpoint and
 * write attacker-controlled data into our DB.
 */
export const ALLOWED_HOSTNAMES: ReadonlySet<string> = new Set(['api.mdblist.com']);

/**
 * Validates MDBList base URL. Enforces HTTPS and an allow-list of hosts.
 * Falls back to the default when the override is invalid — never throws at
 * config-load time so the app still boots (MDBList is optional).
 *
 * Exported for direct unit testing.
 */
export function resolveApiUrl(raw: string | undefined): string {
  if (!raw) return DEFAULT_API_URL;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return DEFAULT_API_URL;
    if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) return DEFAULT_API_URL;
    return parsed.origin;
  } catch {
    return DEFAULT_API_URL;
  }
}

/**
 * MDBList API Configuration namespace.
 *
 * MDBList aggregates ratings from Rotten Tomatoes (critics + audience),
 * Metacritic, IMDb, Trakt, TMDB, Letterboxd, etc. into a single endpoint.
 *
 * Free tier: 1000 requests/day (x-ratelimit-reset at 00:00 UTC).
 * Docs: https://docs.mdblist.com, API ref: https://mdblist.readme.io/reference
 */
export default registerAs('mdblist', () => ({
  apiKey: process.env.MDBLIST_API_KEY,
  apiUrl: resolveApiUrl(process.env.MDBLIST_API_URL),
}));
