export const OpsTool = {
  METRICS_QUERY: 'metrics_query',
  JOB_FAILURES: 'job_failures',
  LOGS_SEARCH: 'logs_search',
  DB_SCHEMA: 'db_schema',
  DB_QUERY: 'db_query',
} as const;
export type OpsTool = (typeof OpsTool)[keyof typeof OpsTool];
