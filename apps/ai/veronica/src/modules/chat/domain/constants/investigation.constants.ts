import { OpsTool } from '@ratingo/ai-ops-tools';

const HOURS_PER_DAY = 24;
const SECONDS_PER_DAY = HOURS_PER_DAY * 60 * 60;

export const CHAT_BUDGET_PER_MESSAGE_USD = 0.05;
export const CHAT_BUDGET_PER_DAY_USD = 0.3;
export const CHAT_MAX_TURNS = 8;
export const CHAT_BUDGET_WINDOW_MS = SECONDS_PER_DAY * 1000;

export const QUESTION_MAX_CHARS = 1000;
export const ANSWER_MAX_CHARS = 3500;

export const CONVERSATION_MAX_MESSAGES = 12;
export const CONVERSATION_TTL_SECONDS = SECONDS_PER_DAY;
export const CONVERSATION_MESSAGE_MAX_CHARS = 1000;

export const PRODUCT_OUTPUT_CAP = 3000;
export const SNAPSHOT_OUTPUT_CAP = 6000;
export const CHANGES_OUTPUT_CAP = 4000;

export const ASK_DUME_OUTPUT_CAP = 1000;
export const CHANGES_ITEM_CAP = 20;
export const CHANGE_TITLE_MAX_CHARS = 120;

export const InvestigationTool = {
  METRICS_QUERY: OpsTool.METRICS_QUERY,
  PRODUCT_STATS: 'product_stats',
  DIGEST_SNAPSHOT: 'digest_snapshot',
  RECENT_CHANGES: 'recent_changes',
  ASK_HAPPY: 'ask_happy',
  JOB_FAILURES: OpsTool.JOB_FAILURES,
  LOGS_SEARCH: OpsTool.LOGS_SEARCH,
  DB_SCHEMA: OpsTool.DB_SCHEMA,
  DB_QUERY: OpsTool.DB_QUERY,
  ASK_DUME: 'ask_dume',
} as const;
export type InvestigationTool = (typeof InvestigationTool)[keyof typeof InvestigationTool];
