import { SEVERITY_NUMBER_BY_LEVEL } from './log-level';
import { CORRELATION_KEYS, type LogIdentity, type LogRecord } from './log-record';

const NANOS_SUFFIX_PER_MILLI = '000000';

const SCOPE_NAME = 'ratingo.logger';

const ATTRIBUTE_KEYS = ['context', 'error_name', ...CORRELATION_KEYS] as const;

const stringAttribute = (key: string, value: string) => ({ key, value: { stringValue: value } });

const toLogRecordPayload = (record: LogRecord) => ({
  timeUnixNano: `${Date.parse(record.time)}${NANOS_SUFFIX_PER_MILLI}`,
  severityNumber: SEVERITY_NUMBER_BY_LEVEL[record.level],
  severityText: record.level,
  body: { stringValue: JSON.stringify(record) },
  attributes: ATTRIBUTE_KEYS.filter((key) => record[key] !== undefined).map((key) =>
    stringAttribute(key, String(record[key])),
  ),
});

export const buildOtlpLogsPayload = (identity: LogIdentity, records: readonly LogRecord[]) => ({
  resourceLogs: [
    {
      resource: {
        attributes: [
          stringAttribute('service.name', identity.service),
          stringAttribute('deployment.environment.name', identity.environment),
        ],
      },
      scopeLogs: [{ scope: { name: SCOPE_NAME }, logRecords: records.map(toLogRecordPayload) }],
    },
  ],
});
