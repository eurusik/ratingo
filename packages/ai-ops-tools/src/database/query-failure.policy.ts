import { DB_QUERY_ERROR_MESSAGE_CHARS, QueryRefusal } from './database.constants';
import { ExplorerFailureError, ExplorerQueryRefusedError } from './database.port';

const INSUFFICIENT_PRIVILEGE = '42501';
const QUERY_CANCELED = '57014';
const LOCK_NOT_AVAILABLE = '55P03';
const TOO_MANY_CONNECTIONS = '53300';
const NOT_FOUND_CODES = new Set(['42P01', '42703', '42883', '3F000']);
const CONNECTION_LOST_CODES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '57P01',
  '57P02',
  '57P03',
]);
const PROTOCOL_VIOLATION = '08P01';
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
const NOT_A_DATA_OBJECT = /^permission denied for (function|sequence|language|type|large object)/;
const ACCESS_DENIED_CODES = new Set(['28000', '28P01']);

const codeOf = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;

const detailOf = (error: unknown): string =>
  (error instanceof Error ? error.message : 'unknown error')
    .replace(/\s+/g, ' ')
    .slice(0, DB_QUERY_ERROR_MESSAGE_CHARS);

const refusalFor = (code: string | undefined, message: string): QueryRefusal | null => {
  if (code === INSUFFICIENT_PRIVILEGE) {
    return NOT_A_DATA_OBJECT.test(message) ? QueryRefusal.NOT_ALLOWED : QueryRefusal.PRIVATE;
  }
  if (code === QUERY_CANCELED) return QueryRefusal.TIMEOUT;
  if (code === LOCK_NOT_AVAILABLE || code === TOO_MANY_CONNECTIONS) return QueryRefusal.BUSY;
  if (code !== undefined && NOT_FOUND_CODES.has(code)) return QueryRefusal.NOT_FOUND;
  if (code === PROTOCOL_VIOLATION) return QueryRefusal.INVALID_QUERY;
  if (code !== undefined && /^(42|22|25)/.test(code)) return QueryRefusal.INVALID_QUERY;
  return null;
};

const unavailableReason = (error: unknown): string => {
  const code = codeOf(error);
  if (code !== undefined && NETWORK_CODES.has(code)) return 'network';
  if (code !== undefined && CONNECTION_LOST_CODES.has(code)) return 'connection_lost';
  if (code !== undefined && ACCESS_DENIED_CODES.has(code)) return 'access_denied';
  return error instanceof Error ? `query failed (${error.name})` : 'query failed';
};

export const failureOfQuery = (
  error: unknown,
): ExplorerQueryRefusedError | ExplorerFailureError => {
  if (error instanceof ExplorerQueryRefusedError || error instanceof ExplorerFailureError) {
    return error;
  }
  const refusal = refusalFor(codeOf(error), error instanceof Error ? error.message : '');
  return refusal === null
    ? new ExplorerFailureError(unavailableReason(error))
    : new ExplorerQueryRefusedError(refusal, detailOf(error));
};

export const failureOfSchema = (error: unknown): ExplorerFailureError => {
  const failure = failureOfQuery(error);
  return failure instanceof ExplorerFailureError
    ? failure
    : new ExplorerFailureError(failure.refusal);
};

export const isConnectionLoss = (error: unknown): boolean =>
  error instanceof ExplorerFailureError && ['network', 'connection_lost'].includes(error.reason);
