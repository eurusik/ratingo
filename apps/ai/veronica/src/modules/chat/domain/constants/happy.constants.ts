const SECONDS = 1000;

export const HAPPY_FOLLOW_UP_FIRST_DELAY_MS = 30 * SECONDS;
export const HAPPY_FOLLOW_UP_INTERVAL_MS = 30 * SECONDS;
export const HAPPY_FOLLOW_UP_MAX_ATTEMPTS = 20;
export const HAPPY_FOLLOW_UP_MIN_ATTEMPTS_BEFORE_NOT_PUBLISHED = 2;

export const HAPPY_REQUEST_TIMEOUT_MS = 10 * SECONDS;

export const HAPPY_SUMMARY_MAX_CHARS = 400;
export const HAPPY_QUESTION_MAX_CHARS = 160;
export const HAPPY_QUESTIONS_SHOWN = 3;
export const SHORT_SHA_LENGTH = 7;
export const HAPPY_PICK_LIST_SHOWN = 5;
export const HAPPY_PICK_TITLE_MAX_CHARS = 80;
export const GITHUB_WEB_PREFIX = 'https://github.com/';

export const HappyFollowUpAction = {
  DELIVER: 'deliver',
  WAIT: 'wait',
  HEAD_MOVED: 'head_moved',
  NOT_PUBLISHED: 'not_published',
  NOT_FOUND: 'not_found',
  GIVE_UP: 'give_up',
} as const;
export type HappyFollowUpAction = (typeof HappyFollowUpAction)[keyof typeof HappyFollowUpAction];

export const ASK_HAPPY_OUTPUT_CAP = 3000;
