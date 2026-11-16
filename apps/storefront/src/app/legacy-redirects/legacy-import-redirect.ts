import { HOME_ROUTE, mediaRoute, searchRoute } from '@/shared/config';

function mediaKind(type: string | null): 'movie' | 'show' {
  return type === 'show' ? 'show' : 'movie';
}

export function legacyImportDestination(query: URLSearchParams): string {
  const slug = query.get('slug')?.trim();
  if (slug) return mediaRoute(mediaKind(query.get('type')), slug);
  const title = query.get('title')?.trim();
  return title ? searchRoute(title) : HOME_ROUTE;
}

export function redirectLegacyImport(request: Request): Response {
  const destination = legacyImportDestination(new URL(request.url).searchParams);
  return new Response(null, { status: 307, headers: { Location: destination } });
}
