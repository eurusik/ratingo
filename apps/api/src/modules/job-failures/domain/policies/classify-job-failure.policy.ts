import { JobFailureClass } from '../constants/job-failure-class.constants';
import { UpstreamStatus } from '../constants/upstream-status.constants';
import { type FailureSignal } from '../entities/failure-signal.entity';

const CLASS_BY_ERROR_NAME: ReadonlyMap<string, JobFailureClass> = new Map([
  ['DatabaseException', JobFailureClass.DATABASE],
  ['DatabaseConflictException', JobFailureClass.DATABASE],
  ['DatabaseInvalidInputException', JobFailureClass.DATABASE],
  ['PostgresError', JobFailureClass.DATABASE],
  ['DrizzleQueryError', JobFailureClass.DATABASE],
  ['DrizzleError', JobFailureClass.DATABASE],
  ['AbortError', JobFailureClass.TIMEOUT],
  ['TimeoutError', JobFailureClass.TIMEOUT],
]);

const CLASS_BY_HTTP_STATUS: ReadonlyMap<number, JobFailureClass> = new Map([
  [UpstreamStatus.TOO_MANY_REQUESTS, JobFailureClass.RATE_LIMIT],
  [UpstreamStatus.UNAUTHORIZED, JobFailureClass.ACCESS_DENIED],
  [UpstreamStatus.FORBIDDEN, JobFailureClass.ACCESS_DENIED],
  [UpstreamStatus.PROXY_AUTHENTICATION_REQUIRED, JobFailureClass.ACCESS_DENIED],
  [UpstreamStatus.NOT_FOUND, JobFailureClass.NOT_FOUND],
  [UpstreamStatus.GONE, JobFailureClass.NOT_FOUND],
  [UpstreamStatus.REQUEST_TIMEOUT, JobFailureClass.TIMEOUT],
  [UpstreamStatus.GATEWAY_TIMEOUT, JobFailureClass.TIMEOUT],
  [UpstreamStatus.BAD_GATEWAY, JobFailureClass.NETWORK],
  [UpstreamStatus.SERVICE_UNAVAILABLE, JobFailureClass.NETWORK],
]);

const CLASS_BY_ERROR_CODE: ReadonlyMap<string, JobFailureClass> = new Map([
  ['ETIMEDOUT', JobFailureClass.TIMEOUT],
  ['ESOCKETTIMEDOUT', JobFailureClass.TIMEOUT],
  ['UND_ERR_CONNECT_TIMEOUT', JobFailureClass.TIMEOUT],
  ['UND_ERR_HEADERS_TIMEOUT', JobFailureClass.TIMEOUT],
  ['UND_ERR_BODY_TIMEOUT', JobFailureClass.TIMEOUT],
  ['ECONNRESET', JobFailureClass.NETWORK],
  ['ECONNREFUSED', JobFailureClass.NETWORK],
  ['ECONNABORTED', JobFailureClass.NETWORK],
  ['ENOTFOUND', JobFailureClass.NETWORK],
  ['EAI_AGAIN', JobFailureClass.NETWORK],
  ['EPIPE', JobFailureClass.NETWORK],
  ['EHOSTUNREACH', JobFailureClass.NETWORK],
  ['ENETUNREACH', JobFailureClass.NETWORK],
  ['UND_ERR_SOCKET', JobFailureClass.NETWORK],
]);

const SQLSTATE_CODE = /^(?=[0-9A-Z]*\d)[0-9A-Z]{5}$/;

const CLASS_BY_MESSAGE: readonly (readonly [RegExp, JobFailureClass])[] = [
  [/rate.?limit|too many requests|status:? 429\b|quota/i, JobFailureClass.RATE_LIMIT],
  [/timed?.?out|timeout|deadline exceeded/i, JobFailureClass.TIMEOUT],
  [
    /unauthori[sz]ed|forbidden|access denied|invalid api key|api key is required|status:? 40[13]\b/i,
    JobFailureClass.ACCESS_DENIED,
  ],
  [/not found|status:? 404\b/i, JobFailureClass.NOT_FOUND],
  [
    /econn\w*|enotfound|eai_again|socket hang up|fetch failed|network|connection (?:reset|refused|closed)/i,
    JobFailureClass.NETWORK,
  ],
  [/database|postgres|deadlock|failed query/i, JobFailureClass.DATABASE],
];

const classOfErrorCode = (code: string | null): JobFailureClass | undefined => {
  if (code === null) return undefined;
  return (
    CLASS_BY_ERROR_CODE.get(code) ??
    (SQLSTATE_CODE.test(code) ? JobFailureClass.DATABASE : undefined)
  );
};

const classOfMessage = (message: string): JobFailureClass | undefined =>
  CLASS_BY_MESSAGE.find(([pattern]) => pattern.test(message))?.[1];

export const classOfHttpStatus = (status: number | null): JobFailureClass | undefined =>
  status === null ? undefined : CLASS_BY_HTTP_STATUS.get(status);

export const classifyJobFailure = (signal: FailureSignal): JobFailureClass =>
  CLASS_BY_ERROR_NAME.get(signal.errorName) ??
  classOfHttpStatus(signal.httpStatus) ??
  classOfErrorCode(signal.errorCode) ??
  classOfMessage(signal.message) ??
  JobFailureClass.OTHER;
