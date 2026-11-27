import { DB_QUERY_ERROR_MESSAGE_CHARS, QueryRefusal } from './database.constants';
import { ExplorerFailureError, ExplorerQueryRefusedError } from './database.port';

const INSUFFICIENT_PRIVILEGE = '42501';
const QUERY_CANCELED = '57014';
const LOCK_NOT_AVAILABLE = '55P03';
const TOO_MANY_CONNECTIONS = '53300';
const NOT_FOUND_CODES = new Set(['42P01', '42703', '42883', '3F000']);
const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_DESTROYED',
  'CONNECTION_ENDED',
]);
const ACCESS_DENIED_CODES = new Set(['28000', '28P01']);

const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

const detailOf = (error: unknown): string =>
  (error instanceof Error ? error.message : 'unknown error')
    .replace(/\s+/g, ' ')
    .slice(0, DB_QUERY_ERROR_MESSAGE_CHARS);

const refusalFor = (code: string | undefined): QueryRefusal | null => {
  if (code === INSUFFICIENT_PRIVILEGE) return QueryRefusal.PRIVATE;
  if (code === QUERY_CANCELED) return QueryRefusal.TIMEOUT;
  if (code === LOCK_NOT_AVAILABLE || code === TOO_MANY_CONNECTIONS) return QueryRefusal.BUSY;
  if (code !== undefined && NOT_FOUND_CODES.has(code)) return QueryRefusal.NOT_FOUND;
  if (code !== undefined && /^(42|22|25)/.test(code)) return QueryRefusal.INVALID_QUERY;
  return null;
};

const unavailableReason = (error: unknown): string => {
  const code = codeOf(error);
  if (code !== undefined && NETWORK_CODES.has(code)) return 'network';
  if (code !== undefined && ACCESS_DENIED_CODES.has(code)) return 'access_denied';
  return error instanceof Error ? `query failed (${error.name})` : 'query failed';
};

export const failureOfQuery = (
  error: unknown,
): ExplorerQueryRefusedError | ExplorerFailureError => {
  const refusal = refusalFor(codeOf(error));
  return refusal === null
    ? new ExplorerFailureError(unavailableReason(error))
    : new ExplorerQueryRefusedError(refusal, detailOf(error));
};

export const failureOfSchema = (error: unknown): ExplorerFailureError =>
  new ExplorerFailureError(unavailableReason(error));
