import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, RowList, redactSecrets, type ClockPort } from '@ratingo/ai-core';

import {
  LOG_CONTEXT_MAX_CHARS,
  LOG_DEFAULT_LEVEL,
  LOG_DEFAULT_MODE,
  LOG_DEFAULT_WINDOW,
  LOG_FETCH_LIMIT_GROUPED,
  LOG_FETCH_LIMIT_LINES,
  LOG_FIELD_MAX_CHARS,
  LOG_MESSAGE_MAX_CHARS,
  LOG_NARROWING_HINT,
  LOG_STACK_HEAD_MAX_CHARS,
  LOG_STACK_HEAD_MAX_LINES,
  LogSearchMode,
  LogsFailureClass,
} from '../../domain/constants/logs.constants';
import type { LogEntry, LogGroup } from '../../domain/entities/log-entry';
import {
  groupLogEntries,
  newestFirst,
  parseLogLine,
  shortened,
  stackHead,
} from '../../domain/policies/log-entry.policy';
import { buildLogQuery } from '../../domain/policies/log-query.policy';
import { formatKyivDateTime } from '../../domain/policies/kyiv-time.policy';
import { parseWindow } from '../../domain/policies/metric-params.policy';
import {
  LOGS_PORT,
  LogsUnavailableError,
  type LogQuery,
  type LogsFetch,
  type LogsPort,
} from '../../domain/ports/logs.port';

import type { LogsSearchInput } from './investigation-executors';

const safeText = (text: string, maxChars: number): string =>
  shortened(redactSecrets(text), maxChars);

const optionalText = (key: string, value: string | undefined, maxChars: number) =>
  value === undefined || value === '' ? {} : { [key]: safeText(value, maxChars) };

const sampleOf = (entry: LogEntry) => ({
  ...optionalText('errorName', entry.errorName, LOG_FIELD_MAX_CHARS),
  message: safeText(entry.message, LOG_MESSAGE_MAX_CHARS),
  ...optionalText('errorMessage', entry.errorMessage, LOG_MESSAGE_MAX_CHARS),
  ...(entry.errorStack === undefined
    ? {}
    : {
        stackHead: safeText(
          stackHead(entry.errorStack, LOG_STACK_HEAD_MAX_LINES, LOG_STACK_HEAD_MAX_CHARS),
          LOG_STACK_HEAD_MAX_CHARS,
        ),
      }),
  ...optionalText('jobId', entry.jobId, LOG_FIELD_MAX_CHARS),
  ...optionalText('queue', entry.queue, LOG_FIELD_MAX_CHARS),
  ...optionalText('requestId', entry.requestId, LOG_FIELD_MAX_CHARS),
  ...optionalText('runId', entry.runId, LOG_FIELD_MAX_CHARS),
});

const groupRow = (group: LogGroup) => ({
  count: group.count,
  level: group.level,
  context: safeText(group.context, LOG_CONTEXT_MAX_CHARS),
  firstSeenAtKyiv: formatKyivDateTime(group.firstAtMs),
  lastSeenAtKyiv: formatKyivDateTime(group.lastAtMs),
  sample: sampleOf(group.sample),
});

const lineRow = (entry: LogEntry) => ({
  atKyiv: formatKyivDateTime(entry.atMs),
  level: entry.level,
  context: safeText(entry.context, LOG_CONTEXT_MAX_CHARS),
  ...(entry.occurrences > 1 ? { repeatsSuppressed: entry.occurrences } : {}),
  ...sampleOf(entry),
});

const echoedFilters = (input: LogsSearchInput) => ({
  ...(input.queue === undefined ? {} : { queue: input.queue }),
  ...(input.job_id === undefined ? {} : { job_id: input.job_id }),
  ...(input.request_id === undefined ? {} : { request_id: input.request_id }),
  ...(input.run_id === undefined ? {} : { run_id: input.run_id }),
  ...(input.text === undefined ? {} : { text: safeText(input.text, LOG_FIELD_MAX_CHARS) }),
});

const criteriaOf = (input: LogsSearchInput, level: string, windowHours: number) => ({
  service: input.service,
  level,
  windowHours,
  text: input.text,
  jobId: input.job_id,
  requestId: input.request_id,
  runId: input.run_id,
  queue: input.queue,
});

const groupedList = (entries: readonly LogEntry[], envelope: object) =>
  RowList.of(groupLogEntries(entries).map(groupRow), LOG_NARROWING_HINT, (kept, omission) => ({
    ...envelope,
    groups: kept,
    ...omission,
  }));

const lineList = (entries: readonly LogEntry[], envelope: object) =>
  RowList.of(newestFirst(entries).map(lineRow), LOG_NARROWING_HINT, (kept, omission) => ({
    ...envelope,
    records: kept,
    ...omission,
  }));

@Injectable()
export class LogsSearchExecutor {
  private readonly logger = new Logger(LogsSearchExecutor.name);

  constructor(
    @Inject(LOGS_PORT) private readonly logs: LogsPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async run(input: LogsSearchInput): Promise<unknown> {
    const window = parseWindow(input.window ?? LOG_DEFAULT_WINDOW);
    if (window === null) {
      throw new Error('window must look like 24h or 7d and be at most 7 days');
    }
    const mode = input.mode ?? LOG_DEFAULT_MODE;
    const level = input.level ?? LOG_DEFAULT_LEVEL;
    const query = buildLogQuery(
      criteriaOf(input, level, window.hours),
      this.clock.nowMs(),
      mode === LogSearchMode.GROUPED ? LOG_FETCH_LIMIT_GROUPED : LOG_FETCH_LIMIT_LINES,
    );
    const fetched = await this.fetch(query);
    const entries = fetched.lines.map(parseLogLine);
    const envelope = {
      service: input.service,
      level,
      window: window.promql,
      mode,
      ...echoedFilters(input),
      recordsRead: fetched.lines.length,
      ...(fetched.limitReached ? { limitReached: true } : {}),
    };
    return mode === LogSearchMode.GROUPED
      ? groupedList(entries, envelope)
      : lineList(entries, envelope);
  }

  private async fetch(query: LogQuery): Promise<LogsFetch> {
    try {
      return await this.logs.search(query);
    } catch (error) {
      const unavailable =
        error instanceof LogsUnavailableError
          ? error
          : new LogsUnavailableError(LogsFailureClass.OTHER);
      this.logger.warn(`logs_search failed: ${unavailable.reason}`);
      throw unavailable;
    }
  }
}
