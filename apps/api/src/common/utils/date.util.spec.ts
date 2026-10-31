import { formatUtcDayId, formatUtcHourId } from './date.util';

describe('date.util', () => {
  it('formatUtcDayId formats YYYYMMDD', () => {
    expect(formatUtcDayId(new Date('2025-12-21T19:45:10Z'))).toBe('20251221');
  });

  it('formatUtcHourId formats YYYYMMDDHH', () => {
    expect(formatUtcHourId(new Date('2025-12-21T19:45:10Z'))).toBe('2025122119');
    expect(formatUtcHourId(new Date('2025-01-02T04:00:00Z'))).toBe('2025010204');
  });
});
