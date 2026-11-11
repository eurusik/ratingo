const LOCAL_API_ORIGIN = 'http://localhost:3001';
const TRAILING_SLASHES = /\/+$/;

function withoutTrailingSlashes(url: string): string {
  return url.replace(TRAILING_SLASHES, '');
}

const API_ORIGIN = withoutTrailingSlashes(process.env.NEXT_PUBLIC_API_URL || LOCAL_API_ORIGIN);

export const API_BASE_URL = `${API_ORIGIN}/api`;
