import { z } from 'zod';

import {
  LOG_DEFAULT_LEVEL,
  LOG_DEFAULT_MODE,
  LOG_DEFAULT_WINDOW,
  LogLevel,
  LogSearchMode,
  LogService,
} from './logs.constants';

export const LOG_SERVICES = Object.values(LogService) as [LogService, ...LogService[]];
const LOG_LEVELS = Object.values(LogLevel) as [LogLevel, ...LogLevel[]];
const LOG_MODES = Object.values(LogSearchMode) as [LogSearchMode, ...LogSearchMode[]];

export const logsSearchInput = z.object({
  service: z.enum(LOG_SERVICES).describe('Which service to read the logs of'),
  level: z
    .enum(LOG_LEVELS)
    .optional()
    .describe(`error or warn (warn also includes errors). Default ${LOG_DEFAULT_LEVEL}`),
  window: z
    .string()
    .optional()
    .describe(
      `How far back to look, such as 6h, 24h or 7d (at most 7d). Default ${LOG_DEFAULT_WINDOW}`,
    ),
  mode: z
    .enum(LOG_MODES)
    .optional()
    .describe(
      `grouped (identical errors counted together) or lines (newest records). Default ${LOG_DEFAULT_MODE}`,
    ),
  text: z
    .string()
    .optional()
    .describe('Plain part of the log message to look for, any letter case; not a pattern'),
  job_id: z.string().optional().describe('Exact BullMQ job id taken from an earlier result'),
  request_id: z.string().optional().describe('Exact HTTP request id taken from an earlier result'),
  run_id: z.string().optional().describe('Exact AI agent run id taken from an earlier result'),
  queue: z.string().optional().describe('Exact queue name such as ingestion'),
});

export type LogsSearchInput = z.infer<typeof logsSearchInput>;
