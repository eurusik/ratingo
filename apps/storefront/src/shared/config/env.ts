const TRAILING_SLASHES = /\/+$/;

const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(
  TRAILING_SLASHES,
  '',
);

export const API_BASE_URL = `${API_ORIGIN}/api`;
