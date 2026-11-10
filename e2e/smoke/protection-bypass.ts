import * as path from 'path';

export const SMOKE_STORAGE_STATE = path.resolve(__dirname, '../.auth/smoke-state.json');

const BYPASS_HEADER = 'x-vercel-protection-bypass';
const SET_BYPASS_COOKIE_HEADER = 'x-vercel-set-bypass-cookie';

export const protectionBypassHeaders = (secret: string): Record<string, string> => ({
  [BYPASS_HEADER]: secret,
  [SET_BYPASS_COOKIE_HEADER]: 'true',
});
