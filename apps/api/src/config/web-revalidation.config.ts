import { registerAs } from '@nestjs/config';

export const ALLOWED_WEB_HOSTNAMES: ReadonlySet<string> = new Set([
  'ratingo.top',
  'www.ratingo.top',
  'dev.ratingo.top',
]);

export const WEB_REVALIDATE_PATH = '/api/revalidate';

export function resolveRevalidateUrl(rawOrigin: string | undefined): string | null {
  if (!rawOrigin) return null;
  try {
    const parsed = new URL(rawOrigin);
    if (parsed.protocol !== 'https:') return null;
    if (!ALLOWED_WEB_HOSTNAMES.has(parsed.hostname)) return null;
    return `${parsed.origin}${WEB_REVALIDATE_PATH}`;
  } catch {
    return null;
  }
}

export default registerAs('webRevalidation', () => ({
  url: resolveRevalidateUrl(process.env.WEB_REVALIDATE_ORIGIN),
  secret: process.env.WEB_REVALIDATE_SECRET || null,
}));
