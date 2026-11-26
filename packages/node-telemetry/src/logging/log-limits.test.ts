import { DEFAULT_LOG_LIMITS, resolveLogLimits } from './log-limits';

describe('resolveLogLimits', () => {
  it('defaults to a 4 KB record, a one minute window, 300 records a minute and 12 MB a day', () => {
    expect(resolveLogLimits({})).toEqual({
      maxRecordBytes: 4096,
      dedupeWindowMs: 60_000,
      maxRecordsPerMinute: 300,
      maxBytesPerDay: 12 * 1024 * 1024,
    });
    expect(resolveLogLimits({})).toEqual(DEFAULT_LOG_LIMITS);
  });

  it('reads every limit from the environment', () => {
    expect(
      resolveLogLimits({
        LOG_MAX_RECORD_BYTES: '2048',
        LOG_DEDUPE_WINDOW_SECONDS: '30',
        LOG_SHIP_MAX_RECORDS_PER_MINUTE: '100',
        LOG_SHIP_MAX_BYTES_PER_DAY: '5000000',
      }),
    ).toEqual({
      maxRecordBytes: 2048,
      dedupeWindowMs: 30_000,
      maxRecordsPerMinute: 100,
      maxBytesPerDay: 5_000_000,
    });
  });

  it.each(['0', '-5', 'abc', '1.5'])('rejects %s', (value) => {
    expect(() => resolveLogLimits({ LOG_SHIP_MAX_BYTES_PER_DAY: value })).toThrow(
      /LOG_SHIP_MAX_BYTES_PER_DAY/,
    );
  });
});
