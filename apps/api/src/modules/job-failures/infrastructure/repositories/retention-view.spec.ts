import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { JOB_FAILURE_RETENTION_DAYS } from '@/modules/job-failures/domain/constants/job-failure.constants';

const MIGRATION = join(__dirname, '../../../../../drizzle_v2/0041_job_failure_days.sql');
const VIEW_WINDOW = /"day" >= \(now\(\) AT TIME ZONE 'Europe\/Kyiv'\)::date - (\d+);/;

describe('reporting.daily_job_failures', () => {
  it('shows the same Kyiv days that retention keeps', () => {
    const match = VIEW_WINDOW.exec(readFileSync(MIGRATION, 'utf8'));
    expect(match).not.toBeNull();
    expect(Number(match?.[1])).toBe(JOB_FAILURE_RETENTION_DAYS - 1);
  });
});
