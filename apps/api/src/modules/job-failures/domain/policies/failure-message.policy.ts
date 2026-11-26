import { JOB_FAILURE_MESSAGE_MAX_CHARS } from '../constants/job-failure.constants';

const REDACTED = '<redacted>';
const EMAIL_PLACEHOLDER = '<email>';
const ELLIPSIS = '…';
const REDACTION_INPUT_PER_OUTPUT_CHAR = 4;
const REDACTION_INPUT_MAX_CHARS = JOB_FAILURE_MESSAGE_MAX_CHARS * REDACTION_INPUT_PER_OUTPUT_CHAR;

const QUERY_PARAMS_SECTION = /\n\s*params:[\s\S]*$/;
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi;
const URL_QUERY = /(\b[a-z][a-z0-9+.-]*:\/\/[^\s?#"'<>]+)[?#][^\s"'<>]*/gi;
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER_TOKEN = /\b(bearer)\s+[\w.~+/=-]+/gi;
const SECRET_ASSIGNMENT =
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|token|secret|password|passwd|pwd|authorization|auth)(["']?\s*[=:]\s*["']?)[^\s"'&,;)]+/gi;
const EMAIL = /[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/gi;
const HEX_SECRET = /\b[a-f0-9]{32,}\b/gi;
const MIXED_CASE_SECRET = /\b(?=[\w-]*[a-z])(?=[\w-]*[A-Z])(?=[\w-]*\d)[\w-]{24,}\b/g;
const WHITESPACE = /\s+/g;

const clip = (text: string): string =>
  text.length <= JOB_FAILURE_MESSAGE_MAX_CHARS
    ? text
    : `${text.slice(0, JOB_FAILURE_MESSAGE_MAX_CHARS - ELLIPSIS.length)}${ELLIPSIS}`;

export const redactFailureMessage = (message: string): string => {
  const redacted = message
    .replace(QUERY_PARAMS_SECTION, '')
    .slice(0, REDACTION_INPUT_MAX_CHARS)
    .replace(URL_QUERY, '$1')
    .replace(URL_CREDENTIALS, `$1${REDACTED}@`)
    .replace(JWT, REDACTED)
    .replace(BEARER_TOKEN, `$1 ${REDACTED}`)
    .replace(SECRET_ASSIGNMENT, `$1$2${REDACTED}`)
    .replace(EMAIL, EMAIL_PLACEHOLDER)
    .replace(HEX_SECRET, REDACTED)
    .replace(MIXED_CASE_SECRET, REDACTED)
    .replace(WHITESPACE, ' ')
    .trim();
  return clip(redacted);
};
